import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Volume2,
  Undo2,
  Mic,
  Square,
  Eye,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  FlashCard,
  ReviewHistoryEntry,
  ReviewRating,
  RetrievalContext,
} from '../../types';
import { sound } from '../../utils/audio';
import { speakEnglishText, prefetchEnglishText } from '../../utils/tts';
import { getCardChronologicalMap, formatCardNumber } from '../../utils/cardOrder';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import {
  evaluateRecall,
  getReviewModeAndPrompt,
  RecallEvaluation,
} from '../../utils/recall';

interface FlashcardReviewModalProps {
  cards: FlashCard[];
  allCards?: FlashCard[];
  isOpen: boolean;
  onClose: () => void;
  onGradeCard: (cardId: string, rating: ReviewRating, context?: RetrievalContext) => void;
  onUndoLastGrade: (entry: ReviewHistoryEntry) => void;
  historyStack: ReviewHistoryEntry[];
}

/**
 * 等麦克风权限响应的宽限时长（与 SpeechPracticeModal 完全一致）
 */
const MIC_START_TIMEOUT_MS = 45000;

export const FlashcardReviewModal: React.FC<FlashcardReviewModalProps> = ({
  cards,
  allCards,
  isOpen,
  onClose,
  onGradeCard,
  onUndoLastGrade,
  historyStack,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  // 强制提取与语音识别状态
  const [isRecording, setIsRecording] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [isEvaluated, setIsEvaluated] = useState(false);
  const [isRevealedDirectly, setIsRevealedDirectly] = useState(false);
  const [recallEvaluation, setRecallEvaluation] = useState<RecallEvaluation | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  // 详细解析折叠状态（手机端默认折叠，防止卡片被撑得过长）
  const [isExplanationExpanded, setIsExplanationExpanded] = useState(false);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef(false);
  const recognizedTextRef = useRef('');

  // Chronological order map (earliest added = No.001)
  const cardChronologicalMap = useMemo(() => {
    return getCardChronologicalMap(allCards && allCards.length > 0 ? allCards : cards);
  }, [allCards, cards]);

  const currentCard = cards[currentIndex];

  // 换场景复述与提示语计算
  const { mode: currentMode, promptZh } = useMemo(() => {
    if (!currentCard) return { mode: 'original' as const, promptZh: '' };
    return getReviewModeAndPrompt(currentCard);
  }, [currentCard]);

  // 停止所有录音与识别通道并彻底释放麦克风硬件
  const stopCurrentAudioTracks = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      mediaStreamRef.current = null;
    }
    isRecordingRef.current = false;
  };

  // 重置单张卡片的交互状态
  const resetCardState = () => {
    stopCurrentAudioTracks();
    setIsRecording(false);
    isRecordingRef.current = false;
    setRecognizedText('');
    recognizedTextRef.current = '';
    setIsEvaluated(false);
    setIsRevealedDirectly(false);
    setRecallEvaluation(null);
    setRecordingError(null);
    setIsExplanationExpanded(false);
  };

  // 模态框打开或卡片数组变化
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setIsFinished(false);
      setReviewedCount(0);
      resetCardState();
    } else {
      stopCurrentAudioTracks();
    }
  }, [isOpen, cards]);

  // 预热发音音频
  useEffect(() => {
    if (isOpen && currentCard?.natural) {
      prefetchEnglishText(currentCard.natural);
    }
  }, [isOpen, currentCard]);

  // 组件卸载时释放资源
  useEffect(() => {
    return () => {
      stopCurrentAudioTracks();
    };
  }, []);

  /**
   * 启动录音与语音识别（与 SpeechPracticeModal 经过实测验证的手机端底层实现 100% 对齐）
   */
  const startRecording = async () => {
    if (!currentCard) return;
    sound.playKeyClick();
    setRecordingError(null);
    setRecognizedText('');
    recognizedTextRef.current = '';

    let micStarted = false;

    // 1. 录下真实音频（与 SpeechPracticeModal 完全一致）
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const micPromise = navigator.mediaDevices.getUserMedia({ audio: true });
        micPromise.catch(() => {});
        const stream = await Promise.race([
          micPromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), MIC_START_TIMEOUT_MS)),
        ]);

        if (!stream) {
          setRecordingError(
            `麦克风没有响应（等了 ${MIC_START_TIMEOUT_MS / 1000} 秒）。手机上常见的原因是浏览器把权限弹窗吞掉了，请在浏览器设置里允许本站使用麦克风后重试。`
          );
          return;
        }

        mediaStreamRef.current = stream;

        let mimeType = '';
        if (typeof MediaRecorder !== 'undefined') {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
          } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            mimeType = 'audio/webm';
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
          } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
            mimeType = 'audio/ogg';
          }
        }

        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        audioChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((track) => track.stop());
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        isRecordingRef.current = true;
        micStarted = true;
      } catch (err: any) {
        console.warn('Microphone error or permission denied:', err);
        const errName = String(err?.name || '');
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          setRecordingError('麦克风权限被拒绝，请在浏览器或手机权限设置中允许访问麦克风。');
        } else {
          setRecordingError('未能启动麦克风，请确认已允许麦克风访问。');
        }
        return;
      }
    } else {
      setRecordingError('这台浏览器不提供录音能力（请确保在 HTTPS 下访问）。');
      return;
    }

    // 2. 语音识别（SpeechRecognition，与 SpeechPracticeModal 完全一致）
    const supportsRecognition =
      typeof window !== 'undefined' &&
      Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    if (supportsRecognition) {
      try {
        const SpeechRecognition =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = false; // 手机端必须为 false，对齐 SpeechPracticeModal
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((r: any) => r[0].transcript)
            .join('')
            .trim();
          if (transcript) {
            setRecognizedText(transcript);
            recognizedTextRef.current = transcript;
          }
        };

        recognition.onerror = (e: any) => {
          console.warn('Speech recognition notice:', e);
          if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
            setRecordingError('麦克风权限被拒绝，请在浏览器设置中允许麦克风。');
          }
        };

        recognition.onend = () => {
          // ⚠️ 注意：绝不在 onend 中关闭 isRecording！MediaRecorder 依然在采集真实音频
        };

        recognition.start();
        recognitionRef.current = recognition;
        micStarted = true;
      } catch (err) {
        console.warn('Speech recognition failed to start:', err);
      }
    }

    if (!micStarted && !recordingError) {
      setRecordingError('未能启动录音，请确认已允许麦克风权限。');
    }
  };

  // 纯前端本地自动覆盖率判定逻辑
  const evaluateSpokenText = (textToEvaluate: string) => {
    if (!currentCard) return;

    const evaluation = evaluateRecall(
      currentCard.natural,
      textToEvaluate,
      currentCard.variants,
      currentMode === 'transfer'
    );

    setRecallEvaluation(evaluation);
    setIsEvaluated(true);
    setIsRevealedDirectly(false);

    if (evaluation.result === 'pass') {
      sound.playSuccess();
    } else {
      sound.playCardFlip();
    }
  };

  // 手动点击「完成说并提交判定」
  const stopRecordingAndEvaluate = () => {
    sound.playKeyClick();

    // ⚠️ 关键：先停止识别，但不要立刻 null 掉 recognitionRef！
    // 手机 Edge 上 recognition.stop() 是异步的，onresult 事件会在 stop() 之后才触发。
    // 如果立刻 null，onresult 无法更新 recognizedTextRef，导致识别到的文字丢失。
    // 仿照 SpeechPracticeModal.stopRecording() 的处理方式，让 ref 保持存活。
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      // ← 故意不在这里 null，等 500ms 后在 timeout 内再清理
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      // ← 同上，延迟清理
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
    isRecordingRef.current = false;

    // 延时 500ms（手机端 onresult 最晚在 stop() 后约 300-400ms 才到），
    // 等最后一个识别结果写入 recognizedTextRef 之后，再读值、清理、评测。
    setTimeout(() => {
      const finalText = (recognizedTextRef.current || recognizedText).trim();
      // 延迟清理 ref，确保读值之后才释放
      recognitionRef.current = null;
      mediaRecorderRef.current = null;
      evaluateSpokenText(finalText);
    }, 500);
  };

  // 用户未开口直接看答案（严格标记为 revealed，仅允许选择 AGAIN）
  const handleRevealDirectly = () => {
    sound.playCardFlip();
    stopCurrentAudioTracks();
    setIsRecording(false);
    isRecordingRef.current = false;
    setIsRevealedDirectly(true);
    setIsEvaluated(true);
    setRecallEvaluation({
      result: 'fail',
      coverage: 0,
      accuracyPercent: 0,
      matchedCount: 0,
      totalWords: 1,
    });
  };

  // 方案 A：系统根据客观提取判定，自适应计算推荐评级
  const recommendedRating: ReviewRating = useMemo(() => {
    if (isRevealedDirectly) return 'again';
    if (recallEvaluation?.result === 'pass') return 'good';
    if (recallEvaluation?.result === 'partial') return 'hard';
    return 'again';
  }, [isRevealedDirectly, recallEvaluation]);

  // 快捷键支持
  useEffect(() => {
    if (!isOpen || isFinished) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea') return;

      if (e.key === 'Escape') {
        e.preventDefault();
        sound.playKeyClick();
        onClose();
        return;
      }

      // 空格键 / 回车键
      if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        if (!isEvaluated) {
          if (!isRecording) {
            startRecording();
          } else {
            stopRecordingAndEvaluate();
          }
        } else {
          // 判定完成后，按空格或回车直接采纳系统推荐的评级进入下一张！
          handleRate(recommendedRating);
        }
        return;
      }

      // 评级快捷键 1~4
      if (isEvaluated) {
        if (e.key === '1') handleRate('again');
        else if (e.key === '2' && !isRevealedDirectly) handleRate('hard');
        else if (e.key === '3' && !isRevealedDirectly) handleRate('good');
        else if (e.key === '4' && !isRevealedDirectly) handleRate('easy');
      }

      // 撤销快捷键 Z
      if ((e.key === 'z' || e.key === 'Z') && historyStack.length > 0) {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    isFinished,
    isEvaluated,
    isRecording,
    isRevealedDirectly,
    recommendedRating,
    historyStack,
  ]);

  if (!isOpen) return null;

  // 提交评分并推进到下一张
  const handleRate = (rating: ReviewRating) => {
    if (!currentCard || !isEvaluated) return;
    sound.playKeyClick();

    const retrievalResult = isRevealedDirectly
      ? 'revealed'
      : recallEvaluation?.result || 'fail';

    const context: RetrievalContext = {
      result: retrievalResult,
      mode: currentMode,
      pronunciationCoverage: recallEvaluation?.accuracyPercent,
    };

    onGradeCard(currentCard.id, rating, context);
    setReviewedCount((prev) => prev + 1);

    if (currentIndex + 1 < cards.length) {
      setCurrentIndex((prev) => prev + 1);
      resetCardState();
      sound.playCardFlip();
    } else {
      setIsFinished(true);
      resetCardState();
      sound.playSuccess();
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });
    }
  };

  // 撤销上一张评分
  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const lastEntry = historyStack[0];
    sound.playKeyClick();
    onUndoLastGrade(lastEntry);
    if (isFinished) {
      setIsFinished(false);
    }
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      resetCardState();
    }
  };

  return (
    <div
      id="flashcard-review-modal-backdrop"
      onClick={() => {
        sound.playKeyClick();
        onClose();
      }}
      className="fixed inset-0 z-50 bg-[#0d160f]/85 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 md:p-6 animate-in fade-in duration-200 select-none cursor-pointer"
    >
      <div
        id="flashcard-review-modal-dialog"
        onClick={(e) => {
          e.stopPropagation();
        }}
        className="w-full max-w-2xl bg-[#182319] border-2 border-stone-900 rounded-xs shadow-[8px_8px_0px_#070d08] overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] cursor-default"
      >
        {/* Top Header Bar (Pinned) */}
        <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-[#243427] border-b-2 border-stone-900 flex items-center justify-between text-stone-100 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#d49e3d] inline-block shadow-[0_0_6px_#d49e3d]" />
            <span className="font-serif-display font-black text-sm tracking-wide">
              电报复核工位 · 强制主动提取
            </span>
            {!isFinished && cards.length > 0 && (
              <span className="font-mono text-xs font-bold text-[#d49e3d] bg-[#182319] px-2.5 py-0.5 rounded-xs border border-stone-800">
                {String(currentIndex + 1).padStart(2, '0')} / {String(cards.length).padStart(2, '0')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sound.playKeyClick();
                onClose();
              }}
              title="退出复习 (Esc)"
              className="p-1.5 rounded-xs text-stone-400 hover:text-stone-100 hover:bg-[#182319] transition-colors cursor-pointer border border-transparent hover:border-stone-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Card Content Surface (Scrollable) */}
        {!isFinished && currentCard ? (
          <>
            <div className="flex-1 overflow-y-auto min-h-0 p-3 sm:p-5 flex flex-col space-y-4">
              {/* Teleprinter Paper Dispatch Sheet */}
              <div className="w-full bg-[#f4edd3] border-2 border-stone-900 shadow-[3px_3px_0px_#0e1610] rounded-xs overflow-hidden flex flex-col shrink-0">
                {/* Top Punched Holes Row */}
                <div className="punch-holes-row border-b border-dashed border-stone-400/60 bg-[#eee5c6] shrink-0">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} className="punch-hole-dot" />
                  ))}
                </div>

                {/* Main Sheet Body */}
                <div className="p-4 sm:p-6 text-stone-900 space-y-4">
                  {/* Header line with Category, Mode Stamp & Chronological Index */}
                  <div className="flex items-center justify-between border-b border-dashed border-stone-400 pb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-serif-display text-xs font-black text-stone-700">
                        — {currentCard.category || '日常社交'} · {formatCardNumber(cardChronologicalMap.get(currentCard.id) ?? (currentIndex + 1))} —
                      </span>

                      {/* Mode Badge: Original vs Transfer */}
                      {currentMode === 'transfer' ? (
                        <span className="border border-[#7c4d18] bg-[#fdf3e2] text-[#854d0e] font-mono text-[10px] font-black px-2 py-0.5 rounded-xs shadow-[1px_1px_0px_#854d0e]">
                          REAL-LIFE · 场景迁移
                        </span>
                      ) : (
                        <span className="border border-[#2a834f] bg-[#eef7f1] text-[#1e663c] font-mono text-[10px] font-black px-2 py-0.5 rounded-xs shadow-[1px_1px_0px_#1e663c]">
                          ORIGINAL · 原句复核
                        </span>
                      )}
                    </div>

                    {/* TTS Button (仅在已评测/揭晓后允许播放，避免提前剧透) */}
                    <button
                      onClick={() => {
                        sound.playKeyClick();
                        speakEnglishText(currentCard.natural);
                      }}
                      disabled={!isEvaluated}
                      className="bg-[#d49e3d] hover:bg-[#c99333] disabled:opacity-40 disabled:cursor-not-allowed active:translate-y-0.5 text-stone-950 font-serif-display font-black text-[11px] py-1 px-2.5 rounded-xs border border-stone-900 shadow-[1px_1px_0px_#101711] flex items-center gap-1 cursor-pointer transition-all"
                      title={isEvaluated ? '朗读标准母语表达' : '完成提取后可收听标准发音'}
                    >
                      <Volume2 className="w-3 h-3" />
                      <span>朗读</span>
                    </button>
                  </div>

                  {/* Big Chinese Prompt (Original or Transfer Prompt) */}
                  <div className="space-y-1">
                    <div className="font-serif-display text-2xl sm:text-3xl font-black text-stone-950 leading-snug break-words">
                      "{promptZh}"
                    </div>
                    {currentMode === 'transfer' && (
                      <div className="text-xs text-stone-600 font-serif italic">
                        原句背景参考：{currentCard.original}
                      </div>
                    )}
                  </div>

                  {/* Step 2 & 3: Extraction Area (Think + Record) */}
                  {!isEvaluated ? (
                    <div className="space-y-3.5 pt-1">
                      <div className="p-3 bg-[#faf7ee] rounded-xs border border-stone-400/80 text-stone-700 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-mono font-bold text-stone-800 uppercase tracking-wider">
                          <Sparkles className="w-3.5 h-3.5 text-[#d49e3d]" />
                          <span>Think of the English</span>
                        </div>
                        <p className="text-xs font-serif leading-relaxed text-stone-600">
                          请在脑中检索该英文表达，点击下方按钮大声说出。说完点击完成提交。
                        </p>
                      </div>

                      {/* Recording status & Live speech transcript */}
                      {isRecording && (
                        <div className="p-3 bg-[#182319] border-2 border-stone-900 rounded-xs text-stone-100 space-y-2 shadow-inner animate-in fade-in duration-150">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <div className="flex items-center gap-2 text-[#d49e3d]">
                              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
                              <span className="font-bold">正在倾听你的英文口语...</span>
                            </div>
                            <span className="text-stone-400 text-[11px]">说完点击下方完成</span>
                          </div>
                          <div className="font-serif-display text-base text-stone-100 min-h-[32px] italic">
                            {recognizedText ? `"${recognizedText}"` : '请大声说出英文，说完点击下方完成...'}
                          </div>
                        </div>
                      )}

                      {/* Recording Error Banner */}
                      {recordingError && (
                        <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xs text-amber-900 text-xs flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <div>{recordingError}</div>
                            <div className="text-[11px] text-amber-700">
                              若多次无法开启麦克风，可直接点击下方的「直接看答案」。
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons: Start / Stop Speaking */}
                      <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                        {!isRecording ? (
                          <button
                            onClick={startRecording}
                            className="w-full sm:flex-1 py-3 bg-[#243427] hover:bg-[#2d4231] active:translate-y-0.5 text-stone-100 border-2 border-stone-900 rounded-xs font-serif-display font-black text-sm shadow-[3px_3px_0px_#101711] cursor-pointer flex items-center justify-center gap-2 transition-all"
                          >
                            <Mic className="w-4 h-4 text-[#d49e3d]" />
                            <span>开始说 (按空格)</span>
                          </button>
                        ) : (
                          <button
                            onClick={stopRecordingAndEvaluate}
                            className="w-full sm:flex-1 py-3 bg-[#99332e] hover:bg-[#a83833] active:translate-y-0.5 text-white border-2 border-stone-900 rounded-xs font-serif-display font-black text-sm shadow-[3px_3px_0px_#101711] cursor-pointer flex items-center justify-center gap-2 transition-all animate-pulse"
                          >
                            <Square className="w-4 h-4 fill-current" />
                            <span>完成说并提交判定</span>
                          </button>
                        )}

                        {/* Direct Reveal button (Marked as revealed) */}
                        <button
                          onClick={handleRevealDirectly}
                          className="w-full sm:w-auto px-4 py-3 bg-[#faf7ee] hover:bg-white text-stone-700 border-2 border-stone-900 rounded-xs font-serif-display font-bold text-xs shadow-[2px_2px_0px_#101711] cursor-pointer flex items-center justify-center gap-1.5 transition-all shrink-0"
                          title="未开口直接翻看答案，本卡片记为未掌握"
                        >
                          <Eye className="w-3.5 h-3.5 text-stone-500" />
                          <span>直接看答案 (记为未掌握)</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Step 4: Evaluated Answer Surface */
                    <div className="space-y-3.5 animate-in fade-in duration-150">
                      <div className="border-t border-dashed border-stone-400 my-1" />

                      {/* Direct Reveal Warning Badge */}
                      {isRevealedDirectly ? (
                        <div className="p-2.5 bg-[#fbf0ed] border border-[#99332e]/50 rounded-xs text-[#99332e] text-xs flex items-center gap-2 font-mono">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>未开口直接看答案：记为未掌握 (Revealed)，仅可选择「没记住 (AGAIN)」。</span>
                        </div>
                      ) : (
                        /* Retrieval & Pronunciation Scoring Result Banner */
                        <div className="p-3 bg-[#243427] border-2 border-stone-900 rounded-xs text-stone-100 space-y-1.5">
                          <div className="flex items-center justify-between text-xs border-b border-stone-700 pb-1.5 flex-wrap gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] text-stone-400">提取判定：</span>
                              {recallEvaluation?.result === 'pass' && (
                                <span className="bg-[#2a834f] text-white font-mono text-xs font-bold px-2 py-0.5 rounded-xs">
                                  ✓ PASS 提取成功
                                </span>
                              )}
                              {recallEvaluation?.result === 'partial' && (
                                <span className="bg-[#d49e3d] text-stone-950 font-mono text-xs font-bold px-2 py-0.5 rounded-xs">
                                  ~ PARTIAL 部分提取
                                </span>
                              )}
                              {recallEvaluation?.result === 'fail' && (
                                <span className="bg-[#99332e] text-white font-mono text-xs font-bold px-2 py-0.5 rounded-xs">
                                  ✗ FAIL 提取不全
                                </span>
                              )}
                            </div>

                            <div className="font-mono text-xs text-stone-300">
                              词汇覆盖率：
                              <span className="text-[#d49e3d] font-bold">
                                {recallEvaluation?.accuracyPercent ?? 0}%
                              </span>
                            </div>
                          </div>

                          {/* Spoken Text Display */}
                          <div className="text-xs font-serif text-stone-300 leading-relaxed">
                            <span className="text-stone-400 font-mono text-[11px]">你的录音识别：</span>
                            <span className="italic text-stone-100 ml-1">
                              {recognizedText ? `"${recognizedText}"` : '(未检测到清晰发音)'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Standard Natural English Expression */}
                      <div className="space-y-0.5">
                        <span className="font-mono text-[11px] text-stone-500 uppercase tracking-wider font-bold">
                          地道母语表达 (Standard Target)
                        </span>
                        <div className="font-serif-display text-xl sm:text-2xl font-black text-stone-950 leading-snug break-words">
                          "{currentCard.natural}"
                        </div>
                      </div>

                      {/* Register Variants (Casual / Formal) if available */}
                      {(currentCard.variants?.casual || currentCard.variants?.formal) && (
                        <div className="flex flex-wrap gap-2 text-xs pt-0.5">
                          {currentCard.variants?.casual && (
                            <div className="p-1.5 bg-[#faf7ee] rounded-xs border border-stone-300 flex items-center gap-1.5">
                              <span className="font-mono text-[10px] bg-stone-200 px-1.5 py-0.5 rounded-xs font-bold">
                                口语
                              </span>
                              <span className="font-serif text-stone-900">{currentCard.variants.casual}</span>
                            </div>
                          )}
                          {currentCard.variants?.formal && (
                            <div className="p-1.5 bg-[#faf7ee] rounded-xs border border-stone-300 flex items-center gap-1.5">
                              <span className="font-mono text-[10px] bg-stone-200 px-1.5 py-0.5 rounded-xs font-bold">
                                书面
                              </span>
                              <span className="font-serif text-stone-900">{currentCard.variants.formal}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Explanation Markdown (默认折叠，防止手机端过长) */}
                      {currentCard.explanation && (
                        <div className="pt-1">
                          <button
                            onClick={() => setIsExplanationExpanded((prev) => !prev)}
                            className="w-full py-2 px-3 bg-[#faf7ee] hover:bg-white text-stone-800 border border-stone-400/80 rounded-xs font-serif-display font-bold text-xs flex items-center justify-between cursor-pointer transition-colors shadow-xs"
                          >
                            <span className="flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-[#d49e3d]" />
                              <span>深度知识解析与母语建议</span>
                            </span>
                            <span className="font-mono text-[11px] text-stone-600 flex items-center gap-0.5">
                              {isExplanationExpanded ? (
                                <>
                                  <span>收起</span>
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </>
                              ) : (
                                <>
                                  <span>展开查看</span>
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </>
                              )}
                            </span>
                          </button>

                          {isExplanationExpanded && (
                            <div className="mt-2 text-xs text-stone-700 font-serif leading-relaxed bg-[#faf7ee] p-3.5 rounded-xs border border-stone-400/80 max-h-[32vh] overflow-y-auto animate-in fade-in duration-150">
                              <MarkdownRenderer content={currentCard.explanation} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Punched Holes Row */}
                <div className="punch-holes-row border-t border-dashed border-stone-400/60 bg-[#eee5c6] shrink-0">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} className="punch-hole-dot" />
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Controls (Pinned) */}
            <div className="px-3 sm:px-6 py-2 sm:py-3 bg-[#182319] border-t-2 border-stone-900 shrink-0 flex flex-col gap-2 shadow-[0_-4px_12px_rgba(0,0,0,0.2)]">
              {/* Option A: 系统推荐操作引导条（判定完成后出现） */}
              {isEvaluated && (
                <div className="flex items-center justify-between text-[11px] font-mono text-stone-300 bg-[#243427] px-2.5 py-1 rounded-xs border border-stone-800">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#d49e3d] animate-pulse" />
                    <span>
                      系统推荐：
                      <span className="text-[#d49e3d] font-bold uppercase">
                        {recommendedRating === 'good' && 'GOOD (提取成功)'}
                        {recommendedRating === 'hard' && 'HARD (有点难)'}
                        {recommendedRating === 'again' && 'AGAIN (没记住)'}
                      </span>
                      ，按 <kbd className="bg-stone-800 px-1 py-0.2 rounded-xs border border-stone-700">空格</kbd> 或 <kbd className="bg-stone-800 px-1 py-0.2 rounded-xs border border-stone-700">回车</kbd> 确认
                    </span>
                  </div>
                  <span className="hidden sm:inline text-stone-400 text-[10px]">可点击其它旋钮自主微调</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Left Undo Button */}
                <div className="flex items-center justify-between sm:justify-start gap-2">
                  <button
                    onClick={handleUndo}
                    disabled={historyStack.length === 0}
                    className="bg-[#243427] hover:bg-[#304434] disabled:opacity-40 text-stone-300 font-serif-display font-bold text-xs py-1.5 sm:py-2 px-3 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#0e1610] flex items-center gap-1.5 cursor-pointer transition-all disabled:cursor-not-allowed"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>撤销 (Z)</span>
                  </button>

                  <div className="sm:hidden flex items-center gap-1 font-mono text-[11px] text-[#d49e3d] font-bold">
                    <span>❖ +2🪶</span>
                  </div>
                </div>

                {/* 4 Rotary Telegraph Dials (Option A: 动态智能高亮推荐) */}
                <div className="grid grid-cols-4 gap-1.5 sm:gap-3 flex-1 max-w-sm sm:max-w-md mx-auto sm:mx-0">
                  {/* 1. AGAIN */}
                  <button
                    onClick={() => handleRate('again')}
                    disabled={!isEvaluated}
                    className={`flex flex-col items-center group cursor-pointer transition-all ${
                      !isEvaluated ? 'opacity-30 cursor-not-allowed' : ''
                    }`}
                    title="快捷键: 1"
                  >
                    <div
                      className={`telegraph-dial-knob group-hover:scale-105 transition-transform ${
                        isEvaluated && recommendedRating === 'again'
                          ? 'ring-2 ring-[#99332e] shadow-[0_0_10px_#99332e]/60 scale-105'
                          : ''
                      }`}
                    >
                      <div className="telegraph-dial-slit -rotate-45" />
                    </div>
                    <span
                      className={`font-mono text-[9px] sm:text-[10px] font-bold mt-1 ${
                        isEvaluated && recommendedRating === 'again'
                          ? 'text-[#e57373]'
                          : 'text-stone-300'
                      }`}
                    >
                      AGAIN
                    </span>
                    <span
                      className={`font-serif text-[10px] sm:text-[11px] whitespace-nowrap ${
                        isEvaluated && recommendedRating === 'again'
                          ? 'text-[#e57373] font-bold'
                          : 'text-stone-400'
                      }`}
                    >
                      {isEvaluated && recommendedRating === 'again' ? '★ 推荐 · 1' : '没记住 · 1'}
                    </span>
                  </button>

                  {/* 2. HARD */}
                  <button
                    onClick={() => handleRate('hard')}
                    disabled={!isEvaluated || isRevealedDirectly}
                    className={`flex flex-col items-center group cursor-pointer transition-all ${
                      !isEvaluated || isRevealedDirectly ? 'opacity-30 cursor-not-allowed' : ''
                    }`}
                    title="快捷键: 2"
                  >
                    <div
                      className={`telegraph-dial-knob group-hover:scale-105 transition-transform ${
                        isEvaluated && recommendedRating === 'hard'
                          ? 'ring-2 ring-[#d49e3d] shadow-[0_0_10px_#d49e3d]/60 scale-105'
                          : ''
                      }`}
                    >
                      <div className="telegraph-dial-slit -rotate-15" />
                    </div>
                    <span
                      className={`font-mono text-[9px] sm:text-[10px] font-bold mt-1 ${
                        isEvaluated && recommendedRating === 'hard'
                          ? 'text-[#d49e3d]'
                          : 'text-stone-300'
                      }`}
                    >
                      HARD
                    </span>
                    <span
                      className={`font-serif text-[10px] sm:text-[11px] whitespace-nowrap ${
                        isEvaluated && recommendedRating === 'hard'
                          ? 'text-[#d49e3d] font-bold'
                          : 'text-stone-400'
                      }`}
                    >
                      {isEvaluated && recommendedRating === 'hard' ? '★ 推荐 · 2' : '有点难 · 2'}
                    </span>
                  </button>

                  {/* 3. GOOD */}
                  <button
                    onClick={() => handleRate('good')}
                    disabled={!isEvaluated || isRevealedDirectly}
                    className={`flex flex-col items-center group cursor-pointer transition-all ${
                      !isEvaluated || isRevealedDirectly ? 'opacity-30 cursor-not-allowed' : ''
                    }`}
                    title="快捷键: 3"
                  >
                    <div
                      className={`telegraph-dial-knob group-hover:scale-105 transition-transform ${
                        isEvaluated && recommendedRating === 'good'
                          ? 'ring-2 ring-[#2a834f] shadow-[0_0_10px_#2a834f]/60 scale-105'
                          : ''
                      }`}
                    >
                      <div className="telegraph-dial-slit rotate-20" />
                    </div>
                    <span
                      className={`font-mono text-[9px] sm:text-[10px] font-bold mt-1 ${
                        isEvaluated && recommendedRating === 'good'
                          ? 'text-[#4ade80]'
                          : 'text-stone-300'
                      }`}
                    >
                      GOOD
                    </span>
                    <span
                      className={`font-serif text-[10px] sm:text-[11px] whitespace-nowrap ${
                        isEvaluated && recommendedRating === 'good'
                          ? 'text-[#4ade80] font-bold'
                          : 'text-stone-400'
                      }`}
                    >
                      {isEvaluated && recommendedRating === 'good' ? '★ 推荐 · 3' : '提取成功 · 3'}
                    </span>
                  </button>

                  {/* 4. EASY */}
                  <button
                    onClick={() => handleRate('easy')}
                    disabled={!isEvaluated || isRevealedDirectly}
                    className={`flex flex-col items-center group cursor-pointer transition-all ${
                      !isEvaluated || isRevealedDirectly ? 'opacity-30 cursor-not-allowed' : ''
                    }`}
                    title="快捷键: 4"
                  >
                    <div className="telegraph-dial-knob group-hover:scale-105 transition-transform">
                      <div className="telegraph-dial-slit rotate-60" />
                    </div>
                    <span className="font-mono text-[9px] sm:text-[10px] font-bold text-stone-300 mt-1">
                      EASY
                    </span>
                    <span className="font-serif text-[10px] sm:text-[11px] text-stone-400 whitespace-nowrap">
                      太简单 · 4
                    </span>
                  </button>
                </div>

                {/* Right Feather Asset Badge */}
                <div className="hidden sm:flex items-center gap-1 font-mono text-xs text-[#d49e3d] font-bold bg-[#243427] px-3 py-1.5 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#0e1610] shrink-0">
                  <span>❖ 羽毛资产 +2</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Finished State */
          <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center space-y-4 overflow-y-auto">
            <div className="w-16 h-16 rounded-full bg-[#d49e3d] text-stone-950 flex items-center justify-center text-2xl font-black shadow-md border-2 border-stone-900">
              ✓
            </div>

            <h3 className="font-serif-display text-2xl sm:text-3xl font-black text-[#f7f2e4]">
              电文复核圆满完成
            </h3>

            <p className="text-xs sm:text-sm text-stone-400 max-w-xs font-serif">
              你已完成本批 {cards.length} 封电报的主动提取复核，巩固了记忆周期并获得羽毛奖励！
            </p>

            <button
              onClick={() => {
                sound.playKeyClick();
                onClose();
              }}
              className="px-6 py-2.5 bg-[#d49e3d] hover:bg-[#c99333] text-stone-950 font-serif-display font-black text-sm rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#0e1610] cursor-pointer transition-all"
            >
              完成并归卷
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
