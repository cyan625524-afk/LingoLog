// 服务端语音合成（前端注释里叫它「路线零」）
//
// ── 为什么要搬到服务端 ───────────────────────────────────────────────
// 网页层能拿到的音色，取决于**设备自带的 TTS 引擎**。桌面 Edge 之所以自然，
// 是因为它带着微软的 "Online (Natural)" 神经音色；安卓上的 Edge / vivo 浏览器
// 读出来的是系统音色（Google 文字转语音 / 厂商 TTS），规则拼接，机械感明显 ——
// 这不是网页能换的。
//
// 唯一的出口是把合成放到服务端：用 Edge 朗读背后那套神经音色合成一段 MP3，
// 存在我们自己的域名下，前端当普通音频播。这样 vivo 也能出声，
// 而且不再受「这台设备有没有音色」摆布。
//
// ── 两个必须记住的约束 ───────────────────────────────────────────────
// 1. 只能在服务端跑。它是伪装 Edge 浏览器去连微软合成服务的（UA + 动态令牌），
//    浏览器里既跨域又拿不到令牌。
//
// 2. 云平台传进来的是**裸 Node `ServerResponse`，没有 Express 的 `res.status()`**。
//    所以下面响应对象的类型只要求三个最小成员（statusCode / setHeader / end），
//    Express 的 res 和裸 res 都天然满足 —— 本地开发与线上共用这一份实现，
//    不会出现「本地好的、线上 500」那种双份代码漂移。
//    （同类坑的另一半记在 api/inbox.ts：过去正是 res.status 不存在导致平台 500。）

import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

/**
 * 唯一指定音色。改这一行就能换声音 —— 前端不再逐个设备挑音色。
 *
 * en-GB-RyanNeural：英式男声，和项目里「尽量模拟英伦电台语调」的设定一致；
 * 而且它是我在这台机器上实测最稳的一个（Sonia / Thomas 连三次都被重置）。
 */
export const TTS_VOICE = "en-GB-RyanNeural";

/** 允许点名的音色。白名单而非自由传入：这个接口对公网开放，任人传 voice
 *  等于把微软三百多个音色都挂到我们域名下。前端目前只用 TTS_VOICE 一个。 */
export const TTS_ALLOWED_VOICES: readonly string[] = [
  "en-GB-RyanNeural",
  "en-GB-SoniaNeural",
  "en-US-AriaNeural",
  "en-US-GuyNeural",
];

/** 单条合成的文本上限。URL 里带着原文，太长会被平台截断或超长拒收。 */
export const TTS_MAX_TEXT_LENGTH = 400;

/**
 * 单次尝试的上限。
 * 实测（本机、国内网络）一次成功约 1.0~1.6 秒；境外节点更快。
 * 命中这个上限说明上游在拖，不是断了（断掉是另一种形态，见下面）。
 */
const ATTEMPT_TIMEOUT_MS = 8000;

/**
 * 整个请求的总上限。取 15 秒有两个约束，改它要一起改前端：
 *   下界 —— 必须短于 vercel.json 里 api/tts.ts 的 maxDuration（30 秒），
 *           否则平台先杀函数，用户拿到一个没有解释的 500；
 *   上界 —— 必须短于前端那道闸门（src/utils/tts.ts 的 SERVER_TTS_GUARD_MS，20 秒），
 *           否则服务端还在合成、前端已经放弃并切回设备音色，白等一次。
 */
const TOTAL_DEADLINE_MS = 15000;

/**
 * 「快失败」的判定线 —— 这是这份代码里最值得记下来的一个实测数字。
 *
 * 连打 12 次这条上游接口：失败**全部**发生在 0.21~0.30 秒，报
 * `read ECONNRESET`；成功则在 1.0~1.6 秒返回。也就是说失败集中在
 * **连接建立阶段**（握手被重置），而不是合成到一半断掉。
 *
 * 结论直接决定了重试策略：快速失败立刻重试几乎不花时间（零点几秒），
 * 而慢失败（撞到 8 秒上限）说明上游拥堵，再试只会把等待翻倍 —— 不如早点
 * 让前端回退到设备音色。所以这里**只对快失败重试**。
 *
 * 顺带：这条链路是「伪装 Edge 浏览器直连微软合成服务」，本身不受任何 SLA 保护，
 * 在国内被间歇性重置是常态。重试不是补丁，是这条路的必要组成部分。
 */
const FAST_FAILURE_MS = 3000;
const MAX_ATTEMPTS = 4;

