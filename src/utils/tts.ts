// Text-to-Speech & Speech Recognition Helper
//
// 这个文件只回答一个问题：在这台设备上，用哪条路能放出最接近母语者的英文声音。
//
// 一共有三条路，按启用顺序：
//   0. 服务端合成的 MP3（`/api/tts`）。**只在手机端启用** —— 手机读的是设备自带
//      的 TTS 引擎，网页层换不掉，只能从服务端拿一段同样是神经音色的音频。
//      桌面端不启用：桌面 Edge / Chrome 自带在线神经音色，直接播是零延迟的，
//      绕一趟服务端纯属更慢。
//   A. 浏览器自带的语音合成（speechSynthesis）。桌面 Edge 的
//      "Microsoft ... Online (Natural)"、Chrome 的 Google 音色都属于这一类，质量最好。
//   B. 有道词典的真人音频流。浏览器合成不可用时的备选（注意：整句必然 500，实测过）。
//
// 这里记着两个真实踩过的坑，免得再犯：
//
//   1. 过去是用 User-Agent 判断「是不是手机」，只要 UA 里有 Mobile 就强制走 B。
//      于是手机 Edge 明明带着自己的神经音色，却永远上不了桌 ——
//      「手机 Edge 发音机械、桌面 Edge 很真实」就是这么来的。
//      判断依据应该是**这台设备实际有哪些音色**，而不是它自称是什么设备。
//      （现在 UA 只用来做一件事：判断要不要启用路线零。见 isMobileClient。）
//
//   2. 过去所有失败路径都是静默 resolve()。用户点了朗读没声音，界面上一个字都没有，
//      只能得出「这个按钮是坏的」。现在失败会派发 lingolog-speech-notice 事件，
//      由 App 层显示出来。宁可直说「这台浏览器没有可用的英文音色」，也不要装死。

/** 朗读失败/不支持的提示事件名。App.tsx 监听它并显示给用户。 */
export const SPEECH_NOTICE_EVENT = 'lingolog-speech-notice';

export interface SpeechNoticeDetail {
  /** unsupported: 这台浏览器根本不具备朗读能力；failed: 有能力但没播出来 */
  kind: 'unsupported' | 'failed' | 'blocked';
  message: string;
}

let lastNotice = { message: '', at: 0 };

function notify(message: string, kind: SpeechNoticeDetail['kind'] = 'failed') {
  if (typeof window === 'undefined') return;
  // 同一个原因连续点几次只提示一次，避免刷屏
  const now = Date.now();
  if (lastNotice.message === message && now - lastNotice.at < 4000) return;
  lastNotice = { message, at: now };
  try {
    window.dispatchEvent(
      new CustomEvent<SpeechNoticeDetail>(SPEECH_NOTICE_EVENT, { detail: { kind, message } })
    );
  } catch {}
}

let currentAudio: HTMLAudioElement | null = null;

/**
 * 每次朗读的编号。用来判断「这次朗读是不是已经被下一次点击取代了」。
 *
 * 为什么需要它：路线零失败时不是直接返回，而是继续往下走别的音源，中间隔着
 * 好多个 await。用户连点两下时，第一次那串 await 会在第二次点击之后才继续执行 ——
 * 于是它会拿设备音色再念一遍，和第二串正在播的服务端音频叠在一起，两个人同时说话。
 * （这个文件顶部第 2 条精神的反面：静默失败不好，但"静默多念一遍"更糟。）
 */
let speechToken = 0;

function stopCurrentPlayback() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {}
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

/**
 * 给一个英文音色打分，分数越高越接近母语者。0 表示这个音色不能用。
 *
 * 分档依据是「合成方式」而不是「名字好不好听」：神经/云端合成（Natural / Online /
 * Neural）和 Google 的音色是有声学模型撑着的；localService 的本地音色只是
 * 规则拼接，机械感明显 —— 能出声，但拿它练听力的价值有限。
 */
function scoreEnglishVoice(v: SpeechSynthesisVoice): number {
  if (!v || !v.lang || !/^en([-_]|$)/i.test(v.lang)) return 0;
  const name = v.name || '';
  if (/natural/i.test(name)) return 100;
  if (/neural/i.test(name)) return 95;
  if (/online/i.test(name)) return 90;
  if (/google/i.test(name)) return 85;
  if (/\bsiri\b/i.test(name)) return 80;
  if (v.localService === false) return 60; // 云端音色但名字没给线索
  return 40; // 纯本地规则合成
}

