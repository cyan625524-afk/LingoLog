import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Volume2,
  BookmarkPlus,
  RotateCcw,
  Check,
  Mic,
  ArrowRight,
  Loader2,
  Copy,
  ChevronRight,
  History,
  AlertCircle,
  TrendingUp,
  Layers,
  Radio,
  Send,
  X,
} from 'lucide-react';
import { FlashCard, RegisterVariants, InputHistoryItem } from '../../types';
import { sound } from '../../utils/audio';
import { speakEnglishText } from '../../utils/tts';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import {
  INSPIRATION_DATA,
  findInspirationMatch,
  createCardFromInspiration,
} from '../../data/inspirationData';
import { translateSpokenInput } from '../../data/spokenTranslator';
import { normalizeCategory, sanitizeTags, findSimilarCard } from '../../utils/storage';
import { getCardChronologicalMap, formatCardNumber } from '../../utils/cardOrder';
import { pickCoreHighlights } from '../../utils/highlightPicker';
import { HighlightedText } from '../common/HighlightedText';
import { TeleprinterPaperCard } from '../common/TeleprinterPaperCard';
import { TelegramStamp } from '../common/TelegramStamp';
import { BrassNameplate } from '../common/BrassNameplate';
import { SignalLamp } from '../common/SignalLamp';
import { PerforatedDivider } from '../common/PerforatedDivider';

interface StudyViewProps {
  onOptimized: (card: FlashCard) => void;
  modelName: string;
  apiKey?: string;
  provider?: string;
  baseUrl?: string;
  typewriterSkin?: 'sage' | 'classic' | 'gold' | 'leather' | 'midnight' | 'emerald';
  onOpenSpeechPractice?: (card: FlashCard) => void;
  existingCards?: FlashCard[];
  onNavigateToReview?: (targetCard?: FlashCard) => void;
  onGeneratingStateChange?: (isGenerating: boolean, progress: number, stage?: string) => void;
}

