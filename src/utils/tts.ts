// Text-to-Speech & Speech Recognition Helper
//
// 这个文件只回答一个问题：在这台设备上，用哪条路能放出最接近母语者的英文声音。
//
// 只有两条路：
//   A. 浏览器自带的语音合成（speechSynthesis）。桌面 Edge 的
//      "Microsoft ... Online (Natural)"、Chrome 的 Google 音色都属于这一类，质量最好。
//   B. 有道词典的真人音频流。浏览器合成不可用、或找得到的音色太机械时的备选。
//
// 这里记着两个真实踩过的坑，免得再犯：
//
//   1. 过去是用 User-Agent 判断「是不是手机」，只要 UA 里有 Mobile 就强制走 B。
//      于是手机 Edge 明明带着自己的神经音色，却永远上不了桌 ——
//      「手机 Edge 发音机械、桌面 Edge 很真实」就是这么来的。
//      判断依据应该是**这台设备实际有哪些音色**，而不是它自称是什么设备。
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

  // 清掉 markdown 的星号等标记，它们会被逐字读出来
  const cleanText = (text || '').replace(/[*_~`]/g, '').trim();
  if (!cleanText) return;

  const synth = window.speechSynthesis;

  // 上面几行到这里是同步的，**一个 await 都没有** —— 所以后面第一次 speak()/play()
  // 仍然落在「用户点击」的同步调用栈里。过去这里先 await resolveVoices()（最多 600ms），
  // 手势链直接断掉，国产内核因此拒绝播放：这是「手机上再也不出声」的主因之一。
  const voices = getVoicesSync();
  const ranked = rankVoices(voices);
  const best = ranked[0]?.v;
  const hasGoodVoice = Boolean(ranked[0] && ranked[0].score >= GOOD_VOICE_SCORE);

  // 路线一：这台设备本来就有像样的英文音色（桌面 Edge、手机 Edge、Chrome 都在这里）
  // —— 直接用它。不再因为「UA 里写着 Mobile」就把它降级成在线音源。
  if (hasGoodVoice) {
    const ok = await speakWithBrowserVoice(cleanText, rate, best);
    if (ok) return;
    notify(
      '朗读没有出声。浏览器的语音引擎这次没有响应，可以再点一次，或检查系统媒体音量。'
    );
    return;
  }

  // 路线二：没有像样的英文音色（国产浏览器常见，往往只带中文音色）—— 用在线真人音源。
  if (cleanText.length <= 300) {
    const ok = await speakWithRemoteAudio(cleanText);
    if (ok) return;
  }

  // 路线三：在线音源也没成，用手里还剩下的音色（哪怕机械）
  if (best) {
    const ok = await speakWithBrowserVoice(cleanText, rate, best);
    if (ok) return;
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

  // 一条路都没有：如实说明，不要静默失败
  if (!synth) {
    notify(
      '这台浏览器既不支持语音朗读，也没能播放在线的真人音源。换成 Chrome 或 Edge 打开就能正常读。',
      'unsupported'
    );
  } else {
    notify(
      '朗读失败：这台设备上没有可用的英文音色，在线真人音源也没能连上。可以换成 Chrome 或 Edge 试试。'
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
