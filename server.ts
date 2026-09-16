import express from "express";
import path from "path";
import dotenv from "dotenv";
import { isIP } from "node:net";
import { GoogleGenAI, Type } from "@google/genai";
import { translateSpokenInput } from "./src/data/spokenTranslator";
import { findInspirationMatch, inspirationToOptimizationResult } from "./src/data/inspirationData";
import { detectCategory, detectDefaultTags as detectTags } from "./src/utils/categoryMatcher";
import { pickCoreHighlights } from "./src/utils/highlightPicker";
import { getPreset, DEFAULT_PROVIDER_ID } from "./src/data/providers";

dotenv.config();

const app = express();
// 云平台会通过环境变量注入端口，写死会导致部署后访问不了。
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "512kb" }));

// API 响应一律不缓存：避免密钥或中间结果被浏览器 / 代理留存。
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// 日志脱敏：错误对象里可能夹带请求配置，任何情况下都不允许 API 密钥进入日志。
// 密钥脱敏。多模型上线后不能再只认 Google 格式，否则 DeepSeek / Kimi 这些
// `sk-` 开头的密钥一旦出现在上游错误响应里，会原样写进日志。
//   Google / Gemini                     AIzaSy...
//   OpenAI / DeepSeek / Kimi / 通义 / SiliconFlow   sk-...
//   智谱 GLM                            <32位hex>.<16位>
//   任何 Bearer token
const SECRET_PATTERNS: RegExp[] = [
  /\bAIza[0-9A-Za-z_\-]{10,}/g,
  /\bsk-[A-Za-z0-9_\-]{16,}/g,
  /\bBearer\s+[A-Za-z0-9_\-.]{16,}/gi,
  /\b[0-9a-f]{32}\.[A-Za-z0-9]{16}/g,
];

function redact(value: unknown): string {
  let raw: string;
  if (value instanceof Error) {
    raw = value.message;
  } else if (typeof value === "string") {
    raw = value;
  } else {
    try {
      raw = JSON.stringify(value);
    } catch {
      raw = String(value);
    }
  }
  let out = String(raw ?? "");
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, "[REDACTED]");
  return out;
}

// 跨域支持（允许油猴脚本和外部助手调用）
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, X-LingoLog-Access-Token, X-Inbox-Token");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// ── Gemini 等外部助手一键推送收件箱（纯内存队列，不写磁盘，避免 Vite 触发整页刷新） ──
let inboxQueue: Array<{ id: string; text: string; createdAt: string }> = [];
const INBOX_MAX_ITEMS = 100;
const INBOX_MAX_TEXT_LENGTH = 4000;

function hasValidAccessToken(req: express.Request, configuredToken?: string): boolean {
  if (!configuredToken) return false;
  return req.get("X-LingoLog-Access-Token") === configuredToken;
}

function requireInboxAccess(req: express.Request, res: express.Response): boolean {
  if (process.env.ENABLE_INBOX !== "true") {
    res.status(404).json({ error: "inbox_disabled" });
    return false;
  }
  if (!hasValidAccessToken(req, process.env.INBOX_TOKEN)) {
    res.status(401).json({ error: "inbox_unauthorized" });
    return false;
  }
  return true;
}

app.post("/api/inbox", (req, res) => {
  if (!requireInboxAccess(req, res)) return;
  const { text } = req.body || {};
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "内容不能为空" });
  }
  if (text.trim().length > INBOX_MAX_TEXT_LENGTH) {
    return res.status(413).json({ error: `内容不能超过 ${INBOX_MAX_TEXT_LENGTH} 个字符` });
  }
  if (inboxQueue.length >= INBOX_MAX_ITEMS) {
    return res.status(429).json({ error: "收件箱队列已满，请稍后再试" });
  }
  const newItem = {
    id: Math.random().toString(36).substring(2, 9),
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
  inboxQueue.push(newItem);
  console.log(`[Inbox] 收到外部推送的新学习表达，待同步队列: ${inboxQueue.length} 条`);
  res.json({ ok: true, count: inboxQueue.length });
});

app.get("/api/inbox", (req, res) => {
  if (!requireInboxAccess(req, res)) return;
  const items = [...inboxQueue];
  inboxQueue = []; // 读取后清空队列
  res.json({ items });
});

// P1 #9: Simple in-memory rate limiting (per-IP, 30 requests per minute)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 30;

function rateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return res.status(429).json({ error: "请求过于频繁，请稍后再试。" });
  }

  entry.count++;
  return next();
}

app.use("/api", rateLimiter);

// P1 #10: Centralized model name normalization
const DEFAULT_MODEL = "gemini-3.8-flash";
const DEPRECATED_MODELS = ["gemini-3.6-flash", "gemini-3.7-flash"];

function normalizeModelName(modelName?: string): string {
  if (!modelName || DEPRECATED_MODELS.includes(modelName)) {
    return DEFAULT_MODEL;
  }
  return modelName;
}