/** 自己这条路的限流。不复用 /api 那个 30/分钟：那边是按「请求」算的，
 *  而这里**一句电文就是一次请求**，连着翻卡很容易超过 30。 */
const TTS_RATE_LIMIT_MAX = 60;
const TTS_RATE_LIMIT_WINDOW_MS = 60_000;

const ttsRateMap = new Map<string, { count: number; resetAt: number }>();

/** 内存热缓存：预热或近期合成的音频直接从内存响应（<1ms），避免重复握手等待 */
const audioMemoryCache = new Map<string, Buffer>();
const MAX_MEMORY_CACHE_ENTRIES = 200;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = ttsRateMap.get(key);
  if (!entry || now > entry.resetAt) {
    ttsRateMap.set(key, { count: 1, resetAt: now + TTS_RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (entry.count >= TTS_RATE_LIMIT_MAX) return true;
  entry.count++;
  return false;
}

/** Express 的 Response 与裸 ServerResponse 的交集，够用就好。 */
export interface TtsHttpResponse {
  statusCode: number;
  setHeader(name: string, value: string | number): unknown;
  end(body?: unknown): unknown;
}

export interface ParsedTtsQuery {
  text: string;
  voice: string;
  /** SSML 的 rate 属性，形如 "-5%" / "+10%" */
  rateAttribute: string;
}

/**
 * 把易变的 `rate`（前端一直是 0.95 这种倍数）翻成 SSML 的百分比。
 * 「慢一点」这条设定必须保留：默认 0.95 对听力练习有用。
 */
export function rateAttributeOf(rate: number): string {
  const safe = Number.isFinite(rate) ? Math.min(2, Math.max(0.5, rate)) : 0.95;
  const percent = Math.round((safe - 1) * 100);
  return `${percent >= 0 ? "+" : ""}${percent}%`;
}

/** SSML 是 XML，而 msedge-tts 的模板是**直接字符串拼接**（没有转义）。
 *  原文里的 `&` `<` `>` 会让整段 XML 失效 —— 结果不是报错，而是没声音。 */
function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 解析查询串。不用框架的 query 解析器：裸 res 那条路上没有 req.query。 */
export function parseTtsQuery(queryString: string): ParsedTtsQuery | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(queryString.replace(/^\?/, ""));
  } catch {
    return null;
  }

  const rawText = params.get("t") || "";
  // 换行 / 连续空格会让 SSML 里出现奇怪的停顿时长，压成单空格
  const text = rawText.replace(/\s+/g, " ").trim();
  if (!text || text.length > TTS_MAX_TEXT_LENGTH) return null;

  const asked = params.get("v") || "";
  const voice = TTS_ALLOWED_VOICES.includes(asked) ? asked : TTS_VOICE;

  const askedRate = Number(params.get("r"));
  return {
    text: escapeXml(text),
    voice,
    rateAttribute: rateAttributeOf(askedRate || 0.95),
  };
}

/**
 * 给一个 promise 套上超时。用它而不是只给音频流设超时，是因为**握手也要算在内**：
 * setMetadata 会去开 WebSocket，如果那次连接既不成功也不报错（被静默丢弃），
 * 只盯着流的定时器会让请求一直挂着，直到平台把函数杀掉。
 */
function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("tts_synthesis_timeout")), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/** 一次尝试：开连接、合成、收字节。失败时对象一律关闭，不留下悬挂的 WebSocket。 */
async function synthesizeOnce(params: ParsedTtsQuery): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  try {
    const work = (async () => {
      await tts.setMetadata(params.voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(params.text, { rate: params.rateAttribute });

      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        audioStream.on("data", (chunk: Buffer | string) => {
          chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        });
        audioStream.on("end", () => resolve());
        audioStream.on("error", (err: Error) => reject(err));
      });
      return Buffer.concat(chunks);
    })();

    const audio = await withTimeout(work, ATTEMPT_TIMEOUT_MS);
    // 空的（或几乎空的）结果不能当成成功交给前端：那会是一段静音，
    // 比报错更糟 —— 用户以为"读出来了但没声音"。
    if (audio.length < 1024) throw new Error("tts_empty_audio");
    return audio;
  } finally {
    // 不关会留下一条 WebSocket；实例复用时越积越多
    try {
      tts.close();
    } catch {}
  }
}