/** 能被当成「像样的母语音色」的门槛。低于它的只配当最后兜底。 */
const GOOD_VOICE_SCORE = 60;

/**
 * 取音色列表。Chrome / Android 上首次调用 getVoices() 可能返回空数组，
 * 需要等 voiceschanged —— 但这段等待会打断「用户手势 → 发声」的调用链，
 * iOS Safari 会因此拒绝播放。所以最多只等 600 毫秒，超时就用现有的列表
 * （拿不到音色就不指定 voice，让浏览器用默认音色先出声）。
 */
function resolveVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve([]);
      return;
    }
    const synth = window.speechSynthesis;
    const immediate = synth.getVoices();
    if (immediate && immediate.length) {
      resolve(immediate);
      return;
    }

    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      try {
        synth.removeEventListener('voiceschanged', done);
      } catch {}
      resolve(synth.getVoices() || []);
    };
    try {
      synth.addEventListener('voiceschanged', done);
    } catch {}
    setTimeout(done, 600);
  });
}

/** 按语速估算这段文字大约要读多久，用于给语音引擎设一个「总得有个结果」的闸门 */
function estimateSpeechMs(text: string, rate: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length || 1;
  const seconds = (words / 150) * 60 / Math.max(0.5, rate);
  return Math.min(60000, Math.max(4000, seconds * 1000));
}

/**
 * 用浏览器自带的语音合成朗读。
 *
 * 返回 false 只代表「这次没有成功出声」，可能是引擎没响应、也可能是被系统打断。
 * 调用方**不应该**在拿到 false 之后立刻换另一个音源重放 —— 有些实现是
 * 「报错但声音已经在播」，重放会变成两个人同时说话。这里的 false 只用于提示。
 */
function speakWithBrowserVoice(
  cleanText: string,
  rate: number,
  voice?: SpeechSynthesisVoice
): Promise<boolean> {
  return new Promise((resolve) => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!synth) {
      resolve(false);
      return;
    }

    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      resolve(ok);
    };

    // 手机上 speechSynthesis 有时既不触发 onend 也不触发 onerror
    // （被系统音频会话抢占、切到后台、来电打断）。没有这道闸门，
    // Promise 会永远挂着，用户第二次点击也没有任何反应。
    const guard = setTimeout(() => finish(false), estimateSpeechMs(cleanText, rate) + 5000);

    try {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = voice?.lang || 'en-US';
      utterance.rate = rate;
      utterance.pitch = 1.0;
      if (voice) utterance.voice = voice;

      utterance.onend = () => finish(true);
      utterance.onerror = (event: any) => {
        const code = String(event?.error || '');
        // interrupted / canceled 通常是我们自己 cancel 造成的，不算失败
        const selfInflicted =
          code === 'interrupted' || code === 'canceled' || code === 'cancelled';
        if (!selfInflicted && (code === 'not-allowed' || code === 'audio-busy')) {
          notify('浏览器拦下了这次朗读。请确认页面没有静音，或先在页面上点一下再试。', 'blocked');
        }
        finish(selfInflicted);
      };

      synth.speak(utterance);
    } catch {
      finish(false);
    }
  });
}

