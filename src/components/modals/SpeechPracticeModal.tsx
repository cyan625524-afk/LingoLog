import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  Loader2,
  Headphones,
  BookOpen,
  Play,
  Square,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { FlashCard, SpeechEvaluationResult, SpeechWordAnalysis } from '../../types';
import { sound } from '../../utils/audio';
import { speakEnglishText, prefetchEnglishText } from '../../utils/tts';
import { TelegramStamp } from '../common/TelegramStamp';
import { SignalLamp } from '../common/SignalLamp';
import { useSpeechCapture } from '../../utils/useSpeechCapture';

interface SpeechPracticeModalProps {
  card: FlashCard | null;
  isOpen: boolean;
  onClose: () => void;
  onSpeechCompleted: (
    cardId: string,
    score: number,
    accuracy: string | number,
    feedback: string,
    evalResult?: SpeechEvaluationResult
  ) => void;
  modelName: string;
  apiKey?: string;
  provider?: string;
  baseUrl?: string;
}

export const SpeechPracticeModal: React.FC<SpeechPracticeModalProps> = ({
  card,
  isOpen,
  onClose,
  onSpeechCompleted,
  modelName,
  apiKey,
  provider,
  baseUrl,
}) => {
  const [practiceMode, setPracticeMode] = useState<'shadowing' | 'recall'>('shadowing');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<SpeechEvaluationResult | null>(null);
  const [selectedWordTip, setSelectedWordTip] = useState<SpeechWordAnalysis | null>(null);
  const [revealRecallText, setRevealRecallText] = useState(false);
  const [isPlayingRecorded, setIsPlayingRecorded] = useState(false);

  // 语音采集统一走共享 hook（record:true 保留录音回放与上传能力）。
  // useSpeechCapture 内部用 continuous=true + onend 自动重连，不会因为一次
  // 静默就让识别通道死掉——这正是过去「电脑端也看不到文字」的根本原因。
  const {
    isRecording,
    transcript: recognizedText,
    error: recordingError,
    diag: asrDiag,
    audioUrl: recordedAudioUrl,
    audioBase64,
    start: startCapture,
    stop: stopCapture,
    cancel: cancelCapture,
    supported: asrSupported,
  } = useSpeechCapture({ record: true });

  // 录到音频后暂存 base64（用于提交 AI 评测），用 ref 避免异步读值竞态
  const audioBase64Ref = useRef<string | null>(null);
  useEffect(() => {
    audioBase64Ref.current = audioBase64;
  }, [audioBase64]);

  const recordedAudioElRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      cancelCapture();
      setIsEvaluating(false);
      setEvalResult(null);
      setSelectedWordTip(null);
      setRevealRecallText(false);
      setIsPlayingRecorded(false);
      audioBase64Ref.current = null;
      if (card?.natural) {
        prefetchEnglishText(card.natural);
      }
    } else {
      cancelCapture();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, card]);

  // 释放旧的 objectURL，防止内存泄漏
  useEffect(() => {
    return () => {
      if (recordedAudioElRef.current) {
        recordedAudioElRef.current.pause();
      }
    };
  }, []);

  // Escape key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        sound.playKeyClick();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !card) return null;

  const startRecording = async () => {
    sound.playKeyClick();
    setEvalResult(null);
    setSelectedWordTip(null);
    await startCapture();
  };

  const stopRecording = async () => {
    sound.playKeyClick();
    // stop() 等待最终识别文本回来（手机端常晚 300~500ms），由 hook 内部处理
    await stopCapture();
  };

  const playRecordedAudio = () => {
    if (!recordedAudioUrl) return;
    sound.playKeyClick();
    if (recordedAudioElRef.current) {
      try {
        recordedAudioElRef.current.pause();
        recordedAudioElRef.current.currentTime = 0;
      } catch {}
    }
    const audio = new Audio(recordedAudioUrl);
    recordedAudioElRef.current = audio;
    setIsPlayingRecorded(true);
    audio.onended = () => setIsPlayingRecorded(false);
    audio.onerror = () => setIsPlayingRecorded(false);
    audio.play().catch(() => setIsPlayingRecorded(false));
  };

  const handleEvaluate = async () => {
    // ⚠️ 关键修复：不再用 || card.natural 兜底。
    // 过去这一行 `recognizedText.trim() || card.natural` 会在识别为空时
    // 把标准答案当作"用户说的"去评，结果永远是 97 分。
    // 现在识别为空时，如实告知用户「没有识别到」，不伪造高分。
    const textToEvaluate = recognizedText.trim();
    sound.playKeyClick();
    setIsEvaluating(true);

    try {
      const resp = await fetch('/api/evaluate-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          targetText: card.natural,
          recognizedText: textToEvaluate,
          audioBase64: audioBase64Ref.current || undefined,
          modelName,
          apiKey,
          provider,
          baseUrl,
        }),
      });

      if (!resp.ok) {
        throw new Error('Evaluation failed');
      }

      const json = await resp.json();
      // 服务端返回的是 { success, data }，这里要取 data
      const result: SpeechEvaluationResult = json?.data ?? json;
      setEvalResult(result);
      sound.playSuccess();
      confetti({ particleCount: 40, spread: 60 });
      onSpeechCompleted(card.id, result.score, result.accuracy, result.feedback, result);
    } catch (e) {
      // 评测服务不可用时如实告知，不要伪造高分。
      // 伪造"发音十分地道 92 分"会让人误以为自己发音很准，比不评测更糟。
      const fallbackWords: SpeechWordAnalysis[] = card.natural.split(' ').map((w) => ({
        word: w,
        accuracy: 0,
        status: 'warning',
      }));

      const fallback: SpeechEvaluationResult = {
        score: 0,
        accuracy: 0,
        fluency: 0,
        completeness: 0,
        prosody: 0,
        feedback:
          '评测服务暂时不可用，本次没有得分。请到「个人中心 → 智能翻译引擎配置」检查 API 密钥是否填好。',
        encouragement: '录音已经保存，配好密钥后可以再测一次。',
        words: fallbackWords,
      };
      setEvalResult(fallback);
      onSpeechCompleted(card.id, 0, 0, fallback.feedback, fallback);
    } finally {
      setIsEvaluating(false);
    }
  };

  const playStandardTTS = (textToSpeak?: string) => {
    sound.playKeyClick();
    speakEnglishText(textToSpeak || card.natural);
  };

  return (
    <div
      id="speech-practice-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          sound.playKeyClick();
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 select-none cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#f4edd3] rounded-xs shadow-[6px_6px_0px_#0e1610] border-2 border-stone-900 overflow-hidden flex flex-col max-h-[90vh] text-stone-900 cursor-default"
      >
        {/* Mustard Header */}
        <div className="bg-[#d49e3d] px-4 sm:px-5 py-2.5 border-b-2 border-stone-900 flex items-center justify-between text-stone-900 shrink-0">
          <div className="flex items-center gap-2">
            <SignalLamp status={isRecording ? 'red' : 'green'} size="sm" />
            <span className="font-serif-display font-black text-sm tracking-wide">
              — 电台播音演练 · 听后复述 —
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Switcher */}
            <div className="flex items-center bg-[#243427] p-0.5 rounded-xs border border-stone-900">
              <button
                onClick={() => {
                  sound.playKeyClick();
                  setPracticeMode('shadowing');
                  setRevealRecallText(true);
                }}
                className={`flex items-center gap-1 px-2.5 py-0.5 rounded-xs font-serif-display text-[11px] font-bold transition-all cursor-pointer ${
                  practiceMode === 'shadowing'
                    ? 'bg-[#d49e3d] text-stone-900 shadow-xs'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                <BookOpen className="w-3 h-3" />
                <span>跟读</span>
              </button>

              <button
                onClick={() => {
                  sound.playKeyClick();
                  setPracticeMode('recall');
                  setRevealRecallText(false);
                  playStandardTTS();
                }}
                className={`flex items-center gap-1 px-2.5 py-0.5 rounded-xs font-serif-display text-[11px] font-bold transition-all cursor-pointer ${
                  practiceMode === 'recall'
                    ? 'bg-[#99332e] text-white shadow-xs'
                    : 'text-stone-300 hover:text-white'
                }`}
                title="播放标准音频后隐藏文本，凭听觉记忆复述"
              >
                <Headphones className="w-3 h-3" />
                <span>复述</span>
              </button>
            </div>

            <button
              onClick={() => {
                sound.playKeyClick();
                onClose();
              }}
              className="p-1 rounded-xs hover:bg-[#c99333] text-stone-900 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Punch Holes Perforation Row */}
        <div className="punch-holes-row border-b border-dashed border-stone-400/70 bg-[#eee5c6] shrink-0">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="punch-hole-dot" />
          ))}
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Target Sentence Box */}
          <div className="bg-[#182319] text-stone-100 rounded-xs p-4 shadow-[2px_2px_0px_#101711] border-2 border-stone-900 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-stone-300">
              <TelegramStamp
                text={practiceMode === 'recall' ? '复述训练' : '跟读标准'}
                variant={practiceMode === 'recall' ? 'urgent' : 'official'}
              />
              <button
                onClick={() => playStandardTTS()}
                className="flex items-center gap-1 text-[#d49e3d] hover:brightness-110 font-bold cursor-pointer bg-black/40 px-2.5 py-1 rounded-xs border border-stone-700"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>播发母语原声</span>
              </button>
            </div>

            {/* Target text: In recall mode, mask if not revealed */}
            {practiceMode === 'recall' && !revealRecallText ? (
              <div className="py-3 text-center space-y-2">
                <div className="w-10 h-10 mx-auto rounded-xs bg-[#99332e]/20 text-[#d49e3d] flex items-center justify-center border border-[#99332e]/40">
                  <Headphones className="w-5 h-5 animate-pulse" />
                </div>
                <p className="text-xs font-serif-display text-amber-200">
                  电文已遮蔽 · 请聆听标准广播后，按下麦克风凭听觉复述
                </p>
                <button
                  onClick={() => setRevealRecallText(true)}
                  className="text-xs text-[#d49e3d] hover:underline font-mono cursor-pointer"
                >
                  显示参考电文
                </button>
              </div>
            ) : (
              <div className="font-serif-display text-lg sm:text-xl font-black text-[#f5eed6] leading-snug pt-1">
                "{card.natural}"
              </div>
            )}

            <div className="text-xs text-stone-300 font-serif-body">原句：{card.original}</div>
          </div>

          {/* Microphone & Recording Control */}
          <div className="bg-[#eee5c6] p-4 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] flex flex-col items-center space-y-3">
            <div className="text-center space-y-1">
              <span className="text-xs font-serif-display font-black text-stone-900">
                {isRecording
                  ? '正在录音收录...'
                  : recognizedText
                  ? '已采录录音'
                  : '按住或点击麦克风开始复述'}
              </span>
              <p className="text-[11px] text-stone-600 font-serif-body">
                尽量模拟英伦电台语调与停顿连读
              </p>
              {recordingError && (
                <p className="text-[11px] text-[#99332e] font-bold">{recordingError}</p>
              )}
              {/* 通道诊断行：让「没反应」变成看得见的状态 */}
              {isRecording && asrDiag && (
                <p className="text-[10px] font-mono text-stone-500">{asrDiag}</p>
              )}
              {isRecording && !asrSupported && (
                <p className="text-[10px] text-amber-700 font-mono">
                  此浏览器不支持实时识别，录音回放仍可用
                </p>
              )}
            </div>

            {/* Big Mic Button */}
            <div className="relative">
              {isRecording && (
                <div className="absolute -inset-2 rounded-xs bg-[#99332e]/20 animate-ping pointer-events-none" />
              )}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-14 h-14 rounded-xs flex items-center justify-center border-2 border-stone-900 shadow-[3px_3px_0px_#101711] active:translate-y-0.5 transition-all cursor-pointer ${
                  isRecording
                    ? 'bg-[#99332e] text-white'
                    : 'bg-[#d49e3d] hover:bg-[#c99333] text-stone-950'
                }`}
              >
                {isRecording ? <MicOff className="w-6 h-6 animate-pulse" /> : <Mic className="w-6 h-6" />}
              </button>
            </div>

            {/* Audio Playback & Comparison Toolbar */}
            {recordedAudioUrl && (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={playRecordedAudio}
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#faf7ee] hover:bg-white text-stone-900 text-xs font-mono font-bold rounded-xs border border-stone-900 shadow-[1px_1px_0px_#101711] cursor-pointer active:translate-y-0.5"
                >
                  {isPlayingRecorded ? (
                    <>
                      <Square className="w-3.5 h-3.5 text-[#99332e]" />
                      <span>停止试听</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-emerald-700" />
                      <span>试听我的录音</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => playStandardTTS()}
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#e4dcbc] hover:bg-[#ded4b2] text-stone-900 text-xs font-mono font-bold rounded-xs border border-stone-900 shadow-[1px_1px_0px_#101711] cursor-pointer active:translate-y-0.5"
                >
                  <Volume2 className="w-3.5 h-3.5 text-stone-700" />
                  <span>对比母语原声</span>
                </button>
              </div>
            )}

            {/* Recognized Text Display */}
            {recognizedText && (
              <div className="w-full bg-[#faf7ee] p-2.5 rounded-xs border border-stone-900 shadow-[1px_1px_0px_#101711] space-y-1 text-center">
                <span className="text-[10px] uppercase font-mono text-stone-500 font-bold">
                  电台实时识别结果
                </span>
                <p className="text-xs font-mono font-bold text-stone-900">
                  "{recognizedText}"
                </p>
              </div>
            )}

            {/* Ready indicator if recorded */}
            {recordedAudioUrl && !evalResult && (
              <div className="text-[11px] text-stone-600 font-serif-body text-center flex items-center justify-center gap-1.5 pt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block animate-pulse" />
                <span>录音已就绪，点击下方按钮提交总台 AI 评测</span>
              </div>
            )}

            {/* Evaluate Button */}
            {(recognizedText || recordedAudioUrl) && !evalResult && (
              <button
                onClick={handleEvaluate}
                disabled={isEvaluating}
                className="px-5 py-2 rounded-xs bg-[#243427] hover:bg-[#1a271d] text-[#d49e3d] text-xs font-bold border-2 border-stone-900 shadow-[2px_2px_0px_#101711] flex items-center gap-1.5 active:translate-y-0.5 transition-all cursor-pointer font-serif-display"
              >
                {isEvaluating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>总台 AI 正在精析评测...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-[#d49e3d]" />
                    <span>提交电台复述多维测评</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Evaluation Result Card */}
          {evalResult && (
            <div className="bg-[#eee5c6] p-4 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-stone-400 pb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xs bg-[#d49e3d] text-stone-950 font-mono font-black text-lg flex items-center justify-center border border-stone-900 shadow-[1px_1px_0px_#101711]">
                    {evalResult.score}
                  </div>
                  <div>
                    <span className="font-serif-display font-black text-sm text-stone-900">
                      综合复述得分
                    </span>
                    <span className="text-[10px] text-stone-600 block font-mono">
                      准确率 {evalResult.accuracy}% · 流利度 {evalResult.fluency || 90}%
                    </span>
                  </div>
                </div>

                <TelegramStamp
                  text={evalResult.score >= 85 ? '发音优良' : '合格'}
                  variant="official"
                />
              </div>

              {/* Word-by-word Analysis Chips */}
              {evalResult.words && evalResult.words.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wider font-mono">
                    单字发音精准度分析 (点击查看提示)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {evalResult.words.map((w, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          sound.playKeyClick();
                          setSelectedWordTip(w);
                        }}
                        className={`px-2 py-0.5 rounded-xs text-xs font-mono font-bold transition-transform cursor-pointer border border-stone-900 shadow-[1px_1px_0px_#101711] ${
                          w.status === 'correct'
                            ? 'bg-emerald-200 text-emerald-950'
                            : w.status === 'warning'
                            ? 'bg-amber-200 text-amber-950'
                            : 'bg-red-200 text-red-950'
                        }`}
                      >
                        {w.word}
                      </button>
                    ))}
                  </div>

                  {selectedWordTip && (
                    <div className="p-2 bg-[#faf7ee] border border-stone-900 rounded-xs text-xs space-y-0.5">
                      <span className="font-bold text-stone-900 font-mono">
                        "{selectedWordTip.word}":
                      </span>
                      <p className="text-stone-700 font-serif-body">
                        {selectedWordTip.tip || '发音符合地道连读规范'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* General Feedback */}
              {evalResult.feedback && (
                <p className="text-xs text-stone-800 bg-[#faf7ee] p-2.5 rounded-xs border border-stone-900 leading-relaxed font-serif-body">
                  {evalResult.feedback}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
