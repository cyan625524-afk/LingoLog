import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Volume2,
  Undo2,
  Check,
  Eye,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { FlashCard, ReviewHistoryEntry, ReviewRating } from '../../types';
import { sound } from '../../utils/audio';
import { speakEnglishText, prefetchEnglishText } from '../../utils/tts';
import { getCardChronologicalMap, formatCardNumber } from '../../utils/cardOrder';
import { MarkdownRenderer } from '../common/MarkdownRenderer';

interface FlashcardReviewModalProps {
  cards: FlashCard[];
  allCards?: FlashCard[];
  isOpen: boolean;
  onClose: () => void;
  onGradeCard: (cardId: string, rating: ReviewRating) => void;
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
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  // Chronological order map (earliest added = No.001)
  const cardChronologicalMap = useMemo(() => {
    return getCardChronologicalMap(allCards && allCards.length > 0 ? allCards : cards);
  }, [allCards, cards]);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setIsFlipped(false);
      setIsFinished(false);
      setReviewedCount(0);
    }
  }, [isOpen, cards]);

  // 静默预热当前复习卡片的英伦男声音频
  useEffect(() => {
    if (isOpen && cards && cards[currentIndex]?.natural) {
      prefetchEnglishText(cards[currentIndex].natural);
    }
  }, [isOpen, cards, currentIndex]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    if (!isOpen || isFinished) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        sound.playKeyClick();
        onClose();
        return;
      }

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        sound.playCardFlip();
        setIsFlipped((prev) => !prev);
      } else if (isFlipped) {
        if (e.key === '1') handleRate('again');
        else if (e.key === '2') handleRate('hard');
        else if (e.key === '3') handleRate('good');
        else if (e.key === '4') handleRate('easy');
      }

      if ((e.key === 'z' || e.key === 'Z') && historyStack.length > 0) {
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFlipped, isFinished, currentIndex, historyStack, onClose]);

  if (!isOpen) return null;

  const currentCard = cards[currentIndex];

  const handleRate = (rating: ReviewRating) => {
    if (!currentCard) return;
    sound.playKeyClick();
    onGradeCard(currentCard.id, rating);
    setReviewedCount((prev) => prev + 1);

    if (currentIndex + 1 < cards.length) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
      sound.playCardFlip();
    } else {
      setIsFinished(true);
      sound.playSuccess();
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });
    }
  };

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
      setIsFlipped(true);
    }
  };

  // Cloze generator for front side hint
  const generateCloze = (text: string) => {
    return text
      .split(' ')
      .map((w) => {
        if (w.length <= 1) return w;
        return w[0] + '_'.repeat(Math.min(3, w.length - 1));
      })
      .join(' ');
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
              电报复核工位
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
              title="退出复习 (点空白处或Esc)"
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
              {/* The Teleprinter Paper Dispatch Sheet (Image 2 style) */}
              <div className="w-full bg-[#f4edd3] border-2 border-stone-900 shadow-[3px_3px_0px_#0e1610] rounded-xs overflow-hidden flex flex-col shrink-0">
                {/* Top Punched Holes Row */}
                <div className="punch-holes-row border-b border-dashed border-stone-400/60 bg-[#eee5c6] shrink-0">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} className="punch-hole-dot" />
                  ))}
                </div>

                {/* Main Sheet Body */}
                <div className="p-4 sm:p-6 text-stone-900 space-y-4">
                  {/* Header line with Category & Speaker */}
                  <div className="flex items-center justify-between border-b border-dashed border-stone-400 pb-2">
                    <span className="font-serif-display text-xs font-black text-stone-700">
                      — {currentCard.category || '日常社交'} · {formatCardNumber(cardChronologicalMap.get(currentCard.id) ?? (currentIndex + 1))} —
                    </span>

                    <button
                      onClick={() => {
                        sound.playKeyClick();
                        speakEnglishText(currentCard.natural);
                      }}
                      className="bg-[#d49e3d] hover:bg-[#c99333] active:translate-y-0.5 text-stone-950 font-serif-display font-black text-[11px] py-1 px-2.5 rounded-xs border border-stone-900 shadow-[1px_1px_0px_#101711] flex items-center gap-1 cursor-pointer"
                    >
                      <Volume2 className="w-3 h-3" />
                      <span>朗读</span>
                    </button>
                  </div>

                  {/* Big Chinese Prompt */}
                  <div className="font-serif-display text-2xl sm:text-3xl font-black text-stone-950 leading-snug break-words">
                    "{currentCard.original}"
                  </div>

                  {/* Cloze Mask or Revealed Answer */}
                  {!isFlipped ? (
                    <div className="space-y-3">
                      <div className="text-[#99332e] font-mono text-base sm:text-lg font-bold tracking-wider py-1 break-words">
                        {generateCloze(currentCard.natural)}
                      </div>

                      <div className="pt-2">
                        <button
                          onClick={() => {
                            sound.playCardFlip();
                            setIsFlipped(true);
                          }}
                          className="w-full py-2.5 bg-[#faf7ee] hover:bg-white text-stone-900 border-2 border-stone-900 rounded-xs font-serif-display font-black text-xs shadow-[2px_2px_0px_#101711] cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#d49e3d]" />
                          <span>翻看译文并进行电键评级 (按空格)</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 animate-in fade-in zoom-in-95 duration-150">
                      <div className="border-t border-dashed border-stone-400 my-2" />

                      {/* Big Natural English */}
                      <div className="font-serif-display text-xl sm:text-2xl font-black text-stone-950 leading-snug break-words">
                        "{currentCard.natural}"
                      </div>

                      {/* Note / Explanation */}
                      {currentCard.explanation && (
                        <div className="text-xs text-stone-700 font-serif leading-relaxed bg-[#faf7ee] p-3.5 rounded-xs border border-stone-400/80 max-h-[36vh] overflow-y-auto">
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

            {/* Bottom Controls: Pinned so familiarity rating is ALWAYS accessible! */}
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

              {/* 4 Rotary Telegraph Dials (Image 2 style) */}
              <div className="grid grid-cols-4 gap-1.5 sm:gap-3 flex-1 max-w-sm sm:max-w-md mx-auto sm:mx-0">
                {/* 1. AGAIN */}
                <button
                  onClick={() => handleRate('again')}
                  className="flex flex-col items-center group cursor-pointer"
                  title="快捷键: 1"
                >
                  <div className="telegraph-dial-knob group-hover:scale-105 transition-transform">
                    <div className="telegraph-dial-slit -rotate-45" />
                  </div>
                  <span className="font-mono text-[9px] sm:text-[10px] font-bold text-stone-300 mt-1">AGAIN</span>
                  <span className="font-serif text-[10px] sm:text-[11px] text-stone-400 whitespace-nowrap">没记住 · 1</span>
                </button>

                {/* 2. HARD */}
                <button
                  onClick={() => handleRate('hard')}
                  className="flex flex-col items-center group cursor-pointer"
                  title="快捷键: 2"
                >
                  <div className="telegraph-dial-knob group-hover:scale-105 transition-transform">
                    <div className="telegraph-dial-slit -rotate-15" />
                  </div>
                  <span className="font-mono text-[9px] sm:text-[10px] font-bold text-stone-300 mt-1">HARD</span>
                  <span className="font-serif text-[10px] sm:text-[11px] text-stone-400 whitespace-nowrap">有点难 · 2</span>
                </button>

                {/* 3. GOOD (Gold highlighted in Image 2) */}
                <button
                  onClick={() => handleRate('good')}
                  className="flex flex-col items-center group cursor-pointer"
                  title="快捷键: 3"
                >
                  <div className="telegraph-dial-knob ring-2 ring-[#d49e3d] shadow-[0_0_10px_#d49e3d]/40 group-hover:scale-105 transition-transform">
                    <div className="telegraph-dial-slit rotate-20" />
                  </div>
                  <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#d49e3d] mt-1">GOOD</span>
                  <span className="font-serif text-[10px] sm:text-[11px] text-[#d49e3d] font-bold whitespace-nowrap">已掌握 · 3</span>
                </button>

                {/* 4. EASY */}
                <button
                  onClick={() => handleRate('easy')}
                  className="flex flex-col items-center group cursor-pointer"
                  title="快捷键: 4"
                >
                  <div className="telegraph-dial-knob group-hover:scale-105 transition-transform">
                    <div className="telegraph-dial-slit rotate-60" />
                  </div>
                  <span className="font-mono text-[9px] sm:text-[10px] font-bold text-stone-300 mt-1">EASY</span>
                  <span className="font-serif text-[10px] sm:text-[11px] text-stone-400 whitespace-nowrap">太简单 · 4</span>
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
              你已完成本批 {cards.length} 封电报的艾宾浩斯复核，巩固了记忆周期并获得羽毛奖励！
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
