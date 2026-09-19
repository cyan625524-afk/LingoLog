// 语音采集（麦克风 + 语音识别）的统一实现。
//
// 为什么要有这个文件：这套逻辑原本在 SpeechPracticeModal 和
// FlashcardReviewModal 里各写了一遍，两处的注释都写着「100% 对齐」，
// 但实际表现不同 —— 手机 Edge 上「点卡片」能识别，「复习」一个词都收不到。
//
// 差异不在那些明显的地方，而在两个时序细节：
//
//   1. 启动延迟。旧实现在 recognition.start() 之前先 await getUserMedia。
//      手机上授权/建流要几百毫秒到几秒，而识别通道要等这一步走完才打开。
//      用户点完按钮「立刻开口」，说的那一段正好落在通道打开之前的盲区里。
//
//   2. 通道自断。continuous = false 的识别在第一次静默之后就会 onend，
//      而两边的 onend 里都只写了一行注释、什么都没做 —— 通道就此死掉，
//      之后再说多少话也没人听，界面上也不会有任何提示。
//
// 这里的做法：
//   · 识别自己会申请麦克风，所以默认不预开流 —— 启动紧贴用户手势，没有盲区。
//   · continuous = true；onend 时如果用户还在说，就自动续上一个新实例。
//   · 所有错误码都映射成能看懂的中文，并在 diag 里留一行通道状态。
//   · 需要真实录音（回放 / 上传）时才额外开 MediaRecorder，由 record 开关控制。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** 识别引擎的错误码 → 给人看的话。用户看到「没反应」多半就是这里的某一条。 */
const ERROR_TEXT: Record<string, string> = {
  'not-allowed': '麦克风权限被拒绝，请在浏览器设置中允许本站使用麦克风。',
  'service-not-allowed': '浏览器拒绝了语音识别服务，请检查系统的麦克风与语音权限。',
  'audio-capture': '没有拿到麦克风音频，可能被其它应用占用了。',
  network: '语音识别服务连不上（network）。识别引擎需要联网，请检查网络后重试。',
  'no-speech': '没有检测到语音（no-speech）。点「开始说」后请立刻开口。',
};

