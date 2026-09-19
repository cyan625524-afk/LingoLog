import React, { useState, useMemo } from 'react';
import {
  Play,
  Volume2,
  CheckCircle2,
  Shuffle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { FlashCard } from '../../types';
import { sound } from '../../utils/audio';
import {
  getOverdueDays,
  isCardDue,
  formatNextReviewHuman,
} from '../../utils/ebbinghaus';
import { speakEnglishText } from '../../utils/tts';
import { getCardChronologicalMap, formatCardNumber } from '../../utils/cardOrder';

interface ReviewViewProps {
  cards: FlashCard[];
  onStartFullReview: (selectedCards: FlashCard[]) => void;
  onSelectCardDetail: (card: FlashCard) => void;
  onToggleFavorite: (cardId: string) => void;
  dailyReviewLimit: number;
}

export const ReviewView: React.FC<ReviewViewProps> = ({
  cards,
  onStartFullReview,
  onSelectCardDetail,
  onToggleFavorite,
  dailyReviewLimit = 15,
}) => {
  const [filterMode, setFilterMode] = useState<'due' | 'all'>('due');
  const [revealedIds, setRevealedIds] = useState<string[]>([]);

  // Chronological order map (earliest added = No.001)
  const cardChronologicalMap = useMemo(() => {
    return getCardChronologicalMap(cards);
  }, [cards]);

  // Due and Overdue calculations
  const dueCards = useMemo(() => cards.filter((c) => isCardDue(c.nextReviewAt)), [cards]);
  const overdueCards = useMemo(
    () => dueCards.filter((c) => getOverdueDays(c.nextReviewAt) > 0),
    [dueCards]
  );
  const activeQueueCards = useMemo(
    () => dueCards.slice(0, dailyReviewLimit),
    [dueCards, dailyReviewLimit]
  );

  const displayedCards = filterMode === 'due' ? dueCards : cards;

  const toggleReveal = (id: string) => {
    sound.playCardFlip();
    setRevealedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleStartReview = () => {
    sound.playKeyClick();
    if (activeQueueCards.length > 0) {
      onStartFullReview(activeQueueCards);
    } else if (dueCards.length > 0) {
      onStartFullReview(dueCards);
    } else {
      const shuffled = [...cards].sort(() => 0.5 - Math.random()).slice(0, 10);
      onStartFullReview(shuffled);
    }
  };

  const handleShufflePractice = () => {
    sound.playKeyClick();
    const shuffled = [...cards].sort(() => 0.5 - Math.random()).slice(0, 10);
    onStartFullReview(shuffled);
  };

  return (
    <div
      id="lingolog-review-view"
      className="flex-1 w-full bg-[#182319] pt-5 sm:pt-8 pb-24 md:pb-8 px-4 sm:px-6 flex flex-col items-center text-stone-100 transition-colors select-none"
    >
      <div className="w-full max-w-5xl flex flex-col items-center">
        {/* Top Status Cards Row: 1 Row on both mobile and desktop for compact layout */}
        <div className="w-full grid grid-cols-3 gap-2 sm:gap-4 mb-5 sm:mb-6 items-stretch">
          {/* Card 1: 今日到期 (Amber Bulb) */}
          <div className="bg-[#243427] border-2 border-stone-900 rounded-xs p-2.5 sm:p-5 shadow-[3px_3px_0px_#0e1610] flex flex-col sm:flex-row sm:items-center justify-between">
            <div className="space-y-0.5 sm:space-y-1">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#d49e3d] shadow-[0_0_8px_#d49e3d] inline-block animate-pulse shrink-0" />
                <span className="font-serif-display font-bold text-[11px] sm:text-xs text-stone-300 whitespace-nowrap">
                  今日到期
                </span>
              </div>
              <div className="font-mono text-2xl sm:text-4xl font-black text-[#d49e3d] leading-none mt-1 sm:mt-0">
                {String(dueCards.length).padStart(2, '0')}
              </div>
            </div>
            <span className="hidden sm:inline text-stone-500 font-mono text-xs uppercase tracking-wider">
              DUE TODAY
            </span>
          </div>

          {/* Card 2: 逾期加急 (Red Bulb) */}
          <div className="bg-[#243427] border-2 border-stone-900 rounded-xs p-2.5 sm:p-5 shadow-[3px_3px_0px_#0e1610] flex flex-col sm:flex-row sm:items-center justify-between">
            <div className="space-y-0.5 sm:space-y-1">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#99332e] shadow-[0_0_8px_#99332e] inline-block animate-pulse shrink-0" />
                <span className="font-serif-display font-bold text-[11px] sm:text-xs text-stone-300 whitespace-nowrap">
                  逾期加急
                </span>
              </div>
              <div className="font-mono text-2xl sm:text-4xl font-black text-[#99332e] leading-none mt-1 sm:mt-0">
                {String(overdueCards.length).padStart(2, '0')}
              </div>
            </div>
            <span className="hidden sm:inline text-stone-500 font-mono text-xs uppercase tracking-wider">
              OVERDUE
            </span>
          </div>

          {/* Card 3: Action Trigger Button */}
          <div className="bg-[#243427] border-2 border-stone-900 rounded-xs p-1.5 sm:p-4 flex flex-col justify-center items-stretch shadow-[3px_3px_0px_#0e1610]">
            <button
              onClick={handleStartReview}
              disabled={cards.length === 0}
              className="w-full h-full min-h-[44px] sm:min-h-[52px] bg-[#d49e3d] hover:bg-[#c99333] active:translate-y-0.5 text-stone-950 font-serif-display font-black text-xs sm:text-base py-2 sm:py-3 px-1 sm:px-4 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] flex items-center justify-center gap-1 sm:gap-2 cursor-pointer transition-all disabled:opacity-50 text-center"
            >
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current shrink-0" />
              <span className="whitespace-nowrap font-bold">
                {dueCards.length > 0 ? (
                  <>
                    <span className="hidden sm:inline">开始值机复习</span>
                    <span className="sm:hidden">开始复习</span>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">随机抽测演练</span>
                    <span className="sm:hidden">随机抽测</span>
                  </>
                )}
              </span>
            </button>
          </div>
        </div>

        {/* Filter Toggle & Section Header */}
        <div className="w-full flex items-center justify-between mb-4 border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-serif-display font-black text-stone-200">
              {filterMode === 'due' ? '待核电文栈' : '全部归档电报'}
            </span>
            <span className="font-mono text-xs text-[#d49e3d] font-bold">
              ({displayedCards.length})
            </span>
          </div>

          <div className="flex items-center gap-3">
            {cards.length > 0 && (
              <button
                onClick={handleShufflePractice}
                className="text-xs font-serif-display text-stone-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Shuffle className="w-3.5 h-3.5 text-[#d49e3d]" />
                <span>随机 10 封</span>
              </button>
            )}

            <button
              onClick={() => setFilterMode((prev) => (prev === 'due' ? 'all' : 'due'))}
              className="text-xs font-mono text-[#d49e3d] hover:underline cursor-pointer font-bold"
            >
              {filterMode === 'due' ? '切换为全部卷宗' : '仅看到期待核'}
            </button>
          </div>
        </div>

        {/* Expressions Cards Grid */}
        {displayedCards.length === 0 ? (
          <div className="w-full p-12 text-center bg-[#243427] rounded-xs border-2 border-dashed border-stone-700 text-stone-400 text-xs">
            电报局待核队列已清空！可前往「起草电文」继续输入或进行随机抽测。
          </div>
        ) : (
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedCards.slice(0, 20).map((card, idx) => {
              const isRevealed = revealedIds.includes(card.id);
              const nextReviewText = formatNextReviewHuman(card.nextReviewAt);
              const isOverdue = isCardDue(card.nextReviewAt) && getOverdueDays(card.nextReviewAt) > 0;

              return (
                <div
                  key={card.id}
                  onClick={() => onSelectCardDetail(card)}
                  className="w-full bg-[#f4edd3] border-2 border-stone-900 rounded-xs shadow-[3px_3px_0px_#0e1610] p-4 text-stone-900 flex flex-col justify-between hover:translate-y-[-1px] transition-transform cursor-pointer relative"
                >
                  {/* Metal Paperclip at top-left */}
                  <div className="absolute -top-2 left-6 vintage-paperclip" />

                  <div className="space-y-2.5 pt-1">
                    {/* Top Row: Category + Stamp + Card Number */}
                    <div className="flex items-center justify-between text-xs border-b border-dashed border-stone-400 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-serif-display font-black text-xs text-stone-800">
                          {card.category || '日常社交'}
                        </span>
                        {isOverdue ? (
                          <span className="border border-[#99332e] text-[#99332e] font-mono text-[9px] font-black px-1.5 py-0.2 rounded-xs">
                            加急 OVERDUE
                          </span>
                        ) : (
                          <span className="border border-[#2a834f] text-[#2a834f] font-mono text-[9px] font-black px-1.5 py-0.2 rounded-xs">
                            待核 DUE
                          </span>
                        )}
                      </div>

                      <span className="font-mono text-xs text-stone-500 font-bold">
                        {formatCardNumber(cardChronologicalMap.get(card.id) ?? (idx + 1))}
                      </span>
                    </div>

                    {/* Chinese Prompt */}
                    <div className="text-xs font-serif text-stone-600">
                      原稿：{card.original}
                    </div>

                    {/* English Output (默认隐藏，点击右下角翻看才显示) */}
                    {isRevealed ? (
                      <div className="font-serif-display text-base sm:text-lg font-black text-stone-950 leading-snug animate-in fade-in duration-150">
                        {card.natural}
                      </div>
                    ) : (
                      <div className="font-mono text-xs text-stone-500 italic py-1 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-stone-400 inline-block" />
                        <span>[ 译文已封存 · 点击右下角翻看 ]</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Controls */}
                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-dashed border-stone-400 text-xs">
                    <span className="font-mono text-[11px] text-stone-500">
                      下次调度：{nextReviewText}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleReveal(card.id);
                        }}
                        className="px-2 py-1 bg-[#faf7ee] hover:bg-white text-stone-800 rounded-xs border border-stone-900 text-[11px] font-bold font-serif-display flex items-center gap-1 cursor-pointer"
                      >
                        {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{isRevealed ? '隐去' : '翻看'}</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          sound.playKeyClick();
                          speakEnglishText(card.natural);
                        }}
                        className="px-2 py-1 bg-[#d49e3d] hover:bg-[#c99333] text-stone-950 rounded-xs border border-stone-900 text-[11px] font-bold font-serif-display flex items-center gap-1 cursor-pointer"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>朗读</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
