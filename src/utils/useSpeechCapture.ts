// 语音采集（麦克风 + 语音识别）的统一实现。
//
// 为什么要有这个文件：这套逻辑原本在 SpeechPracticeModal 和
// FlashcardReviewModal 里各写了一遍，两处的注释都写着「100% 对齐」，
// 但实际表现不同 —— 手机 Edge 上「点卡片」能识别，「复习」一个词都收不到。
//
// 根本原因（两条）：
//   1. 启动延迟。旧实现在 recognition.start() 之前先 await getUserMedia。
//      手机上授权/建流要几百毫秒到几秒，识别通道要等这一步走完才打开。
//      用户点完按钮「立刻开口」，说的那一段正好落在通道打开之前的盲区里。
//
//   2. 通道自断。continuous = false 的识别在第一次静默之后就会 onend，
//      而两边的 onend 里都只写了一行注释、什么都没做 —— 通道就此死掉。
//
// 这里的做法：
//   · 识别自己会申请麦克风，默认不预开流 —— 启动紧贴用户手势，没有盲区。
//   · continuous = true；onend 时如果用户还在说，就自动续上一个新实例。
//   · 快速失败检测：若连续多次 start→onend 都没有 onresult，判定本设备
//     的识别服务不可用，停止重启，给出明确提示，不再显示「正在重新连接」。
//   · 所有错误码都映射成能看懂的中文，并在 diag 里留一行通道状态。
//   · 需要真实录音（回放 / 上传）时才额外开 MediaRecorder，由 record 开关控制。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** 识别引擎的错误码 → 给人看的话。 */
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
  /** 当前活着的识别实例 */
  const currentRecRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * 「之前那些识别会话」已经确定下来的文本。
   * 新实例 event.results 从空开始，必须把老会话文本单独保存再拼接，不能覆盖。
   */
  const committedRef = useRef('');
  const pendingFinishRef = useRef<(() => void) | null>(null);
  const stopPromiseRef = useRef<Promise<string> | null>(null);

  /**
   * 快速失败检测 —— 防止手机端 start→onend→restart 无限循环。
   *
   * 部分 Android / 手机 Edge 的 SpeechRecognition 接口存在但实际无法工作：
   * start() 后立刻 onend，没有任何 onresult，我们重启，再次立刻 onend……
   *
   * 规则：
   *   - 每次 openRecognition 创建新实例时，该实例有一个局部的 sessionHadResult=false。
   *   - onresult 触发时，sessionHadResult 置 true，同时累计失败计数归零。
   *   - onend 时：
   *       * sessionHadResult=true  → 正常静默超时，累计失败计数归零，可以重启。
   *       * sessionHadResult=false → 本轮没有任何结果，累计失败 +1。
   *         若累计 >= MAX_FAIL_BEFORE_GIVE_UP，停止重启，设置明确错误。
   *
   * 注意：network 错误会让 onresult 永远不来，但不是设备不支持，单独处理。
   */
  const cumFailCountRef = useRef(0);
  const MAX_FAIL_BEFORE_GIVE_UP = 3;

  const clearRestart = () => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  };

  /** 拼接两段识别文本，中间补空格 */
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

    // 每次新建实例都会重新进入这个闭包，所以 instanceText 天然等于「本次会话」的文本。
    let instanceText = '';
    // 本轮是否收到过 onresult —— 用于快速失败检测
    let sessionHadResult = false;

    rec.onresult = (event: any) => {
      let text = '';
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      text = text.trim();
      if (!text) return;

      // 本轮收到了结果 → 引擎正常 → 累计失败归零
      sessionHadResult = true;
      cumFailCountRef.current = 0;

      instanceText = text;
      const full = mergeText(committedRef.current, instanceText);
      transcriptRef.current = full;
      setTranscript(full);
    };

    rec.onerror = (e: any) => {
      const code = String(e?.error || 'unknown');
      if (code === 'aborted') return; // 我们自己取消的，不算错

      // network 错误：识别服务连不上，但不是「设备不支持」，不计入快速失败计数
      setDiag(`识别通道报错：${code}`);
      const msg = ERROR_TEXT[code];
      if (msg) setError(msg);

      // network 错误后，本轮也算「有结果」（避免因网络错误触发设备不支持的判定）
      if (code === 'network') {
        sessionHadResult = true;
      }
    };

    rec.onend = () => {
      // 先把本次会话的文本并入「已确定」部分
      if (instanceText) {
        committedRef.current = mergeText(committedRef.current, instanceText);
        instanceText = '';
      }

      if (stoppingRef.current) {
        // 用户已经点了「完成说」，stop() 正在等最终文本
        const finish = pendingFinishRef.current;
        pendingFinishRef.current = null;
        if (finish) setTimeout(finish, 50);
        return;
      }

      if (!activeRef.current) return;

      // ── 快速失败检测 ──────────────────────────────────────────────────────
      if (!sessionHadResult) {
        // 本轮从头到尾没有收到 onresult
        cumFailCountRef.current += 1;

        if (cumFailCountRef.current >= MAX_FAIL_BEFORE_GIVE_UP) {
          // 连续多次启动都没有任何结果 → 本设备/网络不支持语音识别
          activeRef.current = false;
          setIsRecording(false);
          setDiag('');
          setError(
            '当前设备或网络无法使用语音识别（连续启动未收到任何结果）。' +
            '手机端可能是浏览器权限或识别服务限制，建议使用桌面端。'
          );
          return;
        }
      } else {
        // 本轮有结果 → 正常静默，归零
        cumFailCountRef.current = 0;
      }
      // ─────────────────────────────────────────────────────────────────────

      // 用户还在「正在说」状态，通道静默超时，自动重启
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
    if (activeRef.current) return; // 幂等
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
    committedRef.current = '';
    pendingFinishRef.current = null;
    stopPromiseRef.current = null;
    // 新的一轮，重置快速失败计数
    cumFailCountRef.current = 0;
    setAudioUrl(null);
    setAudioBase64(null);

    // 需要回放/上传时才开录音
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
      // 兜底：个别浏览器停止时不发 onend
      setTimeout(finish, 1500);
    });
    stopPromiseRef.current = promise;

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

    const finish = pendingFinishRef.current;
    pendingFinishRef.current = null;
    if (finish) finish();
  }, []);

  // 卸载时确保麦克风被释放
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