export const StudyView: React.FC<StudyViewProps> = ({
  onOptimized,
  modelName,
  apiKey,
  provider,
  baseUrl,
  typewriterSkin = 'classic',
  onOpenSpeechPractice,
  existingCards = [],
  onNavigateToReview,
  onGeneratingStateChange,
}) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activePressedKey, setActivePressedKey] = useState<string | null>(null);
  const [generatedCard, setGeneratedCard] = useState<FlashCard | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<FlashCard | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, []);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [selectionPos, setSelectionPos] = useState<{ x: number; y: number } | null>(null);
  const [isMobileCardModalOpen, setIsMobileCardModalOpen] = useState(false);

  // Escape key listener for mobile card modal
  useEffect(() => {
    if (!isMobileCardModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        sound.playKeyClick();
        setIsMobileCardModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileCardModalOpen]);

  const [inputHistory, setInputHistory] = useState<InputHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('lingolog_input_history_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Quick Voice Evaluation State
  const [isRecording, setIsRecording] = useState(false);
  const [quickScore, setQuickScore] = useState<number | null>(null);
  const [quickFeedback, setQuickFeedback] = useState<string | null>(null);
  const [spokenText, setSpokenText] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Selected Register Variant tab & tone
  const [selectedVariant, setSelectedVariant] = useState<'casual' | 'neutral' | 'formal'>('neutral');
  const [selectedTone, setSelectedTone] = useState<'自然' | '正式'>('自然');

  // Chronological order mapping (earliest added = No.001)
  const cardChronologicalMap = useMemo(() => {
    return getCardChronologicalMap(existingCards);
  }, [existingCards]);

  // Drafting number: if 96 cards already exist, draft order is No.097.
  // If the currently displayed card has just been saved, its assigned order is retained.
  const currentDraftNo = useMemo(() => {
    if (generatedCard && isSaved) {
      const existingOrder = cardChronologicalMap.get(generatedCard.id);
      if (existingOrder) {
        return formatCardNumber(existingOrder);
      }
      return formatCardNumber(existingCards.length);
    }
    return formatCardNumber(existingCards.length + 1);
  }, [existingCards, generatedCard, isSaved, cardChronologicalMap]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeKeyTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, [generatedCard]);

  // Save history helper
  const addToHistory = (text: string, category?: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setInputHistory((prev) => {
      const filtered = prev.filter((h) => h.text !== trimmed);
      const updated = [
        { id: `hist-${Date.now()}`, text: trimmed, timestamp: Date.now(), category },
        ...filtered,
      ].slice(0, 20);
      try {
        localStorage.setItem('lingolog_input_history_v1', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Check duplicates in existing cards
  useEffect(() => {
    if (!generatedCard || existingCards.length === 0) {
      setDuplicateWarning(null);
      return;
    }
    const dup = findSimilarCard(generatedCard.natural, existingCards);
    setDuplicateWarning(dup);
  }, [generatedCard, existingCards]);

  // Tactile key flash helper
  const flashKeycap = (rawKey: string) => {
    if (!rawKey) return;
    sound.playKeyClick();

    let normalized = rawKey.toUpperCase();
    if (rawKey === ' ' || rawKey === 'Space') normalized = 'SPACE';
    else if (rawKey === 'Enter') normalized = 'TRANSMIT';
    else if (rawKey === 'Backspace') normalized = 'DEL';

    setActivePressedKey(normalized);
    if (activeKeyTimerRef.current) clearTimeout(activeKeyTimerRef.current);
    activeKeyTimerRef.current = setTimeout(() => {
      setActivePressedKey(null);
    }, 120);
  };

  // Keyboard listener for typing feedback
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) return;
      flashKeycap(e.key);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Text selection listener for custom red ribbon marking
  const clearSelectionHint = () => {
    setSelectedText(null);
    setSelectionPos(null);
  };

  const handleTextMouseUp = () => {
    // 只有出过回电电文，才谈得上给它标重点
    if (!generatedCard) {
      clearSelectionHint();
      return;
    }
    const selection = window.getSelection();
    const raw = selection?.toString().trim() ?? '';
    if (
      !selection ||
      selection.rangeCount === 0 ||
      !raw ||
      raw.length >= 50 ||
      (generatedCard.redHighlights || []).some((h) => h.toLowerCase() === raw.toLowerCase())
    ) {
      clearSelectionHint();
      return;
    }
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    setSelectedText(raw);
    setSelectionPos({ x: rect.left + rect.width / 2, y: rect.top });
  };

  // 浮出按钮用的是视口坐标，页面一滚动就会飘走，所以滚动即收起
  useEffect(() => {
    if (!selectedText) return;
    const hide = () => {
      setSelectedText(null);
      setSelectionPos(null);
    };
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [selectedText]);

  const handleApplyCustomRedHighlight = () => {
    if (!selectedText || !generatedCard) return;
    sound.playKeyClick();
    const currentHighlights = generatedCard.redHighlights || [];
    if (!currentHighlights.includes(selectedText)) {
      setGeneratedCard({
        ...generatedCard,
        redHighlights: [...currentHighlights, selectedText],
      });
    }
    clearSelectionHint();
    window.getSelection()?.removeAllRanges();
  };

  const handleRemoveRedHighlight = (targetText: string) => {
    if (!generatedCard || !generatedCard.redHighlights) return;
    sound.playKeyClick();
    setGeneratedCard({
      ...generatedCard,
      redHighlights: generatedCard.redHighlights.filter((h) => h !== targetText),
    });
  };

  // Smart Fallback Card Generator
  // 返回 null = 离线词库确实没有这条表达。调用方必须如实说明，
  // 不要造一张空卡片，更不要拿一句无关的英文顶上。
  const createFallbackCard = (rawText: string): FlashCard | null => {
    const localMatch = findInspirationMatch(rawText);
    if (localMatch) {
      const c = createCardFromInspiration(localMatch);
      c.original = rawText;
      if (!c.redHighlights || c.redHighlights.length === 0) {
        c.redHighlights = pickCoreHighlights(c.natural);
      }
      return c;
    }

    const spokenResult = translateSpokenInput(rawText);
    if (!spokenResult) return null;

    const highlights: string[] = pickCoreHighlights(spokenResult.natural);

    // 只命中「主题关键词」规则时，给的是同主题的模板句，不是原句的翻译。
    // 这种情况必须在卡片里写明，否则用户会当成逐句翻译去背。
    const topicNotice =
      spokenResult.confidence === 'topic'
        ? '⚠️ 离线词库没有收录这句话的逐句译法。下面这条是「同主题的地道表达」，只能当灵感参考，不能当成你这句话的翻译。\n\n'
        : '';

    return {
      id: `card-${Date.now()}`,
      original: rawText,
      natural: spokenResult.natural,
      explanation: topicNotice + spokenResult.explanation,
      category: normalizeCategory(spokenResult.category),
      tags: sanitizeTags(spokenResult.tags),
      phrases: spokenResult.phrases || [],
      variants: spokenResult.variants || {
        casual: spokenResult.natural,
        neutral: spokenResult.natural,
        formal: spokenResult.natural,
      },
      redHighlights: highlights,
      createdAt: new Date().toISOString(),
      nextReviewAt: new Date().toISOString(),
      intervalStage: 0,
      reviewCount: 0,
      masteryLevel: 'learning',
      isFavorite: false,
      readCount: 0,
    };
  };

  // Inspire Me random button
  const handleInspireMe = () => {
    sound.playKeyClick();
    const randomIndex = Math.floor(Math.random() * INSPIRATION_DATA.length);
    const item = INSPIRATION_DATA[randomIndex];
    setInputText(item.translatedText);
  };

  // Generate / Transmit Telegram
  const handleGenerate = async () => {
    const query = inputText.trim();
    if (!query || isLoading) return;

    sound.playCarriageReturn();
    sound.playMorseSidetone('dash');
    setIsLoading(true);
    setLoadError(null);
    setIsSaved(false);
    setQuickScore(null);
    setQuickFeedback(null);
    setSpokenText(null);
    setSelectedText(null);
    addToHistory(query);

    // Start punch-tape progress animation
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    let currentProgress = 8;
    onGeneratingStateChange?.(true, currentProgress, '电码编译中...');

    progressTimerRef.current = setInterval(() => {
      if (currentProgress < 94) {
        const step =
          currentProgress < 25
            ? 5
            : currentProgress < 55
            ? 3.5
            : currentProgress < 78
            ? 2
            : 0.8;
        currentProgress = Math.min(94, currentProgress + step);
        const stage =
          currentProgress < 25
            ? '电码编译中...'
            : currentProgress < 60
            ? '专线传输中...'
            : currentProgress < 82
            ? '母语润色中...'
            : '电报校核中...';
        onGeneratingStateChange?.(true, currentProgress, stage);
      }
    }, 110);

    let attempt = 0;
    let cardSuccess = false;
    // 是否真的产出了一张卡（无论来自模型还是离线库）。进度条的最终播报看它，
    // 不看 cardSuccess —— 离线库命中时 cardSuccess 仍是 false，但卡是有的。
    let producedCard = false;

    while (attempt < 2 && !cardSuccess) {
      attempt++;
      try {
        const response = await fetch('/api/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(30000),
          body: JSON.stringify({
            input: query,
            modelName,
            apiKey,
            provider,
            baseUrl,
            tone: selectedTone,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            const item = result.data;
            const newCard: FlashCard = {
              id: `card-${Date.now()}`,
              original: item.original || query,
              natural: item.natural || query,
              category: normalizeCategory(item.category),
              tags: sanitizeTags(item.tags || []),
              explanation: item.explanation || '',
              phrases: Array.isArray(item.phrases) ? item.phrases : [],
              variants: item.variants || {
                casual: item.colloquial || item.natural,
                neutral: item.natural,
                formal: item.formal || item.natural,
              },
              redHighlights:
                item.redHighlights && item.redHighlights.length > 0
                  ? item.redHighlights
                  : pickCoreHighlights(item.natural),
              createdAt: new Date().toISOString(),
              nextReviewAt: new Date().toISOString(),
              intervalStage: 0,
              reviewCount: 0,
              masteryLevel: 'learning',
              isFavorite: false,
              readCount: 0,
            };
            sound.playCarriageReturn();
            sound.playMorseSidetone('ack');
            setGeneratedCard(newCard);
            producedCard = true;
            setIsMobileCardModalOpen(true);
            if (result.isOfflineFallback) {
              setLoadError('电报局专线繁忙，已自动启用离线地道语料库为你拍发并解析电文。');
            }
            cardSuccess = true;
            break;
          }
        }
      } catch {
        // Retry once, then use the local fallback below.
      }
    }

    if (!cardSuccess) {
      const fallbackCard = createFallbackCard(query);
      if (fallbackCard) {
        sound.playCarriageReturn();
        sound.playMorseSidetone('ack');
        setGeneratedCard(fallbackCard);
        producedCard = true;
        setIsMobileCardModalOpen(true);
        setLoadError('电报局专线繁忙，已自动启用离线地道语料库为你拍发并解析电文。');
      } else {
        // 离线词库确实没有这条 —— 如实说明，不给假答案。
        setLoadError(
          '电报局专线没接通，离线词库也没有收录这条表达。这里不会给你一句「看起来像答案」的英文：猜错了你照着背，比没有更糟。请点右上角「开启引擎」配置 API 密钥，由模型给你真实的地道表达。'
        );
      }
    }

    // Finish punch-tape animation: hit 100% then settle back to idle full tape.
    // 这里过去无论成败都播报「电文已送达」，连失败都在报好消息 ——
    // 用户看到的是「进度条一拉满、然后什么都没有」，还判断不出到底成没成。
    // 成没成必须如实说，失败还要多停一会儿，让人来得及看见。
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (producedCard) {
      onGeneratingStateChange?.(true, 100, '电文已送达');
      setTimeout(() => {
        onGeneratingStateChange?.(false, 100, '');
      }, 700);
    } else {
      onGeneratingStateChange?.(true, 100, '电文未能送达');
      setTimeout(() => {
        onGeneratingStateChange?.(false, 100, '');
      }, 2200);
    }

    setIsLoading(false);
  };

  // Quick Speech Record & Evaluate
  const handleQuickSpeechRecord = () => {
    if (!generatedCard) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // 不用 alert：手机上它可能被拦截、或者弹成整屏，关掉之后什么都不剩。
      // 用页面内的提示，用户还能回头看，也知道该换什么设备。
      setLoadError(
        '这台浏览器不提供语音识别，没法在这里跟读打分。想练跟读请用电脑上的 Chrome / Edge，或打开卡片用录音回放对比。'
      );
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsRecording(true);
        sound.playKeyClick();
      };

      recognition.onresult = async (event: any) => {
        const transcript = Array.from(event.results || [])
          .map((result: any) => result?.[0]?.transcript || '')
          .join(' ')
          .trim();
        if (!transcript) return;
        setSpokenText(transcript);
        setIsRecording(false);

        const target = generatedCard.natural.toLowerCase().replace(/[^a-z0-9]/g, ' ');
        const spoken = transcript.toLowerCase().replace(/[^a-z0-9]/g, ' ');

        const targetWords = target.split(/\s+/).filter(Boolean);
        const spokenWords = spoken.split(/\s+/).filter(Boolean);

        let matchCount = 0;
        targetWords.forEach((tw: string) => {
          if (spokenWords.includes(tw)) matchCount++;
        });

        const calcScore = Math.min(
          100,
          Math.max(40, Math.round((matchCount / Math.max(1, targetWords.length)) * 100))
        );

        setQuickScore(calcScore);
        if (calcScore >= 85) {
          sound.playSuccess();
          setQuickFeedback('🌟 电台试音优秀：发音清晰连贯，语调极度地道！');
        } else if (calcScore >= 65) {
          sound.playKeyClick();
          setQuickFeedback('👍 电台试音良好：表达基本准确，可强化连读节奏。');
        } else {
          sound.playKeyClick();
          setQuickFeedback('💡 建议点击下方「示范发音」收听后重新试音。');
        }
      };

      recognition.onerror = (event: any) => {
        setIsRecording(false);
        setLoadError(
          event?.error === 'not-allowed'
            ? '麦克风权限被拒绝，请在浏览器设置中允许麦克风。'
            : '语音识别失败，请检查麦克风后重试。'
        );
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsRecording(false);
      setLoadError('语音识别启动失败，请检查浏览器和麦克风权限。');
    }
  };

  // Save Card to Library
  const handleSaveToLibrary = () => {
    if (!generatedCard || isSaved) return;
    sound.playSuccess();
    onOptimized(generatedCard);
    setIsSaved(true);
  };

  // Reset / Write Next
  const handleWriteNext = () => {
    sound.playCarriageReturn();
    setInputText('');
    setGeneratedCard(null);
    setIsMobileCardModalOpen(false);
    setIsSaved(false);
    setLoadError(null);
    setQuickScore(null);
    setQuickFeedback(null);
  };

  const handleCopyNatural = () => {
    if (!generatedCard) return;
    sound.playKeyClick();
    const textToCopy =
      selectedVariant === 'casual' && generatedCard.variants?.casual
        ? generatedCard.variants.casual
        : selectedVariant === 'formal' && generatedCard.variants?.formal
        ? generatedCard.variants.formal
        : generatedCard.natural;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Dynamic Typewriter Skin Themes
  const skinHeaderClasses = useMemo(() => {
    switch (typewriterSkin) {
      case 'gold':
        return 'bg-linear-to-r from-[#d49e3d] via-[#f7d984] to-[#c99430] text-stone-950 border-stone-900 shadow-[inset_0px_1px_0px_rgba(255,255,255,0.6)]';
      case 'emerald':
        return 'bg-[#1c3829] text-[#e8dbb5] border-stone-900';
      case 'midnight':
        return 'bg-[#1a201c] text-stone-200 border-stone-900';
      case 'leather':
        return 'bg-[#5c3a21] text-[#f4edd3] border-stone-900';
      case 'sage':
        return 'bg-[#2d4231] text-[#e8dbb5] border-stone-900';
      default:
        return 'bg-[#d49e3d] text-stone-900 border-stone-900';
    }
  }, [typewriterSkin]);

  const skinSendBtnClasses = useMemo(() => {
    switch (typewriterSkin) {
      case 'gold':
        return 'bg-linear-to-r from-[#d49e3d] via-[#f7d984] to-[#c99430] hover:brightness-105 text-stone-950';
      case 'emerald':
        return 'bg-[#1c3829] hover:bg-[#254d37] text-[#e8dbb5]';
      case 'midnight':
        return 'bg-[#222a24] hover:bg-[#2e3a31] text-[#d49e3d]';
      case 'leather':
        return 'bg-[#5c3a21] hover:bg-[#734829] text-[#f4edd3]';
      case 'sage':
        return 'bg-[#2d4231] hover:bg-[#3d5943] text-[#e8dbb5]';
      default:
        return 'bg-[#d49e3d] hover:bg-[#c99333] text-stone-900';
    }
  }, [typewriterSkin]);

  return (
    <div
      id="lingolog-learn-view"
      className="flex-1 w-full bg-[#182319] pt-5 sm:pt-8 pb-24 md:pb-8 px-4 sm:px-6 flex flex-col items-center justify-start text-stone-100 transition-colors select-none"
      onMouseUp={handleTextMouseUp}
    >
      {/* 拍发电报 / 跟读的失败提示。
          这里踩过两个坑，都记在这：
          1. loadError 原先有 9 处赋值，但 JSX 里 0 处读取 —— 一条只写不读的死通道。
             「拍发电报失败后页面什么也没有」就是它。
          2. 就算渲染出来，放在文档流顶端也没用：手机用户是往下滚着看卡片的，
             提示会落在视口之外，等于没显示。所以这里用 fixed 浮在视口上。 */}
      {loadError && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[90] w-[92%] max-w-2xl p-3 bg-amber-950/95 border-2 border-amber-500/70 text-amber-50 rounded-lg shadow-xl flex items-start justify-between gap-3 text-xs text-left">
          <div className="flex items-start gap-2">
            <span className="text-base shrink-0">📮</span>
            <span className="leading-relaxed">{loadError}</span>
          </div>
          <button
            onClick={() => setLoadError(null)}
            className="px-2 py-1 bg-amber-800 hover:bg-amber-700 text-amber-50 rounded text-xs shrink-0 cursor-pointer"
          >
            知晓
          </button>
        </div>
      )}

      <div className="w-full max-w-5xl flex flex-col items-center">
        {/* 2-Column Dashboard Grid */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* LEFT COLUMN: 电文起草单 (Drafting Form) */}
          <div className="w-full flex flex-col shadow-[4px_4px_0px_#0e1610]">
            {/* Top Header */}
            <div className={`${skinHeaderClasses} font-serif-display font-black px-4 py-2.5 border-2 flex justify-between items-center rounded-t-xs transition-colors`}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-wide">电文起草单</span>
                {typewriterSkin && typewriterSkin !== 'classic' && (
                  <span className="text-[10px] font-mono font-bold uppercase opacity-85 px-1.5 py-0.5 rounded-xs border border-current">
                    {typewriterSkin === 'gold' ? '皇家金箔' : typewriterSkin === 'emerald' ? '剑桥墨绿' : typewriterSkin === 'midnight' ? '极夜黑曜石' : typewriterSkin}
                  </span>
                )}
              </div>
              <span className="font-mono text-xs font-bold opacity-80">{currentDraftNo}</span>
            </div>

            {/* Cream Paper Body */}
            <div className="bg-[#f4edd3] border-2 border-t-0 border-stone-900 p-4 sm:p-6 text-stone-900 flex flex-col rounded-b-xs space-y-4 sm:space-y-5">
              {/* Input Label & Textarea */}
              <div>
                <label className="block text-xs font-serif-display font-black text-stone-800 mb-1.5">
                  发报人灵感（中文想法）
                </label>
                <div className="bg-[#faf7ee] border-2 border-stone-900 p-3 rounded-xs shadow-inner">
                  <textarea
                    ref={textareaRef}
                    id="typewriter-input-area"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === 'Enter' &&
                        !e.nativeEvent.isComposing &&
                        (e.ctrlKey || e.metaKey)
                      ) {
                        e.preventDefault();
                        handleGenerate();
                      }
                    }}
                    rows={4}
                    placeholder="我想喝奶茶，但我怕胖…"
                    className="w-full bg-transparent resize-none border-none outline-none font-serif text-base leading-relaxed text-stone-900 placeholder:text-stone-400"
                  />
                </div>
              </div>

              {/* Tone Setting Only (自然 / 正式) - Row 1 buttons */}
              <div>
                <div className="flex items-center justify-between text-xs font-serif-display font-black text-stone-800 mb-1.5">
                  <span>风格设定</span>
                  <span className="text-[10px] font-mono text-stone-500 font-bold uppercase">
                    {selectedTone === '自然' ? 'NATURAL · 地道日常' : 'FORMAL · 严谨规范'}
                  </span>
                </div>
                <div className="grid grid-cols-2 bg-stone-200/90 p-1 border-2 border-stone-900 rounded-xs h-[42px] items-center gap-1">
                  <button
                    type="button"
                    id="tone-natural-btn"
                    onClick={() => {
                      sound.playKeyClick();
                      setSelectedTone('自然');
                    }}
                    className={`h-full text-xs font-serif-display font-black rounded-xs transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      selectedTone === '自然'
                        ? 'bg-[#d49e3d] text-stone-900 shadow-[1px_1px_0px_#101711]'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    自然（日常母语）
                  </button>
                  <button
                    type="button"
                    id="tone-formal-btn"
                    onClick={() => {
                      sound.playKeyClick();
                      setSelectedTone('正式');
                    }}
                    className={`h-full text-xs font-serif-display font-black rounded-xs transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      selectedTone === '正式'
                        ? 'bg-[#d49e3d] text-stone-900 shadow-[1px_1px_0px_#101711]'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    正式（商务机要）
                  </button>
                </div>
              </div>

              {/* Action Buttons: Row 2 buttons with matching height and clean rhythm */}
              <div className="space-y-2.5">
                <div className="grid grid-cols-5 gap-2.5 sm:gap-3">
                  <button
                    id="transmit-telegram-btn"
                    onClick={handleGenerate}
                    disabled={!inputText.trim() || isLoading}
                    className={`col-span-3 h-[42px] ${skinSendBtnClasses} active:translate-y-0.5 font-serif-display font-black text-xs sm:text-sm px-3 sm:px-4 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>电传编码中…</span>
                      </>
                    ) : (
                      <>
                        <span>↵ 拍发电报</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleInspireMe}
                    className="col-span-2 h-[42px] bg-[#faf7ee] hover:bg-white active:translate-y-0.5 text-stone-900 font-serif-display font-bold text-xs sm:text-sm px-2 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] cursor-pointer transition-all flex items-center justify-center gap-1 text-center"
                    title="从灵感库投递或换一句"
                  >
                    <span>↻ 灵感投递</span>
                  </button>
                </div>

                {/* On mobile: Quick re-open banner if user dismissed the popup */}
                {generatedCard && !isMobileCardModalOpen && (
                  <div className="md:hidden pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        sound.playKeyClick();
                        setIsMobileCardModalOpen(true);
                      }}
                      className="w-full py-2.5 px-3 bg-[#243427] hover:bg-[#1a251c] text-[#d49e3d] font-serif-display text-xs font-black rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#0e1610] flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                        <span>查看刚拍发的回电电报</span>
                      </span>
                      <span className="underline text-[11px]">{isSaved ? '已归档' : '点击去归档 ↵'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: RECEIVED · 已回电 (Teleprinter Output) - Hidden on mobile, shown on md+ screens */}
          <div className="hidden md:flex w-full flex-col">
            {/* Top Label */}
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="bg-[#243427] border border-[#37493a] text-stone-300 text-[11px] px-3 py-1 font-mono tracking-widest font-bold uppercase rounded-xs">
                  {generatedCard ? 'RECEIVED · 最新回电' : 'INVENTORY · 上张电文'}
                </span>
                {!generatedCard && existingCards && existingCards.length > 0 && (
                  <span className="text-[11px] text-stone-400 font-serif">
                    （库存回电 · 点击可去复习）
                  </span>
                )}
              </div>
              {!generatedCard && existingCards && existingCards.length > 0 && onNavigateToReview && (
                <button
                  type="button"
                  onClick={() => {
                    sound.playKeyClick();
                    onNavigateToReview(existingCards[0]);
                  }}
                  className="text-xs font-serif-display font-bold text-[#d49e3d] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>前往复习 ↵</span>
                </button>
              )}
            </div>

            {/* Teleprinter Paper Card with punched holes */}
            <div
              id="received-telegram-card"
              className="w-full bg-[#f4edd3] border-2 border-stone-900 shadow-[4px_4px_0px_#0e1610] rounded-xs overflow-hidden flex flex-col justify-between min-h-[380px]"
            >
              {/* Top Punched Holes Row */}
              <div className="punch-holes-row border-b border-dashed border-stone-400/60 bg-[#eee5c6]">
                {Array.from({ length: 22 }).map((_, i) => (
                  <div key={i} className="punch-hole-dot" />
                ))}
              </div>

              {/* Telegram Content Body */}
              <div className="p-5 sm:p-6 text-stone-900 space-y-4 flex-1 flex flex-col justify-between">
                {generatedCard ? (
                  /* CASE A: Newly Generated Card */
                  <div>
                    {/* Category Header & Stamp */}
                    <div className="flex items-center justify-between border-b border-dashed border-stone-400 pb-2 mb-3">
                      <span className="font-serif-display text-xs font-black text-stone-700">
                        — {generatedCard.category || '地道表达'} · {currentDraftNo} —
                      </span>

                      <div className="border-2 border-[#99332e] text-[#99332e] font-mono text-[10px] font-black px-2 py-0.5 tracking-wider rotate-[-2deg] rounded-xs">
                        地道 IDIOMATIC
                      </div>
                    </div>

                    {/* Main Natural Output with Red Highlights */}
                    <div className="font-serif-display text-xl sm:text-2xl font-black text-stone-950 leading-snug my-3 select-text">
                      <HighlightedText
                        text={
                          selectedVariant === 'casual' && generatedCard.variants?.casual
                            ? generatedCard.variants.casual
                            : selectedVariant === 'formal' && generatedCard.variants?.formal
                            ? generatedCard.variants.formal
                            : generatedCard.natural
                        }
                        highlights={generatedCard.redHighlights}
                        onRemove={handleRemoveRedHighlight}
                      />
                    </div>

                    {/* Chinese Meaning */}
                    <div className="font-serif text-sm text-stone-600 mb-3">
                      {generatedCard.original}
                    </div>

                    {/* Dashed Separator */}
                    <div className="border-t border-dashed border-stone-400 my-2" />

                    {/* Register info / Note */}
                    <div className="text-xs text-stone-600 font-serif leading-relaxed">
                      {generatedCard.explanation ? (
                        <MarkdownRenderer content={generatedCard.explanation} />
                      ) : (
                        <p>
                          <strong>语域：{selectedTone}风格</strong> · 地道母语发音解析。
                        </p>
                      )}
                    </div>
                  </div>
                ) : existingCards && existingCards.length > 0 ? (
                  /* CASE B: Inventory's Previous Card */
                  <div>
                    {/* Category Header & Stamp */}
                    <div className="flex items-center justify-between border-b border-dashed border-stone-400 pb-2 mb-3">
                      <span className="font-serif-display text-xs font-black text-stone-700">
                        — {existingCards[0].category || '日常表达'} · {formatCardNumber(cardChronologicalMap.get(existingCards[0].id))} —
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          sound.playKeyClick();
                          onNavigateToReview?.(existingCards[0]);
                        }}
                        className="border-2 border-[#243427] bg-[#243427] hover:bg-[#182319] text-[#d49e3d] font-mono text-[10px] font-black px-2.5 py-0.5 tracking-wider rounded-xs flex items-center gap-1 cursor-pointer transition-colors shadow-[1px_1px_0px_#0e1610]"
                      >
                        <span>点击去复习 ↵</span>
                      </button>
                    </div>

                    {/* Main Natural Output */}
                    <div
                      onClick={() => {
                        sound.playKeyClick();
                        onNavigateToReview?.(existingCards[0]);
                      }}
                      title="点击前往复习此电文"
                      className="font-serif-display text-xl sm:text-2xl font-black text-stone-950 leading-snug my-3 cursor-pointer hover:text-stone-700 transition-colors group flex flex-col"
                    >
                      <div>
                        <HighlightedText
                          text={existingCards[0].natural}
                          highlights={existingCards[0].redHighlights}
                        />
                      </div>
                      <span className="text-xs font-mono font-bold text-[#99332e] mt-1.5 opacity-80 group-hover:opacity-100 flex items-center gap-1">
                        <span>[点击此电文可直接进入复习 ↵]</span>
                      </span>
                    </div>

                    {/* Chinese Meaning */}
                    <div className="font-serif text-sm text-stone-600 mb-3">
                      {existingCards[0].original}
                    </div>

                    {/* Dashed Separator */}
                    <div className="border-t border-dashed border-stone-400 my-2" />

                    {/* Register info / Note */}
                    <div className="text-xs text-stone-600 font-serif leading-relaxed">
                      {existingCards[0].explanation ? (
                        <MarkdownRenderer content={existingCards[0].explanation} />
                      ) : (
                        <p>
                          <strong>库存电文</strong> · 该电文已归档在您的电文库中，点击上方或下方按钮可立即复习。
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  /* CASE C: Fallback Sample when Inventory is Empty */
                  <div>
                    <div className="flex items-center justify-between border-b border-dashed border-stone-400 pb-2 mb-3">
                      <span className="font-serif-display text-xs font-black text-stone-700">
                        — 示例 · 拍发第一张电文 —
                      </span>

                      <div className="border-2 border-stone-400 text-stone-600 font-mono text-[10px] font-black px-2 py-0.5 tracking-wider rounded-xs">
                        示例 SAMPLE
                      </div>
                    </div>

                    <div className="font-serif-display text-xl sm:text-2xl font-black text-stone-950 leading-snug my-3">
                      "I'm{' '}
                      <span className="text-[#99332e] underline decoration-dashed decoration-[#99332e] font-bold">
                        dying for
                      </span>{' '}
                      a bubble tea, but I'm watching my waistline."
                    </div>

                    <div className="font-serif text-sm text-stone-600 mb-3">
                      我想喝奶茶，但我怕胖
                    </div>

                    <div className="border-t border-dashed border-stone-400 my-2" />

                    <div className="text-xs text-stone-600 font-serif leading-relaxed">
                      <p>
                        在左侧起草单写下中文，点击「拍发电报」后将在此打印专属电文卡片。
                      </p>
                    </div>
                  </div>
                )}

                {/* Action Buttons Row */}
                {generatedCard ? (
                  <div className="space-y-2 pt-3 border-t border-stone-300">
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          sound.playKeyClick();
                          speakEnglishText(
                            selectedVariant === 'casual' && generatedCard.variants?.casual
                              ? generatedCard.variants.casual
                              : selectedVariant === 'formal' && generatedCard.variants?.formal
                              ? generatedCard.variants.formal
                              : generatedCard.natural
                          );
                        }}
                        className="bg-[#d49e3d] hover:bg-[#c99333] active:translate-y-0.5 text-stone-900 font-serif-display font-black text-xs py-2 px-1.5 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] flex items-center justify-center gap-1 cursor-pointer transition-all"
                      >
                        <span>▶ 朗读</span>
                      </button>

                      {onOpenSpeechPractice ? (
                        <button
                          type="button"
                          onClick={() => {
                            sound.playKeyClick();
                            onOpenSpeechPractice(generatedCard);
                          }}
                          className="bg-[#faf7ee] hover:bg-white active:translate-y-0.5 text-stone-900 font-serif-display font-bold text-xs py-2 px-1.5 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] flex items-center justify-center gap-1 cursor-pointer transition-all"
                          title="开启电波口语试音室"
                        >
                          <Mic className="w-3.5 h-3.5 text-[#99332e]" />
                          <span>口语试音</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleWriteNext}
                          className="bg-[#faf7ee] hover:bg-white active:translate-y-0.5 text-stone-900 font-serif-display font-bold text-xs py-2 px-1.5 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] flex items-center justify-center gap-1 cursor-pointer transition-all"
                        >
                          <span>↺ 重发</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleCopyNatural}
                        className="bg-[#faf7ee] hover:bg-white active:translate-y-0.5 text-stone-900 font-serif-display font-bold text-xs py-2 px-1.5 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] flex items-center justify-center gap-1 cursor-pointer transition-all"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <span>⧉ 复制</span>}
                      </button>

                      <button
                        type="button"
                        id="desktop-archive-btn"
                        onClick={handleSaveToLibrary}
                        disabled={isSaved}
                        className={`active:translate-y-0.5 text-white font-serif-display font-black text-xs py-2 px-1.5 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] flex items-center justify-center gap-1 cursor-pointer transition-all ${
                          isSaved
                            ? 'bg-emerald-800 text-white'
                            : 'bg-[#99332e] hover:bg-[#852a25]'
                        }`}
                      >
                        {isSaved ? <span>✓ 已入库</span> : <span>✚ 归档</span>}
                      </button>
                    </div>

                    {onOpenSpeechPractice && (
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={handleWriteNext}
                          className="text-[11px] text-stone-600 hover:text-stone-950 font-serif-display font-bold hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <span>↺ 清空起草新电文</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : existingCards && existingCards.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2 pt-3 border-t border-stone-300">
                    <button
                      onClick={() => {
                        sound.playKeyClick();
                        speakEnglishText(existingCards[0].natural);
                      }}
                      className="bg-[#d49e3d] hover:bg-[#c99333] active:translate-y-0.5 text-stone-900 font-serif-display font-black text-xs py-2 px-2 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] flex items-center justify-center gap-1 cursor-pointer transition-all"
                    >
                      <span>▶ 朗读</span>
                    </button>

                    <button
                      onClick={() => {
                        sound.playKeyClick();
                        navigator.clipboard.writeText(existingCards[0].natural);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="bg-[#faf7ee] hover:bg-white active:translate-y-0.5 text-stone-900 font-serif-display font-bold text-xs py-2 px-2 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] flex items-center justify-center gap-1 cursor-pointer transition-all"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <span>⧉ 复制</span>}
                    </button>

                    <button
                      onClick={() => {
                        sound.playKeyClick();
                        onNavigateToReview?.(existingCards[0]);
                      }}
                      className="col-span-2 bg-[#243427] hover:bg-[#182319] active:translate-y-0.5 text-[#d49e3d] font-serif-display font-black text-xs py-2 px-2 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] flex items-center justify-center gap-1 cursor-pointer transition-all"
                    >
                      <span>★ 点击去复习此电文</span>
                    </button>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-stone-300 text-center text-xs text-stone-500 font-mono">
                    [ 等待发报信号输入 · READY ]
                  </div>
                )}
              </div>

              {/* Bottom Punched Holes Row */}
              <div className="punch-holes-row border-t border-dashed border-stone-400/60 bg-[#eee5c6]">
                {Array.from({ length: 22 }).map((_, i) => (
                  <div key={i} className="punch-hole-dot" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Modal: Pops up on mobile after sending telegram, allowing immediate archive */}
        {isMobileCardModalOpen && generatedCard && (
          <div
            id="mobile-telegram-popup-modal"
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/75 backdrop-blur-xs md:hidden animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsMobileCardModalOpen(false);
              }
            }}
          >
            <div className="w-full max-w-md bg-[#f4edd3] border-2 border-stone-900 shadow-[6px_6px_0px_#0e1610] rounded-xs overflow-hidden flex flex-col max-h-[88vh]">
              {/* Top Punched Holes Row */}
              <div className="punch-holes-row border-b border-dashed border-stone-400/60 bg-[#eee5c6]">
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="punch-hole-dot" />
                ))}
              </div>

              {/* Modal Header */}
              <div className="bg-[#d49e3d] border-b-2 border-stone-900 px-4 py-2.5 flex items-center justify-between text-stone-900">
                <div className="flex items-center gap-2">
                  <span className="font-serif-display font-black text-xs tracking-wider">
                    ❖ 拍发回电 · RECEIVED
                  </span>
                  <span className="border border-stone-900 text-[10px] font-mono font-bold px-1.5 py-0.2 bg-[#f4edd3] rounded-xs">
                    {selectedTone}风格
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sound.playKeyClick();
                    setIsMobileCardModalOpen(false);
                  }}
                  className="p-1 text-stone-900 hover:bg-stone-900/10 rounded-xs cursor-pointer"
                  title="关闭弹窗"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Scrollable Content */}
              <div className="p-4 overflow-y-auto space-y-3.5 text-stone-900">
                {/* Category & Status */}
                <div className="flex items-center justify-between border-b border-dashed border-stone-400 pb-2">
                  <span className="font-serif-display text-xs font-black text-stone-700">
                    — {generatedCard.category || '地道表达'} · {currentDraftNo} —
                  </span>
                  <div className="border-2 border-[#99332e] text-[#99332e] font-mono text-[10px] font-black px-2 py-0.5 tracking-wider rotate-[-2deg] rounded-xs">
                    地道 IDIOMATIC
                  </div>
                </div>

                {/* Natural English Output with Red Highlights */}
                <div className="font-serif-display text-lg sm:text-xl font-black text-stone-950 leading-snug my-2">
                  <HighlightedText
                    text={
                      selectedVariant === 'casual' && generatedCard.variants?.casual
                        ? generatedCard.variants.casual
                        : selectedVariant === 'formal' && generatedCard.variants?.formal
                        ? generatedCard.variants.formal
                        : generatedCard.natural
                    }
                    highlights={generatedCard.redHighlights}
                    onRemove={handleRemoveRedHighlight}
                  />
                </div>

                {/* Chinese Meaning */}
                <div className="font-serif text-xs text-stone-600 bg-[#faf7ee] p-2.5 rounded-xs border border-stone-300">
                  <span className="font-mono text-[10px] text-stone-400 block mb-0.5">发报原稿：</span>
                  {generatedCard.original}
                </div>

                {/* Nuance & Explanation */}
                <div className="text-xs text-stone-700 font-serif leading-relaxed bg-[#eee8d1]/70 p-2.5 rounded-xs border border-stone-300/80">
                  <span className="font-mono text-[10px] text-stone-500 block mb-1 font-bold">
                    母语析义 · REGISTRATION & NUANCE:
                  </span>
                  {generatedCard.explanation ? (
                    <MarkdownRenderer content={generatedCard.explanation} />
                  ) : (
                    <p>语域：{selectedTone}风格表达，用词纯正自然。</p>
                  )}
                </div>

                {/* Audio, Speech & Copy Row */}
                <div className={`grid ${onOpenSpeechPractice ? 'grid-cols-3' : 'grid-cols-2'} gap-2 pt-1`}>
                  <button
                    type="button"
                    onClick={() => {
                      sound.playKeyClick();
                      speakEnglishText(
                        selectedVariant === 'casual' && generatedCard.variants?.casual
                          ? generatedCard.variants.casual
                          : selectedVariant === 'formal' && generatedCard.variants?.formal
                          ? generatedCard.variants.formal
                          : generatedCard.natural
                      );
                    }}
                    className="bg-[#faf7ee] hover:bg-white active:translate-y-0.5 text-stone-900 font-serif-display font-bold text-xs py-2 px-2 rounded-xs border-2 border-stone-900 shadow-[1px_1px_0px_#101711] flex items-center justify-center gap-1 cursor-pointer transition-all"
                  >
                    <span>▶ 朗读</span>
                  </button>

                  {onOpenSpeechPractice && (
                    <button
                      type="button"
                      onClick={() => {
                        sound.playKeyClick();
                        setIsMobileCardModalOpen(false);
                        onOpenSpeechPractice(generatedCard);
                      }}
                      className="bg-[#faf7ee] hover:bg-white active:translate-y-0.5 text-stone-900 font-serif-display font-bold text-xs py-2 px-2 rounded-xs border-2 border-stone-900 shadow-[1px_1px_0px_#101711] flex items-center justify-center gap-1 cursor-pointer transition-all"
                    >
                      <Mic className="w-3.5 h-3.5 text-[#99332e]" />
                      <span>口语试音</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleCopyNatural}
                    className="bg-[#faf7ee] hover:bg-white active:translate-y-0.5 text-stone-900 font-serif-display font-bold text-xs py-2 px-2 rounded-xs border-2 border-stone-900 shadow-[1px_1px_0px_#101711] flex items-center justify-center gap-1 cursor-pointer transition-all"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <span>⧉ 复制</span>}
                  </button>
                </div>
              </div>

              {/* Modal Footer with Archive button */}
              <div className="p-3 bg-[#eee5c6] border-t-2 border-stone-900 space-y-2">
                <button
                  type="button"
                  id="mobile-modal-archive-btn"
                  onClick={handleSaveToLibrary}
                  disabled={isSaved}
                  className={`w-full py-3 px-4 font-serif-display font-black text-sm rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    isSaved
                      ? 'bg-emerald-800 text-white cursor-default'
                      : 'bg-[#99332e] hover:bg-[#852a25] active:translate-y-0.5 text-white'
                  }`}
                >
                  {isSaved ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>已成功归档入库</span>
                    </>
                  ) : (
                    <>
                      <span>✚ 立即归档入库</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.playKeyClick();
                    setIsMobileCardModalOpen(false);
                  }}
                  className="w-full py-1 text-xs font-serif-display font-bold text-stone-600 hover:text-stone-950 text-center cursor-pointer"
                >
                  返回继续起草
                </button>
              </div>

              {/* Bottom Punched Holes Row */}
              <div className="punch-holes-row border-t border-dashed border-stone-400/60 bg-[#eee5c6]">
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="punch-hole-dot" />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 划选电文后浮出的「标为重点」按钮 */}
      {selectedText && selectionPos && (
        <button
          type="button"
          id="mark-red-highlight-btn"
          // 关键：阻止 mousedown 默认行为，否则浏览器会先清空选区，click 就再也拿不到 selectedText
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleApplyCustomRedHighlight}
          style={{
            left: selectionPos.x,
            top: selectionPos.y,
            transform: 'translate(-50%, calc(-100% - 10px))',
          }}
          className="fixed z-50 bg-[#99332e] hover:bg-[#852a25] text-white font-serif-display font-black text-xs pl-2.5 pr-3 py-1.5 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          title="把选中的文字标记为红色重点（点击已标红的文字可撤销）"
        >
          <span className="w-2 h-2 rounded-full bg-white/90 inline-block shrink-0" />
          <span>标为重点</span>
          <span className="font-mono text-[10px] font-bold opacity-75 max-w-[8rem] truncate">
            {selectedText}
          </span>
        </button>
      )}
    </div>
  );
};