// Helper to fetch faithful translation from public translation services
async function fetchOnlineTranslation(text: string): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 1. Try MyMemory API (high availability & accurate translation)
  try {
    const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=zh-CN|en`;
    const res = await fetch(myMemoryUrl);
    if (res.ok) {
      const data = await res.json();
      const translated = data?.responseData?.translatedText;
      if (typeof translated === "string" && translated.trim() && !translated.startsWith("MYMEMORY WARNING")) {
        return translated.trim();
      }
    }
  } catch (err) {
    console.warn("MyMemory translation failed:", err);
  }

  // 2. Fallback to Google Translate public endpoint with browser headers
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=t&q=${encodeURIComponent(trimmed)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translated = data[0]
          .map((s: any) => (Array.isArray(s) && typeof s[0] === "string" ? s[0] : ""))
          .join("")
          .trim();
        if (translated) return translated;
      }
    }
  } catch (err) {
    console.warn("Google translate fallback failed:", err);
  }

  return null;
}


// Lazy get Gemini client
function getGeminiClient(customApiKey?: string) {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function canUseServerCredential(req: express.Request, suppliedApiKey?: unknown): boolean {
  if (typeof suppliedApiKey === "string" && suppliedApiKey.trim()) return true;
  const hasServerCredential = Boolean(
    process.env.GEMINI_API_KEY ||
      process.env.DEEPSEEK_API_KEY ||
      process.env.OPENAI_COMPATIBLE_API_KEY
  );
  return !hasServerCredential || hasValidAccessToken(req, process.env.SERVER_API_ACCESS_TOKEN);
}

function rejectUnauthorizedServerCredential(req: express.Request, res: express.Response, apiKey?: unknown): boolean {
  if (canUseServerCredential(req, apiKey)) return false;
  res.status(401).json({
    error: "server_credential_unauthorized",
    message: "服务端共享密钥已启用，请提供访问口令，或在应用内填写自己的 API 密钥。",
  });
  return true;
}

// Resilient model invocation with automatic failover (prefers gemini-3.8-flash and gemini-3.1-flash-lite)
async function generateWithResilientModels(
  ai: GoogleGenAI,
  preferredModel: string | undefined,
  requestParams: { contents: any; config?: any }
) {
  const normalizedModel = normalizeModelName(preferredModel);

  const modelsToTry = [
    normalizedModel,
    "gemini-3.8-flash",
    "gemini-3.1-flash-lite",
  ].filter((m, idx, arr): m is string => Boolean(m) && arr.indexOf(m) === idx);

  let lastErr: any = null;
  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: requestParams.contents,
        config: requestParams.config,
      });
      if (response && response.text) {
        return response;
      }
    } catch (err: any) {
      console.warn(`[Gemini Failover] Model '${model}' failed:`, redact(err?.message || err));
      lastErr = err;
    }
  }
  throw lastErr || new Error("All Gemini models were unavailable.");
}

// ── 统一模型调用层 ───────────────────────────────────────────────────
// Gemini 走原生 SDK（原逻辑保持不动）；其余主流服务商走 OpenAI 兼容协议。
// 加新服务商只需要在这里加分支，四个接口不用动。

type LLMProvider = "gemini" | "openai-compatible";

interface LLMCallOptions {
  /** 服务商预设 id（deepseek / moonshot / ...），或协议名（gemini / openai-compatible） */
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  prompt: string;
  /** 仅 Gemini 使用：原生结构化输出 schema */
  geminiSchema?: any;
}

/**
 * 把客户端传来的服务商标识解析成「调用协议 + 实际 Base URL」。
 *
 * 为什么必须有这一步：客户端传的是**预设 id**（`'deepseek'` / `'moonshot'` / ...），
 * 而调用层判断的是**协议名**（`'openai-compatible'`）。两者永不相等 —— 选了 DeepSeek
 * 也会掉进 Gemini 分支，拿着 `sk-` 密钥去请求 Google，然后静默降级成公开翻译。
 * 也就是「配置界面看起来配好了，实际从没生效过」。
 *
 * 另外预设的 Base URL 之前也没被送上来（客户端只传 `customBaseUrl`，留空时是空串），
 * 所以这里一并兜底：用户手填优先，其次用预设值。
 */
function resolveLLMTarget(providerId?: string, baseUrlOverride?: string): { protocol: LLMProvider; baseUrl: string } {
  const rawId = (providerId || "").trim();
  const override = (baseUrlOverride || "").trim();

  // 兼容早期直接传协议名的调用方
  if (rawId === "gemini" || rawId === "openai-compatible") {
    return { protocol: rawId as LLMProvider, baseUrl: override };
  }

  const preset = getPreset(rawId || DEFAULT_PROVIDER_ID);
  return { protocol: preset.provider, baseUrl: override || preset.baseUrl };
}

// 云平台的实例元数据地址。没有任何合法的模型服务跑在这里，
// 但它是「让服务器替我请求任意地址」这类漏洞最值钱的目标（能拿到临时凭证）。
// 只封这一段：本机和内网地址要留着，本地跑 Ollama / LM Studio 是正当用法。
const BLOCKED_UPSTREAM = [/^169\.254\./, /^metadata\./i, /^metadata$/i];

function assertSafeUpstream(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Base URL 不是合法网址，需要以 http:// 或 https:// 开头。");
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error("Base URL 只支持 http:// 或 https://。");
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const ipv4Parts = host.split('.').map(Number);
  const isPrivateIpv4 =
    isIP(host) === 4 &&
    ipv4Parts.length === 4 &&
    (ipv4Parts[0] === 0 ||
      ipv4Parts[0] === 10 ||
      ipv4Parts[0] === 127 ||
      (ipv4Parts[0] === 169 && ipv4Parts[1] === 254) ||
      (ipv4Parts[0] === 172 && ipv4Parts[1] >= 16 && ipv4Parts[1] <= 31) ||
      (ipv4Parts[0] === 192 && ipv4Parts[1] === 168));
  const isPrivateIpv6 = isIP(host) === 6 && (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:'));
  if (BLOCKED_UPSTREAM.some((re) => re.test(host)) || isPrivateIpv4 || isPrivateIpv6 || host === 'localhost' || host.endsWith('.local')) {
    throw new Error("该地址指向本机、内网或云平台元数据服务，已拒绝。");
  }
  return url;
}

// 把用户填的 Base URL 规整成 chat/completions 端点
function normalizeChatUrl(baseUrl: string): string {
  const trimmed = (baseUrl || "").trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("Base URL 未填写。");
  const full = /\/chat\/completions$/.test(trimmed) ? trimmed : `${trimmed}/chat/completions`;
  return assertSafeUpstream(full);
}

// OpenAI 兼容接口没有原生 schema 约束，模型常把 JSON 包在 ``` 里、或加前后缀说明。
// 容错顺序：剥代码围栏 → 直接 parse → 截取最外层 { } / [ ] 再 parse。
function parseJsonLoose(text: string): any {
  const raw = (text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : raw).trim();
  try {
    return JSON.parse(body);
  } catch {
    // 继续走截取
  }
  const starts = [body.indexOf("{"), body.indexOf("[")].filter((i) => i >= 0);
  if (starts.length === 0) throw new Error("模型返回内容里找不到 JSON。");
  const start = Math.min(...starts);
  const closeCh = body[start] === "{" ? "}" : "]";
  const end = body.lastIndexOf(closeCh);
  if (end <= start) throw new Error("模型返回的 JSON 不完整。");
  return JSON.parse(body.slice(start, end + 1));
}

async function postChatCompletions(
  url: string,
  apiKey: string,
  model: string,
  prompt: string,
  useJsonMode: boolean
): Promise<Response> {
  const payload: Record<string, unknown> = {
    model,
    messages: [
      {
        role: "system",
        content:
          "You reply with valid JSON only. No markdown code fences, no commentary before or after.",
      },
      { role: "user", content: prompt },
    ],
    stream: false,
  };
  if (useJsonMode) payload.response_format = { type: "json_object" };

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
}

async function callOpenAICompatible(opts: LLMCallOptions): Promise<string> {
  const apiKey =
    opts.apiKey ||
    process.env.OPENAI_COMPATIBLE_API_KEY ||
    process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("缺少 API 密钥。");
  const model = opts.model || "deepseek-flash";
  const url = normalizeChatUrl(opts.baseUrl || "");

  // 有些服务商不支持 response_format，失败就退回纯提示词约束
  let res = await postChatCompletions(url, apiKey, model, opts.prompt, true);
  if (!res.ok && (res.status === 400 || res.status === 422)) {
    console.warn(`[LLM] ${res.status} 可能是不支持 response_format，去掉后重试一次。`);
    res = await postChatCompletions(url, apiKey, model, opts.prompt, false);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`服务商返回 ${res.status}：${redact(detail).slice(0, 300)}`);
  }

  const data: any = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("服务商返回内容为空。");
  }
  return text;
}