function getRecognitionCtor(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

/**
 * 这台设备是否提供语音识别接口。
 * 返回 true 只代表「接口存在」，不代表连得上识别服务（那取决于网络）。
 */
export function isSpeechRecognitionSupported(): boolean {
  return Boolean(getRecognitionCtor());
}

export interface UseSpeechCaptureOptions {
  /** 识别语言，默认 en-US */
  lang?: string;
  /**
   * 是否同时录制音频（回放 / 上传转写用）。
   * 默认 false —— 开着就必然要 await getUserMedia，会把识别启动推迟到手势之后。
   */
  record?: boolean;
}

export interface SpeechCapture {
  /** 用户正处于「正在说」的状态（不是「接口是否可用」） */
  isRecording: boolean;
  /** 实时识别文本 */
  transcript: string;
  /** 失败原因，已翻成中文。null 表示当前没有错误 */
  error: string | null;
  /** 一行通道诊断，用于在界面上如实说明状态 */
  diag: string;
  supported: boolean;
  /** record=true 时录到的音频 objectURL，可直接给 <audio> / new Audio 用 */
  audioUrl: string | null;
  /** record=true 时录到的音频 base64（不含 `data:...;base64,` 前缀） */
  audioBase64: string | null;
  start: () => Promise<void>;
  /** 停止并等待最终识别文本（手机端 onresult 常晚到 300~500ms） */
  stop: () => Promise<string>;
  /** 放弃本次、不取文本，立即释放麦克风 */
  cancel: () => void;
}

export function useSpeechCapture(options: UseSpeechCaptureOptions = {}): SpeechCapture {
  const { lang = 'en-US', record = false } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [diag, setDiag] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);

  const supported = useMemo(() => isSpeechRecognitionSupported(), []);

  /** 用户是否处于「正在说」。用来区分「通道自己 end 了」和「用户点完成了」 */
  const activeRef = useRef(false);
  /** 正在收尾，禁止一切自动重启 */
  const stoppingRef = useRef(false);
  const transcriptRef = useRef('');
  /** 当前活着的识别实例。onend 之后要换新的，所以每次 open 都覆盖它 */
  const currentRecRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * 「之前那些识别会话」已经确定下来的文本。
   *
   * 为什么需要它：continuous = true 的识别器在静默超时后依然会 onend，
   * 我们重启出来的**新实例 event.results 从空开始**。如果 onresult 直接
   * `transcriptRef.current = text`，重启前说过的词会被整段覆盖 —— 而复习流程
   * 天然带静默期（「请在脑中检索该英文表达」），正好踩在这个坑上。
   */
  const committedRef = useRef('');
  /** stop() 在等最终结果时的收尾函数，交给 onend 触发 */
  const pendingFinishRef = useRef<(() => void) | null>(null);
  /** stop() 返回的 promise。重复调用必须拿到同一个，否则前一个永远不 resolve */
  const stopPromiseRef = useRef<Promise<string> | null>(null);

  const clearRestart = () => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  };

  /** 拼接两段识别文本，中间补空格，免得 "I want to" + "buy it" 粘成一个词 */
  const mergeText = (a: string, b: string) => {
    const left = a.trim();
    const right = b.trim();
    if (!left) return right;
    if (!right) return left;
    return `${left} ${right}`;
  };

  /**
   * 开一个识别实例，放进 ref 而不是 useCallback：
   * onend 需要递归调用它，走 ref 才能保证每次都拿到最新那份闭包。
   */
  const openRecognitionRef = useRef<(() => boolean) | null>(null);
  openRecognitionRef.current = () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return false;

    let rec: any;
    try {
      rec = new Ctor();
    } catch {
      return false;
    }

    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => setDiag('识别通道已开启，正在听…');

    // 每次新建实例都会重新进入这个闭包，所以 instanceText 天然就等于「本次会话」的文本。
    let instanceText = '';

    rec.onresult = (event: any) => {
      let text = '';
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      text = text.trim();
      if (!text) return;

      instanceText = text;
      // 累加而不是覆盖 —— 见 committedRef 的说明。
      const full = mergeText(committedRef.current, instanceText);
      transcriptRef.current = full;
      setTranscript(full);
    };

    rec.onerror = (e: any) => {
      const code = String(e?.error || 'unknown');
      if (code === 'aborted') return; // 我们自己取消的，不算错
      setDiag(`识别通道报错：${code}`);
      const msg = ERROR_TEXT[code];
      if (msg) setError(msg);
    };

    rec.onend = () => {
      // 先把本次会话的文本并入「已确定」部分。
      // 不论接下来是重启还是收尾，都不能让这段文本跟着实例一起消失。
      if (instanceText) {
        committedRef.current = mergeText(committedRef.current, instanceText);
        instanceText = '';
      }

      if (stoppingRef.current) {
        // 用户已经点了「完成说」，stop() 正在等最终文本 —— 此刻它已经确定了，
        // 交给它收尾比死等固定时长更快，也不会漏掉尾句。
        const finish = pendingFinishRef.current;
        pendingFinishRef.current = null;
        if (finish) setTimeout(finish, 50);
        return;
      }

      // 用户没点「完成说」，通道却自己 end 了（静默超时 / 引擎轮转）。
      // 这正是过去最致命的地方：旧实现在这里什么都不做，通道就此死掉，
      // 之后再说多少话也没人听，界面上也一个字都不提示。
      if (!activeRef.current) return;

      setDiag('识别通道已暂停，正在重新连接…');
      clearRestart();
      restartTimerRef.current = setTimeout(() => {
        if (!activeRef.current || stoppingRef.current) return;
        if (!openRecognitionRef.current?.()) setDiag('识别通道无法重启');
      }, 200);
    };

    try {
      rec.start();
    } catch {
      return false;
    }
    currentRecRef.current = rec;
    return true;
  };

  const start = useCallback(async () => {
    if (activeRef.current) return; // 幂等：手快连点两次不会开出两条通道
    if (!supported) {
      setError(
        '这台设备的浏览器不提供语音识别接口（SpeechRecognition 未定义），无法自动判定。可直接点「直接看答案」。'
      );
      return;
    }

    activeRef.current = true;
    stoppingRef.current = false;
    clearRestart();
    setError(null);
    setDiag('');
    setTranscript('');
    transcriptRef.current = '';
    // 新的一轮：清掉上一轮的累积文本与收尾句柄。
    // 上一轮若还有 stop() 挂着，它自己的 1.5 秒兜底会把它收掉，不会悬着。
    committedRef.current = '';
    pendingFinishRef.current = null;
    stopPromiseRef.current = null;
    setAudioUrl(null);
    setAudioBase64(null);

    // 需要回放/上传时才开录音。注意这一步要 await，会推迟识别启动 ——
    // 复习流程不需要录音，所以不传 record，识别能在用户手势的同一刻开始听。
    if (record) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        let mimeType = '';
        if (typeof MediaRecorder !== 'undefined') {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
          else if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
          else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
          else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
        }

        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          if (chunksRef.current.length > 0) {
            const type = recorder.mimeType || chunksRef.current[0]?.type || 'audio/webm';
            const blob = new Blob(chunksRef.current, { type });
            setAudioUrl(URL.createObjectURL(blob));
            try {
              const reader = new FileReader();
              reader.onloadend = () => {
                const res = String(reader.result || '');
                if (res) setAudioBase64(res.split(',')[1] || '');
              };
              reader.readAsDataURL(blob);
            } catch {}
          }
        };
        recorder.start();
        recorderRef.current = recorder;
      } catch (err: any) {
        const name = String(err?.name || '');
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setError('麦克风权限被拒绝，请在浏览器设置中允许本站使用麦克风。');
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setError('没有找到麦克风设备。');
        } else if (name === 'NotReadableError' || name === 'TrackStartError') {
          setError('麦克风被别的程序占用了，关掉其它录音应用再试。');
        } else {
          setError('麦克风启动失败，请确认已允许本站使用麦克风。');
        }
        activeRef.current = false;
        return;
      }
    }

    if (!openRecognitionRef.current?.()) {
      setError('语音识别启动失败。可直接点「直接看答案」。');
      activeRef.current = false;
      return;
    }

    setIsRecording(true);
  }, [record, supported]);

  const stop = useCallback((): Promise<string> => {
    // 手快连点两次「完成说」：第二次必须拿到同一个 promise，
    // 否则第一次那个永远不会 resolve，界面就卡在「判定中」。
    if (stopPromiseRef.current) return stopPromiseRef.current;
    if (!activeRef.current && !currentRecRef.current) {
      return Promise.resolve(transcriptRef.current.trim());
    }

    stoppingRef.current = true;
    activeRef.current = false;
    clearRestart();
    setIsRecording(false);

    const rec = currentRecRef.current;
    const stream = streamRef.current;

    const promise = new Promise<string>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        pendingFinishRef.current = null;
        stopPromiseRef.current = null;
        // 只在「还是本实例」时才清引用：避免把 start() 之后新开的通道误清掉
        if (currentRecRef.current === rec) currentRecRef.current = null;
        if (stream && streamRef.current === stream) {
          try {
            stream.getTracks().forEach((t) => t.stop());
          } catch {}
          streamRef.current = null;
        }
        resolve(transcriptRef.current.trim());
      };

      pendingFinishRef.current = finish;
      // 正常路径由 onend 触发 —— 它一收到就说明音频已经送去识别并且回传完毕，
      // 所以通常几十毫秒就能拿到最终文本。
      // 这里留一个兜底：个别浏览器停止时不发 onend，不能无限等下去。
      setTimeout(finish, 1500);
    });
    stopPromiseRef.current = promise;

    // 只 stop()，不 abort()：abort 会把「已经识别到、但还没回传」的结果丢掉。
    // 也先别关麦克风轨道 —— stop() 之后这段音频还要再送去识别一次。
    try {
      rec?.stop();
    } catch {}

    if (recorderRef.current && recorderRef.current.state === 'recording') {
      try {
        recorderRef.current.stop();
      } catch {}
    }

    return promise;
  }, []);

  const cancel = useCallback(() => {
    stoppingRef.current = true;
    activeRef.current = false;
    clearRestart();

    const rec = currentRecRef.current;
    try {
      rec?.abort();
    } catch {}
    if (currentRecRef.current === rec) currentRecRef.current = null;

    if (recorderRef.current && recorderRef.current.state === 'recording') {
      try {
        recorderRef.current.stop();
      } catch {}
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      streamRef.current = null;
    }

    setIsRecording(false);
    setTranscript('');
    transcriptRef.current = '';
    committedRef.current = '';
    setError(null);
    setDiag('');

    // 若此刻还有 stop() 在等结果，让它立刻收尾。
    // 否则它会在 1.5 秒后带着已过期的文本 resolve，把判定写到别的卡片上。
    const finish = pendingFinishRef.current;
    pendingFinishRef.current = null;
    if (finish) finish();
  }, []);

  // 卸载时确保麦克风被释放，否则手机上会一直留着「正在录音」的系统提示
  useEffect(() => {
    return () => {
      activeRef.current = false;
      stoppingRef.current = true;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      try {
        currentRecRef.current?.abort();
      } catch {}
      try {
        recorderRef.current?.stop();
      } catch {}
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {}
    };
  }, []);

  return {
    isRecording,
    transcript,
    error,
    diag,
    supported,
    audioUrl,
    audioBase64,
    start,
    stop,
    cancel,
  };
}