/** 用有道词典的真人音频流朗读。返回 false 表示这次确定没有发出声音。 */
function speakWithRemoteAudio(cleanText: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    try {
      // type=2 美音，type=1 英音
      const audioUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(
        cleanText
      )}&type=2`;
      const audio = new Audio(audioUrl);
      // 这里过去有一句 crossOrigin = 'anonymous'。有道的音频响应里**没有任何 CORS 头**
      // （实测：带 Origin 和不带 Origin 都没有 Access-Control-Allow-Origin），
      // 一旦要求按 CORS 模式加载，浏览器判定失败直接触发 onerror —— 声音永远不出来。
      // 不设 crossOrigin 时按普通媒体请求加载，能正常播。不要加回来。
      currentAudio = audio;

      audio.onended = () => {
        currentAudio = null;
        finish(true);
      };
      audio.onerror = () => {
        currentAudio = null;
        finish(false);
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          currentAudio = null;
          finish(false);
        });
      }
      // 兜底闸门：极少数浏览器既不给 onerror 也不给 play() 的 reject
      setTimeout(() => {
        if (!settled) finish(false);
      }, estimateSpeechMs(cleanText, 0.95) + 8000);
    } catch {
      currentAudio = null;
      finish(false);
    }
  });
}

// ── 路线零：服务端合成（只在手机端启用）──────────────────────────────
//
// 手机发音机械，根因不在这份代码里：安卓 Edge / vivo 浏览器读的是**设备自带**的
// TTS 引擎，网页层换不掉它。唯一的出口是把合成放到服务端，用同一批神经音色
// 合成一段 MP3，再从自己的域名同源播放 —— 同源音频不受任何语音 API 的限制。
//
// 音色只指定一个，不再按设备挑。换声音改这一行，或直接改服务端的 TTS_VOICE。
const SERVER_TTS_VOICE = 'en-GB-RyanNeural';

/** 服务端 URL 里带着原文，太长（或平台截断它）会让语义变得莫名其妙，干脆不走。 */
const SERVER_TTS_MAX_TEXT = 400;

/**
 * 整条路的总闸门：冷启动 + 合成 + 传输。
 *
 * 必须**宽于**服务端自己的总上限（edgeTts.ts 里 TOTAL_DEADLINE_MS = 15 秒），
 * 否则前端会先放弃、白等一次回退，而服务端一两秒后其实就返回了。
 * 20 秒 = 服务端上限 + 5 秒传输余量。只有两种情况会撞到它：函数冷启动卡住、
 * 或者手机网络彻底不通。正常情况下第一次点某句约 1~2 秒，之后是缓存、即点即响。
 */
const SERVER_TTS_GUARD_MS = 20000;

/**
 * 是不是手机端（含平板、以及 UA 自称 Macintosh 的 iPadOS）。
 *
 * 这里用 UA 是**有意的**，和上面第 1 条坑不冲突：那条坑是「用 UA 决定音色选择」，
 * 那条是错的。而「要不要走服务端合成」本来就是设备形态问题 —— 服务的对象是
 * 「系统音色换不掉」的那类设备，桌面端（尤其桌面 Edge）不该被它拖慢。
 */
function isMobileClient(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPod|Android|Mobile|HarmonyOS|Windows Phone|SymbianOS/i.test(ua)) return true;
  // iPadOS 13+ 默认 UA 是 Macintosh，改用触摸点数区分触屏 Mac 形态的 iPad
  return /Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1;
}

/**
 * 静默预热/预加载当前电文的英伦男声音频。
 * 在卡片展示、弹窗打开时调用，利用用户阅读的 1~2 秒提前在后台获取并缓存在浏览器中。
 * 当用户点击「朗读电文」时实现 0.05 秒瞬时秒播，彻底避免移动端手势过期被拦截。
 */
const prefetchedUrls = new Set<string>();

export function prefetchEnglishText(text: string, rate: number = 0.95): void {
  if (typeof window === 'undefined') return;
  const cleanText = (text || '').replace(/[*_~`]/g, '').trim();
  if (!cleanText || cleanText.length > SERVER_TTS_MAX_TEXT) return;

  const url = `/api/tts?t=${encodeURIComponent(cleanText)}&v=${SERVER_TTS_VOICE}&r=${rate}`;
  if (prefetchedUrls.has(url)) return;
  prefetchedUrls.add(url);

  if (prefetchedUrls.size > 100) {
    const firstKey = prefetchedUrls.values().next().value;
    if (firstKey) prefetchedUrls.delete(firstKey);
  }

  try {
    if ('fetch' in window) {
      fetch(url, { priority: 'low' as any, cache: 'force-cache' }).catch(() => {});
    } else {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = url;
    }
  } catch {}
}

/**
 * 用服务端合成的 MP3 朗读。
 *
 * 形状和有道那条一样：同步 new Audio + 立刻 play()，让播放调用留在用户点击的
 * 手势链里（第一次出声可能要等一两秒去合成，但「开始播放」这个动作是同步发出的，
 * 国产内核才认）。
 *
 * 地址里的 t/v/r 三个参数完全决定音频内容，所以同一个句子的 URL 永远相同 ——
 * 浏览器磁盘缓存命中时不会再发请求，也就不会重复合成。这条性质是整个方案
 * 能"一直学下去也不变慢"的基础，改动 URL 组成时要一起考虑。
 */