/** 四个接口统一走这里 */
async function callLLM(opts: LLMCallOptions): Promise<string> {
  const target = resolveLLMTarget(opts.provider, opts.baseUrl);
  if (target.protocol === "openai-compatible") {
    return callOpenAICompatible({ ...opts, baseUrl: target.baseUrl });
  }
  const ai = getGeminiClient(opts.apiKey);
  const response = await generateWithResilientModels(ai, opts.model, {
    contents: opts.prompt,
    config: opts.geminiSchema
      ? { responseMimeType: "application/json", responseSchema: opts.geminiSchema }
      : { responseMimeType: "application/json" },
  });
  return response.text || "{}";
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ── 引擎自检 ─────────────────────────────────────────────────────────
// 用户点「开启引擎」时调这里。它回答的不是翻译问题，而是一个之前没人回答的问题：
// 「我填的密钥 + 模型名 + 地址，到底能不能用？」
// 没有这一步时，配置错了只会静默降级成公开翻译 —— 用户永远不知道自己配错了。

const VERIFY_TIMEOUT_MS = 20000;

/** 把上游错误压成一句人话，并确保密钥绝不回显 */
function describeUpstreamError(status: number, rawBody: string, apiKey: string): string {
  let body = redact(rawBody || "");
  if (apiKey.length >= 8) body = body.split(apiKey).join("[REDACTED]");
  body = body.slice(0, 200);

  if (status >= 500) return `服务商服务异常（HTTP ${status}）`;

  const byStatus: Record<number, string> = {
    400: "服务商拒绝了这次请求（多半是模型名或参数不对）",
    401: "密钥被拒绝：无效、已删除，或复制时少了字符",
    402: "账户余额不足",
    403: "这个密钥没有调用该模型的权限",
    404: "找不到该模型，或 Base URL 路径不对",
    422: "服务商不接受这次请求的参数",
    429: "触发限流或欠费限额",
  };
  const base = byStatus[status] || `服务商返回 HTTP ${status}`;
  return body ? `${base}｜${body}` : base;
}

/** 网络层直接抛异常时（DNS / 连接被拒 / 超时）—— 国内直连 Google 属于这一类 */
function describeNetworkError(err: any): string {
  const name = String(err?.name || "");
  const msg = redact(err?.message || err);
  if (name === "TimeoutError" || name === "AbortError") {
    return `连接超时（${VERIFY_TIMEOUT_MS / 1000} 秒无响应），地址可能被墙或填错了。`;
  }
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(msg)) return "域名解析失败，Base URL 可能拼错了。";
  if (/ECONNREFUSED/i.test(msg)) return "连接被拒绝，地址或端口不对。";
  return `连不上服务商：${String(msg).slice(0, 160)}`;
}

/**
 * 由 Base URL 推出「列模型」端点。
 * 用户既可能填 https://api.deepseek.com 也可能填完整端点，两种都要能推对。
 */