/**
 * 调微软的合成服务拿一段 MP3，带一次「快失败」重试。
 *
 * 这是 Edge「朗读」背后那个服务的非官方用法，免账号免密钥。
 * 代价是它不属于正式接口：既不保证可用，也不保证稳定 —— 所以调用方必须保留
 * 回退，这条路失败时前端要能落回设备自带音色，而不是彻底没声音。
 */
async function synthesize(params: ParsedTtsQuery): Promise<{ audio: Buffer; attempts: number }> {
  const startedAt = Date.now();
  let lastError: unknown = new Error("tts_failed");

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const attemptStartedAt = Date.now();
    try {
      const audio = await synthesizeOnce(params);
      return { audio, attempts: attempt };
    } catch (err) {
      lastError = err;
      const spent = Date.now() - attemptStartedAt;
      const outOfTime = Date.now() - startedAt > TOTAL_DEADLINE_MS;
      const worthRetrying = spent < FAST_FAILURE_MS && !outOfTime;
      console.warn(
        `[TTS] 第 ${attempt}/${MAX_ATTEMPTS} 次合成失败（${spent}ms）：${String(
          (err as Error)?.message || err
        ).slice(0, 120)}${worthRetrying ? "，立刻重试" : "，不再重试"}`
      );
      if (!worthRetrying) break;
    }
  }

  throw lastError;
}

function sendJson(res: TtsHttpResponse, status: number, payload: unknown) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Length", body.length);
  res.end(body);
}

/**
 * 处理一次 /api/tts 请求。Express 与云平台 serverless 入口都调它。
 */
export async function serveEdgeTts(
  queryString: string,
  clientKey: string,
  res: TtsHttpResponse
): Promise<void> {
  if (isRateLimited(clientKey)) {
    return sendJson(res, 429, { error: "tts_rate_limited", message: "请求过于频繁，请稍后再试。" });
  }

  const params = parseTtsQuery(queryString);
  if (!params) {
    return sendJson(res, 400, {
      error: "tts_bad_request",
      message: `缺少 t 参数，或文本超过 ${TTS_MAX_TEXT_LENGTH} 个字符。`,
    });
  }

  const cacheKey = `${params.voice}|${params.rateAttribute}|${params.text}`;
  const memoryHit = audioMemoryCache.get(cacheKey);
  if (memoryHit) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable, s-maxage=31536000");
    res.setHeader("Accept-Ranges", "none");
    res.setHeader("X-TTS-Voice", params.voice);
    res.setHeader("X-TTS-Attempts", "0 (memory-hit)");
    res.setHeader("Content-Length", memoryHit.length);
    res.end(memoryHit);
    return;
  }

  try {
    const startedAt = Date.now();
    const { audio, attempts } = await synthesize(params);
    console.log(
      `[TTS] ${params.voice} 合成 ${audio.length} 字节 · 第 ${attempts} 次尝试成功 · ${
        Date.now() - startedAt
      }ms`
    );

    // 写入内存热缓存（LRU 简单淘汰）
    if (audioMemoryCache.size >= MAX_MEMORY_CACHE_ENTRIES) {
      const oldestKey = audioMemoryCache.keys().next().value;
      if (oldestKey) audioMemoryCache.delete(oldestKey);
    }
    audioMemoryCache.set(cacheKey, audio);

    res.statusCode = 200;
    res.setHeader("Content-Type", "audio/mpeg");
    // 强缓存 + immutable：同一句电文的地址永远一样，第二次点朗读时
    // 浏览器直接从磁盘拿，**不发网络请求**，也就不可能再触发合成。
    // s-maxage 让云平台的边缘节点也缓存一份，换台设备同句仍然不再合成。
    // （要覆盖 server.ts 里那条对 /api 一视同仁的 no-store。）
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable, s-maxage=31536000");
    // 我们一次性返回整段，不支持分段请求 —— 明确告诉浏览器别来问 Range
    res.setHeader("Accept-Ranges", "none");
    res.setHeader("X-TTS-Voice", params.voice);
    // 诊断用：重试了几次一眼可见（手机上没控制台，只能靠响应头）
    res.setHeader("X-TTS-Attempts", String(attempts));
    res.setHeader("Content-Length", audio.length);
    res.end(audio);
  } catch (err: any) {
    const reason = String(err?.message || err).slice(0, 120);
    console.warn(`[TTS] 合成失败：${reason}`);
    // 失败不能伪装成音频：前端靠这个 5xx 落到设备自带音色那条路上。
    return sendJson(res, 502, { error: "tts_synthesis_failed", message: reason });
  }
}