function speakWithServerTts(cleanText: string, rate: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let guard: ReturnType<typeof setTimeout> | undefined;

    const finish = (ok: boolean, audio?: HTMLAudioElement) => {
      if (settled) return;
      settled = true;
      if (guard) clearTimeout(guard);
      if (audio && currentAudio === audio) currentAudio = null;
      resolve(ok);
    };

    try {
      const url = `/api/tts?t=${encodeURIComponent(cleanText)}&v=${SERVER_TTS_VOICE}&r=${rate}`;
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = url;
      currentAudio = audio;

      // 起播之后必须换一道闸门。16 秒是「还没出声」的上限，而一句长电文
      // 光念完就可能超过它 —— 不换闸门会把长句在半路掐断。
      audio.onplaying = () => {
        if (guard) clearTimeout(guard);
        guard = setTimeout(() => {
          try {
            audio.pause();
          } catch {}
          // 已经响过了，算成功。报 false 会让调用方接着用另一个音色重播，
          // 变成两个人同时说话。
          finish(true, audio);
        }, estimateSpeechMs(cleanText, rate) + 8000);
      };
      audio.onended = () => finish(true, audio);
      audio.onerror = () => finish(false, audio);

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        // 这里失败通常意味着服务端返回了 4xx/5xx（不是音频）。交给回退链路。
        playPromise.catch((err) => {
          console.warn('[TTS] audio.play() promise catch:', err);
          finish(false, audio);
        });
      }

      guard = setTimeout(() => {
        try {
          audio.pause();
        } catch {}
        finish(false, audio);
      }, SERVER_TTS_GUARD_MS);
    } catch {
      finish(false);
    }
  });
}

/**
 * 音色列表的本地缓存。
 *
 * Chrome / Android 上首次调用 getVoices() 往往返回空数组，要等 voiceschanged。
 * 但那意味着「等」—— 而等待会打断「用户点击 → 发声」的手势链，iOS Safari 和不少
 * 国产内核会因此拒绝播放。策略改成：缓存最近一次拿到的列表，点击时优先读缓存，
 * **一次 await 都不做**；只有缓存为空时才退回「先试一遍，失败后再等一次」。
 */
let voicesCache: SpeechSynthesisVoice[] = [];

function getVoicesSync(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  try {
    const v = window.speechSynthesis.getVoices() || [];
    if (v.length) voicesCache = v;
  } catch {}
  return voicesCache;
}

/** 脚本加载时预热一次，并跟随 voiceschanged 刷新 —— 让第一次点击就有缓存可用 */
if (typeof window !== 'undefined' && window.speechSynthesis) {
  try {
    getVoicesSync();
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      getVoicesSync();
    });
  } catch {}
}