function modelsEndpointOf(baseUrl: string): string {
  const trimmed = (baseUrl || "").trim().replace(/\/+$/, "");
  return `${trimmed.replace(/\/chat\/completions$/, "")}/models`;
}

/**
 * 列出该密钥真正可用的 OpenAI 兼容模型。
 *
 * 存在的理由：厂商下线模型的节奏比我们发版快（moonshot-v1-* 一夜之间全没了）。
 * 用户拿着一个过期的模型名，只能看到「404」—— 而 404 既可能是路径错、也可能
 * 是模型名错，凭这句话猜不出该填什么。列出可用模型，就把这句死路变成一条出路。
 */
async function listOpenAICompatibleModels(baseUrl: string, apiKey: string): Promise<string[]> {
  try {
    const url = assertSafeUpstream(modelsEndpointOf(baseUrl));
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    return (data?.data || data?.models || [])
      .map((m: any) => String(m?.id || m?.name || ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function probeOpenAICompatible(baseUrl: string, apiKey: string, model: string) {
  let url: string;
  try {
    url = normalizeChatUrl(baseUrl);
  } catch (err: any) {
    return { ok: false as const, message: err?.message || "Base URL 未填写。" };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    // 只求一个最小往返：4 个 token 足够证明「密钥有效 + 模型存在 + 网络通」
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 4,
      stream: false,
    }),
    signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
  });

  if (res.ok) return { ok: true as const, message: `已连通，模型 ${model} 可用。` };

  const body = await res.text().catch(() => "");
  const detail = describeUpstreamError(res.status, body, apiKey);

  // 400 / 404 是「模型名过期」的高发区。能列出来就列出来 —— 用户照着改一个
  // 字符串就能救回来，而不是去翻厂商文档。
  if (res.status === 400 || res.status === 404) {
    const names = await listOpenAICompatibleModels(baseUrl, apiKey);
    if (names.length > 0 && !names.includes(model)) {
      const shown = names.slice(0, 5).join(" / ");
      const more = names.length > 5 ? ` 等 ${names.length} 个` : "";
      return {
        ok: false as const,
        message: `${detail}。\n该密钥当前可用：${shown}${more}`,
        // 界面会把它渲染成可点的按钮，一点就把模型名改对
        availableModels: names.slice(0, 12),
      };
    }
  }

  return { ok: false as const, message: detail };
}

/** 列出该密钥真正能用的 Gemini 模型，用于区分「密钥错」和「模型名错」 */
async function listGeminiModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=50", {
      headers: { "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    return (data?.models || [])
      .filter((m: any) => (m?.supportedGenerationMethods || []).includes("generateContent"))
      .map((m: any) => String(m?.name || "").replace(/^models\//, ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function probeGemini(apiKey: string, model: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] }),
    signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
  });

  if (res.ok) return { ok: true as const, message: `已连通，模型 ${model} 可用。` };

  if (res.status === 404) {
    const names = await listGeminiModels(apiKey);
    if (names.length > 0) {
      return {
        ok: false as const,
        message: `密钥有效，但模型「${model}」不存在。可用示例：${names.slice(0, 4).join(" / ")}`,
      };
    }
  }

  const body = await res.text().catch(() => "");
  return { ok: false as const, message: describeUpstreamError(res.status, body, apiKey) };
}

app.post("/api/verify-key", async (req, res) => {
  const { apiKey, provider, modelName, baseUrl } = req.body ?? {};
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!key) {
    return res.json({ ok: false, message: "请先填入 API 密钥。" });
  }

  const target = resolveLLMTarget(provider, baseUrl);
  const preset = getPreset((provider || DEFAULT_PROVIDER_ID) as string);
  const model = (typeof modelName === "string" && modelName.trim()) || preset.models[0] || "";

  if (!model) {
    return res.json({ ok: false, message: "请先填写模型名。" });
  }

  const startedAt = Date.now();
  try {
    const result =
      target.protocol === "openai-compatible"
        ? await probeOpenAICompatible(target.baseUrl, key, model)
        : await probeGemini(key, model);
    return res.json({
      ...result,
      model,
      protocol: target.protocol,
      latencyMs: Date.now() - startedAt,
    });
  } catch (err: any) {
    return res.json({
      ok: false,
      message: describeNetworkError(err),
      model,
      protocol: target.protocol,
      latencyMs: Date.now() - startedAt,
    });
  }
});

const ALLOWED_CATEGORIES = [
  "日常家务",
  "职场办公",
  "社交聚会",
  "购物消费",
  "出行旅游",
  "饮食健康",
  "兴趣爱好",
  "情感表达",
  "科技生活",
  "学习提升",
];

