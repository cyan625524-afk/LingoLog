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
  RotateCcw,
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

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

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

  // 重置单张卡片的交互状态
  const resetCardState = () => {
    stopCurrentAudioTracks();
    setIsRecording(false);
    setRecognizedText('');
    setIsEvaluated(false);
    setIsRevealedDirectly(false);
    setRecallEvaluation(null);
    setRecordingError(null);
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

  // 停止录音与清理音轨
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
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  };

  // 组件卸载时释放资源
  useEffect(() => {
    return () => {
      stopCurrentAudioTracks();
    };
  }, []);

  // 启动录音与 ASR（零运行时 AI，浏览器本地 SpeechRecognition + MediaStream）
  const startRecording = async () => {
    if (!currentCard) return;
    sound.playKeyClick();
    setRecordingError(null);
    setRecognizedText('');

    const hasRecognition =
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    // 1. 获取麦克风权限
    let stream: MediaStream | null = null;
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
      }
    } catch (err: any) {
      console.warn('Microphone permission error:', err);
      const errName = String(err?.name || '');
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setRecordingError('麦克风权限被拒绝，请在手机或浏览器设置中开启本站麦克风权限。');
      } else {
        setRecordingError('未能连接麦克风，可检查设备或直接点击「直接看答案」。');
      }
      return;
    }

    // 2. 启动语音识别
    if (hasRecognition) {
      try {
        const SpeechRecognition =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((r: any) => r[0].transcript)
            .join(' ')
            .trim();
          if (transcript) {
            setRecognizedText(transcript);
          }
        };

        recognition.onerror = (e: any) => {
          console.warn('Recognition notice:', e);
          if (e?.error === 'not-allowed') {
            setRecordingError('麦克风权限未授予。');
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('SpeechRecognition failed to init:', err);
      }
    }

    // 3. 启动 MediaRecorder 保持音频上下文活跃
    if (stream && typeof MediaRecorder !== 'undefined') {
      try {
        const recorder = new MediaRecorder(stream);
        recorder.start();
        mediaRecorderRef.current = recorder;
      } catch {}
    }

    setIsRecording(true);
  };

  // 结束录音并执行本地提取判定
  const stopRecordingAndEvaluate = (textOverride?: string) => {
    sound.playKeyClick();
    stopCurrentAudioTracks();
    setIsRecording(false);

    const finalText = (textOverride !== undefined ? textOverride : recognizedText).trim();

    if (!currentCard) return;

    // 纯前端本地判定，零 API 调用
    const evaluation = evaluateRecall(
      currentCard.natural,
      finalText,
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

  // 用户未开口，直接看答案（强制标记为 revealed，只能记为未掌握）
  const handleRevealDirectly = () => {
    sound.playCardFlip();
    stopCurrentAudioTracks();
    setIsRecording(false);
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

  // 快捷键支持
  useEffect(() => {
    if (!isOpen || isFinished) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 避免在输入框触发
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea') return;

      if (e.key === 'Escape') {
        e.preventDefault();
        sound.playKeyClick();
        onClose();
        return;
      }

      // 空格键：在未评测时用于「开始说」/「完成说」
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (!isEvaluated) {
          if (!isRecording) {
            startRecording();
          } else {
            stopRecordingAndEvaluate();
          }
        }
        return;
      }

      // 评级快捷键 1~4（仅在完成提取或翻面后生效）
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
    historyStack,
    recognizedText,
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
                        原句情景参考：{currentCard.original}
                      </div>
                    )}
                  </div>

                  {/* Step 2 & 3: Extraction Area (Think + Record) */}
                  {!isEvaluated ? (
                    <div className="space-y-4 pt-2">
                      <div className="p-3.5 bg-[#faf7ee] rounded-xs border border-stone-400/80 text-stone-700 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-mono font-bold text-stone-800 uppercase tracking-wider">
                          <Sparkles className="w-3.5 h-3.5 text-[#d49e3d]" />
                          <span>Think of the English</span>
                        </div>
                        <p className="text-xs font-serif leading-relaxed text-stone-600">
                          请在脑中检索该表达，点击下方按钮大声说出英文。系统将通过本地词汇覆盖率算法判定提取准确度。
                        </p>
                      </div>

                      {/* Recording status & Live speech transcript */}
                      {isRecording && (
                        <div className="p-3.5 bg-[#182319] border-2 border-stone-900 rounded-xs text-stone-100 space-y-2 shadow-inner">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <div className="flex items-center gap-2 text-[#d49e3d]">
                              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
                              <span className="font-bold">正在录音与实时识别...</span>
                            </div>
                            <span className="text-stone-400 text-[11px]">按空格或点击下方完成</span>
                          </div>
                          <div className="font-serif-display text-base text-stone-200 min-h-[36px] italic">
                            {recognizedText ? `"${recognizedText}"` : '等待开口发音...'}
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
                              提示：您仍可以直接点击下方的「直接看答案」继续复习流程。
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Main Action Buttons: Start / Stop Speaking */}
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
                            onClick={() => stopRecordingAndEvaluate()}
                            className="w-full sm:flex-1 py-3 bg-[#99332e] hover:bg-[#a83833] active:translate-y-0.5 text-white border-2 border-stone-900 rounded-xs font-serif-display font-black text-sm shadow-[3px_3px_0px_#101711] cursor-pointer flex items-center justify-center gap-2 transition-all animate-pulse"
                          >
                            <Square className="w-4 h-4 fill-current" />
                            <span>完成说并提交判定 (空格)</span>
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
                    <div className="space-y-4 animate-in fade-in duration-150">
                      <div className="border-t border-dashed border-stone-400 my-2" />

                      {/* Direct Reveal Warning Badge */}
                      {isRevealedDirectly ? (
                        <div className="p-2.5 bg-[#fbf0ed] border border-[#99332e]/50 rounded-xs text-[#99332e] text-xs flex items-center gap-2 font-mono">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>未开口直接看答案：本轮记为未掌握 (Revealed)，不计入成功次数。</span>
                        </div>
                      ) : (
                        /* Retrieval & Pronunciation Scoring Result Banner */
                        <div className="p-3 bg-[#243427] border-2 border-stone-900 rounded-xs text-stone-100 space-y-2">
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
                      <div className="space-y-1">
                        <span className="font-mono text-[11px] text-stone-500 uppercase tracking-wider font-bold">
                          地道母语表达 (Standard Target)
                        </span>
                        <div className="font-serif-display text-xl sm:text-2xl font-black text-stone-950 leading-snug break-words">
                          "{currentCard.natural}"
                        </div>
                      </div>

                      {/* Register Variants (Casual / Formal) if available */}
                      {(currentCard.variants?.casual || currentCard.variants?.formal) && (
                        <div className="flex flex-wrap gap-2 text-xs pt-1">
                          {currentCard.variants?.casual && (
                            <div className="p-2 bg-[#faf7ee] rounded-xs border border-stone-300 flex items-center gap-1.5">
                              <span className="font-mono text-[10px] bg-stone-200 px-1.5 py-0.5 rounded-xs font-bold">
                                口语
                              </span>
                              <span className="font-serif text-stone-900">{currentCard.variants.casual}</span>
                            </div>
                          )}
                          {currentCard.variants?.formal && (
                            <div className="p-2 bg-[#faf7ee] rounded-xs border border-stone-300 flex items-center gap-1.5">
                              <span className="font-mono text-[10px] bg-stone-200 px-1.5 py-0.5 rounded-xs font-bold">
                                书面
                              </span>
                              <span className="font-serif text-stone-900">{currentCard.variants.formal}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Explanation Markdown */}
                      {currentCard.explanation && (
                        <div className="text-xs text-stone-700 font-serif leading-relaxed bg-[#faf7ee] p-3.5 rounded-xs border border-stone-400/80 max-h-[30vh] overflow-y-auto">
                          <MarkdownRenderer content={currentCard.explanation} />
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
            <div className="px-3 sm:px-6 py-2.5 sm:py-3.5 bg-[#182319] border-t-2 border-stone-900 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.2)]">
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

              {/* 4 Rotary Telegraph Dials */}
              <div className="grid grid-cols-4 gap-1.5 sm:gap-3 flex-1 max-w-sm sm:max-w-md mx-auto sm:mx-0">
                {/* 1. AGAIN (始终可用，直接看答案时唯一可选评级) */}
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
                      isEvaluated && (isRevealedDirectly || recallEvaluation?.result === 'fail')
                        ? 'ring-2 ring-[#99332e] shadow-[0_0_8px_#99332e]/50'
                        : ''
                    }`}
                  >
                    <div className="telegraph-dial-slit -rotate-45" />
                  </div>
                  <span className="font-mono text-[9px] sm:text-[10px] font-bold text-stone-300 mt-1">
                    AGAIN
                  </span>
                  <span className="font-serif text-[10px] sm:text-[11px] text-stone-400 whitespace-nowrap">
                    没记住 · 1
                  </span>
                </button>

                {/* 2. HARD (直接看答案时禁用) */}
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
                      isEvaluated && !isRevealedDirectly && recallEvaluation?.result === 'partial'
                        ? 'ring-2 ring-[#d49e3d] shadow-[0_0_8px_#d49e3d]/50'
                        : ''
                    }`}
                  >
                    <div className="telegraph-dial-slit -rotate-15" />
                  </div>
                  <span className="font-mono text-[9px] sm:text-[10px] font-bold text-stone-300 mt-1">
                    HARD
                  </span>
                  <span className="font-serif text-[10px] sm:text-[11px] text-stone-400 whitespace-nowrap">
                    有点难 · 2
                  </span>
                </button>

                {/* 3. GOOD (直接看答案时禁用，pass 时推荐) */}
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
                      isEvaluated && !isRevealedDirectly && recallEvaluation?.result === 'pass'
                        ? 'ring-2 ring-[#d49e3d] shadow-[0_0_10px_#d49e3d]/40'
                        : ''
                    }`}
                  >
                    <div className="telegraph-dial-slit rotate-20" />
                  </div>
                  <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#d49e3d] mt-1">
                    GOOD
                  </span>
                  <span className="font-serif text-[10px] sm:text-[11px] text-[#d49e3d] font-bold whitespace-nowrap">
                    提取成功 · 3
                  </span>
                </button>

                {/* 4. EASY (直接看答案时禁用) */}
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