function rankVoices(voices: SpeechSynthesisVoice[]) {
  return voices
    .map((v) => ({ v, score: scoreEnglishVoice(v) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

export async function speakEnglishText(text: string, rate: number = 0.95): Promise<void> {
  if (typeof window === 'undefined') return;

  stopCurrentPlayback();
  const token = ++speechToken;

  // 清掉 markdown 的星号等标记，它们会被逐字读出来
  const cleanText = (text || '').replace(/[*_~`]/g, '').trim();
  if (!cleanText) return;

  const synth = window.speechSynthesis;

  // 上面几行到这里是同步的，**一个 await 都没有** —— 音色列表取自缓存，所以下面
  // 第一次 speak()/play() 仍然落在「用户点击」的同步调用栈里。过去这里先
  // await resolveVoices()（最多 600ms），手势链直接断掉，国产内核因此拒绝播放：
  // 这是「手机上再也不出声」的主因之一。
  //
  // 唯一的例外是手机端的路线零：它本来就要走网络，await 之前已经把播放调出去了。
  const voices = getVoicesSync();
  const ranked = rankVoices(voices);
  const best = ranked[0]?.v;
  const hasGoodVoice = Boolean(ranked[0] && ranked[0].score >= GOOD_VOICE_SCORE);

  // 路线零（仅手机端）：服务端合成的 MP3。
  //
  // 放在最前面，是因为手机上「设备音色」这条路的天花板就在那里 —— 再怎么调
  // 也是系统 TTS 的机械音。手机端先试服务端，拿到的是和桌面 Edge 同一批的
  // 神经音色；拿不到才退回下面原本那套（桌面端完全不受影响，一步都不会多走）。
  //
  // 注意 `triedServerTts`：它同时用于跳过路线二。手机刚才已经在"在线音源"上
  // 失败过一次，再拿有道试一遍只是白白多等两秒 —— 而且有道对整句必然 500。
  let triedServerTts = false;
  if (isMobileClient() && cleanText.length <= SERVER_TTS_MAX_TEXT) {
    triedServerTts = true;
    const ok = await speakWithServerTts(cleanText, rate);
    if (ok) return;
    // 这次朗读已经被下一次点击取代了：什么都别做，否则会和新的那次叠着出声
    if (token !== speechToken) return;
    console.warn('[TTS] 服务端发音没拿到，回退到设备自带音色');
  }

  // 路线一：这台设备本来就有像样的英文音色（桌面 Edge、Chrome、iOS Siri 都在这里）
  // 移动端特别处理：安卓设备上的本地 TTS（如 Google 语音服务/系统拼读）音色粗劣机械，
  // 只有在确定是高品质音色（如 iOS Siri / 微软 Natural）时才走本地，避免安卓手机的机械音抢跑。
  const isMobile = isMobileClient();
  const isGenuineHighQuality =
    hasGoodVoice && (!isMobile || /natural|siri|online/i.test(best?.name || ''));

  if (isGenuineHighQuality) {
    const ok = await speakWithBrowserVoice(cleanText, rate, best);
    if (ok) return;
    if (token !== speechToken) return;
    notify(
      '朗读没有出声。浏览器的语音引擎这次没有响应，可以再点一次，或检查系统媒体音量。'
    );
    return;
  }

  // 路线二：没有像样的英文音色（国产浏览器常见，往往只带中文音色）—— 用在线真人音源。
  // 手机端跳过：路线零已经是一次"在线音源"尝试了，而且实测有道对整句必然 500，
  // 整句只会白白多等两秒。
  if (!triedServerTts && cleanText.length <= 300) {
    const ok = await speakWithRemoteAudio(cleanText);
    if (ok) return;
    if (token !== speechToken) return;
  }

  // 路线三：在线音源也没成，用手里还剩下的音色（哪怕机械）
  if (best) {
    const ok = await speakWithBrowserVoice(cleanText, rate, best);
    if (ok) return;
    if (token !== speechToken) return;
  }

  // 路线四：音色列表这次是空的（首次加载、getVoices 还没就绪）。等 voiceschanged
  // 之后用真正拿到的音色再试一次。这时手势链已经断了，但「晚一点出声」明显好过
  // 「彻底不出声」，而且只有路线一~三全失败才会走到这里。
  if (synth && voices.length === 0) {
    const lateRanked = rankVoices(await resolveVoices());
    const lateBest = lateRanked[0]?.v;
    const ok = await speakWithBrowserVoice(cleanText, rate, lateBest);
    if (ok) return;
    // 注意：lateBest 可能为空 —— 这时 speakWithBrowserVoice 会用浏览器默认音色播放。
    // 机械，但至少出声，用户能判断出「功能是活的，只是这台设备没有好音色」。
  }

  // 走到了这里说明这次朗读确实没出声。但如果它已经被新的一次点击取代，
  // 就不该再弹提示 —— 那条提示描述的是上一次的失败，会误导人。
  if (token !== speechToken) return;

  // 一条路都没有：如实说明，不要静默失败。
  // 手机端（走过路线零）的失败原因和桌面端不同，分开说 —— 含混的「在线音源没连上」
  // 会让人以为是自己的网络问题，而实际可能是服务端那条非官方接口挂了。
  if (!synth) {
    notify(
      triedServerTts
        ? '这台浏览器自己不会朗读，服务端的真人发音这次也没拿到。检查一下网络再点一次，或换成 Chrome / Edge 打开。'
        : '这台浏览器既不支持语音朗读，也没能播放在线的真人音源。换成 Chrome 或 Edge 打开就能正常读。',
      'unsupported'
    );
  } else {
    notify(
      triedServerTts
        ? '朗读失败：设备自带的英文音色没出声，服务端的真人发音也没拿到。检查一下网络再点一次。'
        : '朗读失败：这台设备上没有可用的英文音色，在线真人音源也没能连上。可以换成 Chrome 或 Edge 试试。'
    );
  }
}

// Browser notification helper
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function showBrowserNotification(title: string, body: string) {
  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    new Notification(title, {
      body,
      icon: '/icon.svg',
    });
  }
}

export const sendLocalNotification = showBrowserNotification;