const SYSTEM_PROMPT = `角色定位：
你是一位精通当代美式或英式口语的专家，特别擅长捕捉英语母语年轻人（Gen Z/Millennials）的表达习惯。你的任务是将用户提供的任何信息转化为最自然、最地道的英语口语。

工作流与职责：
1. 核心翻译与润色：
标题：'地道母语表达' (natural)
在此标题后直接给出翻译或润色后的结果。只需给出一句最地道的表达，拒绝直译，拒绝列举多个类似表达。必须确保其符合当代母语者的日常闲聊、非正式场合的自然语感。

2. 记录原始表达：
标题：'我的原始表达' (original)
在此标题后记录用户提供的原始中文或英文内容。

3. 场景归类与标签提取：
- 根据内容将该表达归入以下十组中的一类 (category，必须且仅能是这十组之一)：
  日常家务、职场办公、社交聚会、购物消费、出行旅游、饮食健康、兴趣爱好、情感表达、科技生活、学习提升
- 提取核心关键词标签 (tags)，数量限制在3个以内（1-3个），且每个标签必须且仅能由 '2个字的名词' 组成（例如：聚餐、加班、面试、家务、通勤、做饭、网购、旅行、健身、摄影 等）。

4. 深度知识解析（150字以内） (explanation)：
- 采用分点提行的格式（使用 • 分点）。
- 如果输入是中文：解析为何采用该英语口语表达，其地道之处在哪里。
- 如果输入是英文：解析润色后的表达为何更自然。如果用户提供的英文已经足够地道，则无需强行修改，仅修正潜在语法错误并告知用户即可。
- 可视情况提供1个相关词组的地道同义表达。

行为约束：
- 禁止解释标签分类的逻辑或原因。
- 禁止提供直译内容。
- 禁止在回复结尾添加任何总结性、引导性或闲聊式的话语（如 '希望这能帮到你' 或 '还有什么想学的吗？'）。
- 专注于提升表达的口语化和地道程度。`;
 
// Single expression optimization
app.post("/api/optimize", async (req, res) => {
  const { input, modelName, apiKey, provider, baseUrl, category, tone } = req.body;
  if (!input || typeof input !== "string" || !input.trim()) {
    return res.status(400).json({ error: "Input text is required." });
  }
  if (input.trim().length > 4000) {
    return res.status(413).json({ error: "Input text is too long." });
  }
  if (rejectUnauthorizedServerCredential(req, res, apiKey)) return;

  const trimmedInput = input.trim();

  // 走统一模型调用层：Gemini 或任意 OpenAI 兼容服务商
  try {
    const redRibbonInstructions = `\n5. 【重点词标红】必须在 redHighlights 中返回 1-2 项，从 natural 原句里挑出最值得记忆的实义词、短语动词或习语搭配。硬性要求：
   - 每一项都必须逐字出现在 natural 原文中，原样保留大小写，否则前端匹配不上、红字不会显示。
   - 禁止挑句首的代词、冠词、助动词（I / It / This / The / My / There / I'm / Do 等）—— 这些词没有记忆价值。
   - 优先短语动词与固定搭配（如 staying up / pile up / circle back / come across）。`;

    const toneInstruction =
      tone === "正式"
        ? "\n用户指定表达风格：【正式风格】（请提供严谨得体、机要规范、适合职场、商务或正式书面交流的母语表达，避免过于随便的俚语或缩略口癖）"
        : "\n用户指定表达风格：【自然风格】（请提供地道母语口语表达，如当代母语者日常对话、熟人交流，生动鲜活，拒绝生硬直译）";

    const userPrefInstructions = [
      category ? `\n用户倾向场景分类：${category}（请优先以此场景生成表达）` : "",
      toneInstruction,
    ].filter(Boolean).join("");

    const prompt = `${SYSTEM_PROMPT}${redRibbonInstructions}${userPrefInstructions}

用户输入内容如下：
"${trimmedInput}"

请严格按照要求的结构输出 JSON 对象。`;

    const text = await callLLM({
      provider,
      model: modelName,
      apiKey,
      baseUrl,
      prompt,
      geminiSchema: {
          type: Type.OBJECT,
          properties: {
            original: { type: Type.STRING, description: "用户的原始中文或英文表达" },
            natural: { type: Type.STRING, description: "地道母语表达（仅1句最地道当代母语口语，拒绝直译）" },
            category: {
              type: Type.STRING,
              description: "场景归类，必须是指定十组之一：日常家务、职场办公、社交聚会、购物消费、出行旅游、饮食健康、兴趣爱好、情感表达、科技生活、学习提升",
            },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "核心关键词标签，3个以内，每个标签必须且仅能由2个字的名词组成（例如：聚餐、加班、面试）",
            },
            explanation: {
              type: Type.STRING,
              description: "深度知识解析（150字以内，采用分点提行格式，解析地道之处或修改原因，可提供1个相关词组同义表达）",
            },
            phrases: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  phrase: { type: Type.STRING },
                  pos: { type: Type.STRING },
                  meaning: { type: Type.STRING },
                  example: { type: Type.STRING },
                },
                required: ["phrase", "pos", "meaning", "example"],
              },
              description: "0-1个相关核心词组或地道同义表达",
            },
            redHighlights: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                "必填：从 natural 原句中逐字摘出的重点片段（1-2 项），挑实义词/短语动词/习语搭配，不要挑句首代词或冠词",
            },
          },
          required: ["original", "natural", "explanation", "category", "tags", "phrases", "redHighlights"],
        },
    });

    const parsed = parseJsonLoose(text);

    // Fallback sanitation to guarantee constraints
    if (!ALLOWED_CATEGORIES.includes(parsed.category)) {
      parsed.category = "日常家务";
    }
    if (Array.isArray(parsed.tags)) {
      parsed.tags = parsed.tags.slice(0, 3).map((t: string) => (t.length > 2 ? t.slice(0, 2) : t));
    }

    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.warn("Gemini API call error in /api/optimize, using multi-tier translation fallback:", redact(error));
    
    // 1. Check curated native inspiration database
    const inspirationMatch = findInspirationMatch(trimmedInput);
    if (inspirationMatch) {
      const cardData = inspirationToOptimizationResult(inspirationMatch, trimmedInput);
      if (!cardData.redHighlights || cardData.redHighlights.length === 0) {
        cardData.redHighlights = pickCoreHighlights(cardData.natural);
      }
      return res.json({ success: true, data: cardData, isOfflineFallback: true });
    }

    // 2. Fetch faithful translation from translation service
    const onlineTranslated = await fetchOnlineTranslation(trimmedInput);
    if (onlineTranslated) {
      const categoryFromWords = (category && ALLOWED_CATEGORIES.includes(category)) ? category : detectCategory(trimmedInput);
      const tagsFromWords = detectTags(trimmedInput, categoryFromWords);
      const words = onlineTranslated.split(" ");
      const corePhrase = words.slice(0, Math.min(3, words.length)).join(" ");
      
      const translationResult = {
        original: trimmedInput,
        natural: onlineTranslated,
        category: categoryFromWords,
        tags: tagsFromWords,
        explanation: `• 针对「${trimmedInput}」，地道母语表达为「${onlineTranslated}」。\n• 语义精准对应，句式自然贴合真实交际场景。`,
        phrases: [
          {
            phrase: corePhrase,
            pos: "核心搭配",
            meaning: trimmedInput.slice(0, 10),
            example: onlineTranslated,
          },
        ],
        variants: {
          casual: onlineTranslated,
          neutral: onlineTranslated,
          formal: onlineTranslated,
        },
        redHighlights: pickCoreHighlights(onlineTranslated),
      };
      return res.json({ success: true, data: translationResult, isOfflineFallback: true });
    }

    // 3. Spoken semantic translator
    const fallbackData = translateSpokenInput(trimmedInput);
    if (!fallbackData.redHighlights || fallbackData.redHighlights.length === 0) {
      fallbackData.redHighlights = pickCoreHighlights(fallbackData.natural);
    }
    return res.json({ success: true, data: fallbackData, isOfflineFallback: true });
  }
});

// Batch optimize multiple sentences
app.post("/api/batch-optimize", async (req, res) => {
  const { items, modelName, apiKey, provider, baseUrl } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Items array is required." });
  }
  if (items.length > 50 || items.some((item) => typeof item !== "string" || item.trim().length === 0 || item.length > 4000)) {
    return res.status(413).json({ error: "批量内容最多 50 条，每条最多 4000 个字符。" });
  }
  if (rejectUnauthorizedServerCredential(req, res, apiKey)) return;

  try {
    const prompt = `${SYSTEM_PROMPT}

请批量将以下 ${items.length} 个用户表达转化为标准卡片结构：
${items.map((it, idx) => `${idx + 1}. ${it}`).join("\n")}

请返回 JSON 数组。每个对象包含：
- original: 用户原始输入
- natural: 地道母语表达（仅一句最地道表达，拒绝直译）
- category: 固定十组之一（日常家务、职场办公、社交聚会、购物消费、出行旅游、饮食健康、兴趣爱好、情感表达、科技生活、学习提升）
- tags: 3个以内的标签，每个必须且仅能由2个字的名词组成
- explanation: 150字以内的深度知识解析（分点提行格式）
- phrases: 包含0-1个相关词组`;

    const text = await callLLM({
      provider,
      model: modelName,
      apiKey,
      baseUrl,
      prompt,
      geminiSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              original: { type: Type.STRING },
              natural: { type: Type.STRING },
              category: { type: Type.STRING },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              explanation: { type: Type.STRING },
              phrases: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    phrase: { type: Type.STRING },
                    pos: { type: Type.STRING },
                    meaning: { type: Type.STRING },
                    example: { type: Type.STRING },
                  },
                  required: ["phrase", "pos", "meaning", "example"],
                },
              },
            },
            required: ["original", "natural", "explanation", "category", "tags", "phrases"],
          },
        },
    });

    const raw = parseJsonLoose(text);
    const parsed: any[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw?.items)
          ? raw.items
          : [];
    const sanitized = parsed.map((item: any) => ({
      ...item,
      category: ALLOWED_CATEGORIES.includes(item.category) ? item.category : "日常家务",
      tags: Array.isArray(item.tags)
        ? item.tags.slice(0, 3).map((t: string) => (t.length > 2 ? t.slice(0, 2) : t))
        : ["口语", "表达"],
    }));

    return res.json({ success: true, data: sanitized });
  } catch (error: any) {
    console.warn("Batch optimization error, using multi-tier translation fallback:", redact(error));
    const fallbackResults = await Promise.all(
      items.map(async (it: string) => {
        const inspirationMatch = findInspirationMatch(it);
        if (inspirationMatch) {
          return inspirationToOptimizationResult(inspirationMatch, it);
        }
        const online = await fetchOnlineTranslation(it);
        if (online) {
          const category = detectCategory(it);
          const tags = detectTags(it, category);
          const words = online.split(" ");
          return {
            original: it,
            natural: online,
            category,
            tags,
            explanation: `• 针对「${it}」，地道母语表达为「${online}」。\n• 句意精准对应。`,
            phrases: [
              {
                phrase: words.slice(0, Math.min(2, words.length)).join(" "),
                pos: "核心表达",
                meaning: it.slice(0, 8),
                example: online,
              },
            ],
          };
        }
        return translateSpokenInput(it);
      })
    );
    return res.json({ success: true, data: fallbackResults, isOfflineFallback: true });
  }
});

// Story generation from cards (Dialogue & Story Script logic)
app.post("/api/generate-story", async (req, res) => {
  try {
    const { cards, topic, style, modelName, apiKey, provider, baseUrl } = req.body;

    if (!Array.isArray(cards) || cards.length > 30) {
      return res.status(400).json({ error: "cards 必须是最多 30 张卡片的数组。" });
    }
    if (typeof topic === "string" && topic.length > 1000) {
      return res.status(413).json({ error: "故事主题不能超过 1000 个字符。" });
    }
    if (rejectUnauthorizedServerCredential(req, res, apiKey)) return;

    const cardListStr = (cards || [])
      .map((c: any) => `- [ID: ${c.id || "c"}] "${c.natural}" (中文原意: ${c.original})`)
      .join("\n");

    const prompt = `你是一位当代美剧/英剧对话编剧与地道英语大师。
请使用以下用户知识库中的地道英语表达，创作一篇结构严谨、生动幽默的情景生活对话剧本（约150-250词）：

故事主题/场景设定：${topic || "日常生活对话与偶遇"}
文风风格：${style || "影视剧本/当代生活对话 (Gen Z / Millennials)"}

用户地道表达素材库：
${cardListStr}

剧本格式与要求：
1. 剧本结构：
   - 包含 **Characters:** 人物介绍（2人左右，简短幽默设定）
   - 包含 **(Scene: ...)** 场景与动作描写
   - 包含角色轮流对话，角色名加冒号（如 Zoe: "...", Jake: "..."）
   - 对话中可包含生动的动作指示，如 *(Yawns loudly)*, *(Laughs)*, *(Glued to the screen)*
2. 重点表达嵌入：
   - 必须在对话中自然融入用户素材卡片中的表达，并用 **双星号粗体** 明确标出（例如：Zoe: "**Is this your profile pic?** It's nice."）
3. 中文对照翻译：
   - 翻译同样包含 **人物：**、**(场景：...)** 与对应的角色对话，并在中文中用 **双星号粗体** 标出对应重点表达。
4. 返回使用的卡片 ID 列表 (matchedCardIds)。

请返回 JSON 格式：
{
  "title": "英文故事标题",
  "content": "英文剧本全文（包含人物、场景设定与用 ** 加粗的重点表达）",
  "translation": "中文对照翻译（包含对应的人物、场景与加粗中文）",
  "matchedCardIds": ["使用的卡片ID列表"]
}`;

    const text = await callLLM({
      provider,
      model: modelName,
      apiKey,
      baseUrl,
      prompt,
    });

    const parsed = parseJsonLoose(text);
    const result = {
      title: parsed.title || "Daily Conversation Dialogue",
      content: parsed.content || parsed.englishContent || parsed.storyEn || "",
      englishContent: parsed.content || parsed.englishContent || parsed.storyEn || "",
      translation: parsed.translation || parsed.chineseTranslation || parsed.storyZh || "",
      chineseTranslation: parsed.translation || parsed.chineseTranslation || parsed.storyZh || "",
      matchedCardIds: Array.isArray(parsed.matchedCardIds)
        ? parsed.matchedCardIds
        : (cards || []).map((c: any) => c.id).filter(Boolean),
      highlightedCards: Array.isArray(parsed.matchedCardIds)
        ? parsed.matchedCardIds
        : (cards || []).map((c: any) => c.id).filter(Boolean),
    };

    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Story generation error:", redact(error));
    return res.status(500).json({
      error: error.message || "Failed to generate story.",
    });
  }
});

// Speech pronunciation evaluation & feedback with 4-dimension scoring & word-level analysis
app.post("/api/evaluate-speech", async (req, res) => {
  const { targetText, recognizedText, modelName, apiKey, provider, baseUrl } = req.body;
  if (!targetText) {
    return res.status(400).json({ error: "targetText is required." });
  }
  if (typeof targetText !== "string" || targetText.trim().length > 1000 || (typeof recognizedText === "string" && recognizedText.length > 4000)) {
    return res.status(413).json({ error: "语音评测文本长度超出限制。" });
  }
  if (rejectUnauthorizedServerCredential(req, res, apiKey)) return;

  const cleanTarget = targetText.trim();
  const cleanRecognized = (recognizedText || "").trim();

  // Helper for local algorithmic fallback
  const generateLocalWordAnalysis = () => {
    const targetWords = cleanTarget.split(/\s+/).map((w: string) => w.replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, ""));
    const spokenTokens = cleanRecognized.toLowerCase().split(/\s+/).map((w: string) => w.replace(/[^a-z0-9']/g, ""));
    
    let matchedCount = 0;
    const words = targetWords.map((word: string) => {
      const cleanW = word.toLowerCase().replace(/[^a-z0-9']/g, "");
      if (!cleanW) return { word, status: "correct" as const };
      
      const isExact = spokenTokens.includes(cleanW);
      const isPartial = spokenTokens.some((st: string) => st.includes(cleanW) || cleanW.includes(st));
      
      if (isExact) {
        matchedCount += 1;
        return { word, status: "correct" as const, tip: "发音清晰标准" };
      } else if (isPartial) {
        matchedCount += 0.6;
        return { word, status: "warning" as const, tip: "略有吞音或轻重读偏差" };
      } else {
        return { word, status: "incorrect" as const, tip: "未识别到或发音不清晰" };
      }
    });

    const completeness = Math.min(100, Math.round((cleanRecognized.split(/\s+/).length / Math.max(1, targetWords.length)) * 100));
    const accuracy = Math.min(100, Math.round((matchedCount / Math.max(1, targetWords.length)) * 100));
    const fluency = accuracy >= 80 ? 92 : accuracy >= 50 ? 78 : 60;
    const prosody = accuracy >= 80 ? 90 : accuracy >= 50 ? 75 : 55;
    const score = Math.round(accuracy * 0.4 + fluency * 0.25 + completeness * 0.2 + prosody * 0.15);

    let feedback = "整体发音自然，注意句子停顿与重音节奏。";
    let encouragement = "继续保持，开口说就是最好的练习！";
    if (score >= 85) {
      feedback = "语音语调非常地道，节奏与连读自然流畅，重音把握十分到位！";
      encouragement = "太棒了！母语级语感正在肌肉中生根发芽！✨";
    } else if (score >= 60) {
      feedback = "整体表达完整，建议注意词尾辅音的清晰度以及实词与虚词的节奏强弱对比。";
      encouragement = "发音很清晰，再来一次尝试更加自信流畅地连读！👍";
    } else {
      feedback = "建议先点击'朗读'仔细体会母语者的重音位置与语调起伏，再尝试跟读。";
      encouragement = "慢慢来，每天大声跟读几遍，语感会越来越好！💪";
    }

    return {
      score,
      accuracy,
      fluency,
      completeness,
      prosody,
      feedback,
      encouragement,
      words,
    };
  };

  try {
    const prompt = `用户正在进行英语口语跟读与发音测评。
目标英文句子： "${cleanTarget}"
用户实际录音识别文本： "${cleanRecognized || '(未识别到声音)'}"

请对用户的口语表现进行专业、细致的多维度评测：
1. 四个维度的百分制评分 (0-100分整数)：
   - accuracy: 准确度 (单词发音与音素准确率)
   - fluency: 流畅度 (停顿、语速与连贯性)
   - completeness: 完整度 (句子是否读全、无遗漏)
   - prosody: 韵律与语调 (句子重音、语调升降与抑扬顿挫)
2. score: 综合加权总分 (0-100分)
3. words: 针对目标句中的每一个单词逐一分析其发音状态：
   - word: 单词原词
   - status: "correct" (发音准确地道), "warning" (轻度模糊/重音稍有偏差), "incorrect" (严重误读/漏读)
   - ipa: 音标 (如 /ˈækjərət/)
   - tip: 具体的发音或连读技巧提醒 (例如："注意首音节重读", "与下一个词产生连读")
4. feedback: 深入点评建议 (80字以内，指出具体的发音亮点或需要注意的连读/重音)
5. encouragement: 温暖鼓舞人心的激励金句 (25字以内)

请严格返回 JSON 格式：
{
  "score": 90,
  "accuracy": 92,
  "fluency": 88,
  "completeness": 95,
  "prosody": 86,
  "feedback": "...",
  "encouragement": "...",
  "words": [
    { "word": "example", "status": "correct", "ipa": "/ɪɡˈzæmpl/", "tip": "发音饱满" }
  ]
}`;

    const text = await callLLM({
      provider,
      model: modelName,
      apiKey,
      baseUrl,
      prompt,
    });

    const parsed = parseJsonLoose(text);
    const safeData = {
      score: typeof parsed.score === "number" ? parsed.score : 85,
      accuracy: typeof parsed.accuracy === "number" ? parsed.accuracy : 88,
      fluency: typeof parsed.fluency === "number" ? parsed.fluency : 85,
      completeness: typeof parsed.completeness === "number" ? parsed.completeness : 90,
      prosody: typeof parsed.prosody === "number" ? parsed.prosody : 82,
      feedback: parsed.feedback || "发音整体准确，建议进一步强化重音节奏。",
      encouragement: parsed.encouragement || "太棒了！开口说就是建立语感的捷径！",
      words: Array.isArray(parsed.words) && parsed.words.length > 0 ? parsed.words : generateLocalWordAnalysis().words,
    };

    return res.json({ success: true, data: safeData });
  } catch (error: any) {
    console.warn("Speech AI eval error, falling back to local word analysis:", redact(error));
    const localData = generateLocalWordAnalysis();
    return res.json({ success: true, data: localData });
  }
});

// Start Express + Vite
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // 动态引入：vite 属于 devDependency，生产环境不需要它。
    // 若写在文件顶部静态 import，打包后 server.cjs 会在启动瞬间就 require("vite")，
    // 一旦部署平台只安装生产依赖，启动即崩（MODULE_NOT_FOUND）。
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    // 带内容哈希的资源（assets/index-<hash>.js）可以长缓存；
    // 但入口文件与 Service Worker 不带哈希，一旦被 immutable 长缓存，
    // 下次部署后用户会永远拿到旧版 index.html，PWA 也无法自愈。
    const noCachePattern =
      /(?:index\.html|sw\.js|registerSW\.js|manifest\.webmanifest|manifest\.json)$/i;
    app.use(
      express.static(distPath, {
        maxAge: "1y",
        immutable: true,
        setHeaders: (res, filePath) => {
          if (noCachePattern.test(filePath)) {
            res.setHeader("Cache-Control", "no-cache");
          }
        },
      })
    );
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`LingoLog Server running on http://0.0.0.0:${PORT}`);
  console.log(
    `[AI] 服务端 Gemini 密钥：${
      process.env.GEMINI_API_KEY
        ? "已配置（注意：公网访客会消耗你的额度）"
        : "未配置（默认状态，走公开翻译降级；用户可在应用内填自己的密钥）"
    }`
  );
  console.log(
    `[AI] 服务端 DeepSeek / OpenAI 兼容密钥：${
      process.env.DEEPSEEK_API_KEY || process.env.OPENAI_COMPATIBLE_API_KEY
        ? "已配置（作为用户未填密钥时的兜底）"
        : "未配置（用户需在设置里填自己的密钥）"
    }`
  );
  console.log(`[AI] 支持的调用协议：gemini / openai-compatible（DeepSeek、Kimi、通义、智谱、OpenAI 等）`);
  });
}

startServer();
