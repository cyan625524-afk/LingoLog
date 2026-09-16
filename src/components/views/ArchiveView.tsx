import React, { useState, useMemo } from 'react';
import {
  Search,
  Star,
  BookOpen,
  Sparkles,
  Volume2,
  Plus,
  Loader2,
  Copy,
  Check,
  Download,
  Trash2,
  X,
  FileText,
  Upload,
  CheckSquare,
  Square,
  Tag,
  Calendar,
  RotateCcw,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { FlashCard, StoryItem, CARD_CATEGORIES, CardCategory } from '../../types';
import { sound } from '../../utils/audio';
import { speakEnglishText } from '../../utils/tts';
import { formatNextReviewHuman, isCardDue } from '../../utils/ebbinghaus';
import { getCardChronologicalMap, formatCardNumber } from '../../utils/cardOrder';
import { HighlightedText } from '../common/HighlightedText';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { TeleprinterPaperCard } from '../common/TeleprinterPaperCard';
import { TelegramStamp } from '../common/TelegramStamp';
import { BrassNameplate } from '../common/BrassNameplate';
import { SignalLamp } from '../common/SignalLamp';
import { PerforatedDivider } from '../common/PerforatedDivider';

interface LibraryViewProps {
  cards: FlashCard[];
  stories: StoryItem[];
  onSelectCardDetail: (card: FlashCard) => void;
  onToggleFavorite: (cardId: string) => void;
  onDeleteCard: (cardId: string) => void;
  onBatchDeleteCards?: (cardIds: string[]) => void;
  onBatchUpdateCategory?: (cardIds: string[], newCategory: CardCategory) => void;
  onBatchToggleFavorite?: (cardIds: string[], targetFavorite: boolean) => void;
  onSaveStory: (story: StoryItem) => void;
  onOpenBatchImport?: () => void;
  onStartFilteredReview?: (filteredDueCards: FlashCard[]) => void;
  modelName: string;
  apiKey?: string;
  provider?: string;
  baseUrl?: string;
}

export const ArchiveView: React.FC<LibraryViewProps> = ({
  cards,
  stories,
  onSelectCardDetail,
  onToggleFavorite,
  onDeleteCard,
  onBatchDeleteCards,
  onBatchUpdateCategory,
  onBatchToggleFavorite,
  onSaveStory,
  onOpenBatchImport,
  onStartFilteredReview,
  modelName,
  apiKey,
  provider,
  baseUrl,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Batch Selection Mode
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [batchCategoryModalOpen, setBatchCategoryModalOpen] = useState(false);

  // Story Creation Modal state
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
  const [selectedCardIdsForStory, setSelectedCardIdsForStory] = useState<string[]>([]);
  const [storyStrategy, setStoryStrategy] = useState<'smart' | 'date' | 'today'>('smart');
  const [customScene, setCustomScene] = useState('在伦敦街角咖啡馆的一场偶遇对话');
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [generatedStory, setGeneratedStory] = useState<StoryItem | null>(null);
  const [storyError, setStoryError] = useState<string | null>(null);

  // Escape key listener for ArchiveView modals
  React.useEffect(() => {
    if (!isStoryModalOpen && !batchCategoryModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        sound.playKeyClick();
        setIsStoryModalOpen(false);
        setBatchCategoryModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStoryModalOpen, batchCategoryModalOpen]);

  const categories = useMemo(() => {
    const dynamicCats = cards.map((c) => c.category).filter(Boolean);
    return Array.from(new Set(['all', ...CARD_CATEGORIES, ...dynamicCats]));
  }, [cards]);

  // Chronological 1-based order map (earliest added = No.001)
  const cardChronologicalMap = useMemo(() => {
    return getCardChronologicalMap(cards);
  }, [cards]);

  const favoritesCount = cards.filter((c) => c.isFavorite).length;

  // Filtered expressions
  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      if (selectedCategory !== 'all' && card.category !== selectedCategory) return false;
      if (onlyFavorites && !card.isFavorite) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchOriginal = card.original.toLowerCase().includes(q);
        const matchNatural = card.natural.toLowerCase().includes(q);
        const matchTags = card.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchOriginal && !matchNatural && !matchTags) return false;
      }
      return true;
    });
  }, [cards, selectedCategory, onlyFavorites, searchQuery]);

  // Due count for tag-filtered review
  const filteredDueCards = useMemo(() => {
    return filteredCards.filter((c) => isCardDue(c.nextReviewAt));
  }, [filteredCards]);

  // Batch Select toggles
  const handleToggleSelectAll = () => {
    sound.playKeyClick();
    if (selectedCardIds.length === filteredCards.length) {
      setSelectedCardIds([]);
    } else {
      setSelectedCardIds(filteredCards.map((c) => c.id));
    }
  };

  const handleToggleCardSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    sound.playKeyClick();
    setSelectedCardIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Batch Delete Execution
  const handleBatchDelete = () => {
    if (selectedCardIds.length === 0) return;
    if (window.confirm(`确定要批量删除选中的 ${selectedCardIds.length} 封电报公文吗？`)) {
      sound.playSuccess();
      if (onBatchDeleteCards) {
        onBatchDeleteCards(selectedCardIds);
      } else {
        selectedCardIds.forEach((id) => onDeleteCard(id));
      }
      setSelectedCardIds([]);
      setIsBatchMode(false);
    }
  };

  // Story Extraction Strategy Handler
  const applyStoryStrategy = (strat: 'smart' | 'date' | 'today', dateParam?: string) => {
    setStoryStrategy(strat);
    sound.playKeyClick();

    if (strat === 'smart') {
      const pastCardIds = new Set(stories.flatMap((s) => s.highlightedCards || []));
      const sorted = [...cards].sort((a, b) => {
        const aUsed = pastCardIds.has(a.id) ? 1 : 0;
        const bUsed = pastCardIds.has(b.id) ? 1 : 0;
        if (aUsed !== bUsed) return aUsed - bUsed;
        return (b.reviewCount || 0) - (a.reviewCount || 0);
      });
      setSelectedCardIdsForStory(sorted.slice(0, 5).map((c) => c.id));
    } else if (strat === 'today') {
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayCards = cards.filter(
        (c) =>
          (c.createdAt && c.createdAt.slice(0, 10) === todayStr) ||
          (c.lastReviewedAt && c.lastReviewedAt.slice(0, 10) === todayStr)
      );
      setSelectedCardIdsForStory(
        (todayCards.length > 0 ? todayCards : cards.slice(0, 4)).map((c) => c.id)
      );
    } else if (strat === 'date' && dateParam) {
      const byDate = cards.filter((c) => c.createdAt && c.createdAt.slice(0, 10) === dateParam);
      setSelectedCardIdsForStory((byDate.length > 0 ? byDate : cards.slice(0, 4)).map((c) => c.id));
    }
  };

  const handleOpenStoryModal = () => {
    sound.playKeyClick();
    applyStoryStrategy('smart');
    setIsStoryModalOpen(true);
  };

  const handleGenerateStory = async () => {
    const targetCards = cards.filter((c) => selectedCardIdsForStory.includes(c.id));
    if (targetCards.length === 0) {
      alert('请至少勾选 1 张表达卡片！');
      return;
    }

    setIsGeneratingStory(true);
    setStoryError(null);
    sound.playKeyClick();

    try {
      const res = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          cards: targetCards,
          topic: customScene,
          modelName,
          apiKey,
          provider,
          baseUrl,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          const s: StoryItem = {
            id: `story-${Date.now()}`,
            title: result.data.title || 'Screenplay Scene',
            englishContent: result.data.englishContent || result.data.content,
            chineseTranslation: result.data.chineseTranslation || result.data.translation,
            highlightedCards: result.data.matchedCardIds || selectedCardIdsForStory,
            createdAt: new Date().toISOString(),
          };
          setGeneratedStory(s);
          setStoryError(null);
          onSaveStory(s);
          sound.playSuccess();
          return;
        }
      }

      throw new Error('故事生成服务返回了无效结果。');
    } catch {
      setStoryError('故事生成失败，请检查网络或 AI 引擎配置后重试。');
    } finally {
      setIsGeneratingStory(false);
    }
  };

  return (
    <div
      id="lingolog-library-view"
      className="flex-1 w-full bg-[#182319] pt-5 sm:pt-8 pb-24 md:pb-8 px-4 sm:px-6 flex flex-col items-center text-stone-100 transition-colors select-none"
    >
      <div className="w-full max-w-5xl flex flex-col items-center">
        {/* Top Header Action Buttons Row */}
        <div className="w-full flex items-center justify-end mb-4">
          {/* Action Tools: 3 buttons in one row on mobile and right-aligned on desktop */}
          <div className="grid grid-cols-3 sm:flex sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                sound.playKeyClick();
                setIsBatchMode(!isBatchMode);
                setSelectedCardIds([]);
              }}
              className={`px-2 sm:px-3 py-1.5 rounded-xs font-serif-display text-[11px] sm:text-xs font-bold border-2 border-stone-900 flex items-center justify-center gap-1 sm:gap-1.5 shadow-[2px_2px_0px_#0e1610] transition-all cursor-pointer whitespace-nowrap ${
                isBatchMode
                  ? 'bg-[#d49e3d] text-stone-950'
                  : 'bg-[#243427] text-stone-300 hover:text-white'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5 text-[#d49e3d] shrink-0" />
              <span>{isBatchMode ? '退出批量' : '批量整理'}</span>
            </button>

            {/* Story Generator Button */}
            <button
              onClick={handleOpenStoryModal}
              className="px-1.5 sm:px-3.5 py-1.5 rounded-xs bg-[#243427] hover:bg-[#2d4031] text-[#99332e] font-serif-display text-[11px] sm:text-xs font-black border-2 border-[#99332e] hover:border-red-500 flex items-center justify-center gap-1 sm:gap-1.5 shadow-[2px_2px_0px_#0e1610] transition-all cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#99332e] shrink-0" />
              <span>✦ 生成场景故事</span>
            </button>

            {/* Markdown Card Import Button */}
            <button
              onClick={() => {
                sound.playKeyClick();
                onOpenBatchImport?.();
              }}
              className="px-2 sm:px-3.5 py-1.5 rounded-xs bg-[#243427] text-stone-200 hover:text-white font-serif-display text-[11px] sm:text-xs font-bold border-2 border-stone-900 hover:border-[#d49e3d] flex items-center justify-center gap-1 sm:gap-1.5 shadow-[2px_2px_0px_#0e1610] transition-all cursor-pointer whitespace-nowrap"
              title="导入 Markdown 格式电报卡片"
            >
              <Upload className="w-3.5 h-3.5 text-[#d49e3d] shrink-0" />
              <span>导入电报</span>
            </button>
          </div>
        </div>

        {/* Batch Action Bar (Sticky & Mobile Responsive) */}
        {isBatchMode && (
          <div className="w-full sticky top-12 sm:top-14 z-20 bg-[#243427]/95 backdrop-blur-xs text-white p-3 rounded-xs shadow-[3px_3px_0px_#0e1610] mb-4 flex flex-wrap items-center justify-between gap-3 border-2 border-[#d49e3d]">
            <div className="flex items-center gap-3">
              <button
                onClick={handleToggleSelectAll}
                className="flex items-center gap-1.5 text-xs font-bold hover:text-[#d49e3d] cursor-pointer"
              >
                {selectedCardIds.length === filteredCards.length && filteredCards.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-[#d49e3d]" />
                ) : (
                  <Square className="w-4 h-4 text-stone-300" />
                )}
                <span>
                  {selectedCardIds.length === filteredCards.length && filteredCards.length > 0 ? '取消全选' : '全选当前'}
                </span>
              </button>
              <span className="text-xs text-stone-300 font-mono">
                已选中 <strong className="text-[#d49e3d]">{selectedCardIds.length}</strong> / {filteredCards.length} 封
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setBatchCategoryModalOpen(true)}
                disabled={selectedCardIds.length === 0}
                className="px-3 py-1 rounded-xs bg-[#182319] hover:bg-black/30 text-xs font-bold transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1 border border-stone-700"
              >
                <Tag className="w-3 h-3 text-[#d49e3d]" />
                <span>批量分类</span>
              </button>

              <button
                onClick={() => {
                  if (selectedCardIds.length === 0) return;
                  if (onBatchToggleFavorite) {
                    sound.playKeyClick();
                    onBatchToggleFavorite(selectedCardIds, true);
                  }
                }}
                disabled={selectedCardIds.length === 0}
                className="px-3 py-1 rounded-xs bg-[#182319] hover:bg-black/30 text-xs font-bold transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1 border border-stone-700"
              >
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>标为绝密</span>
              </button>

              <button
                onClick={handleBatchDelete}
                disabled={selectedCardIds.length === 0}
                className="px-3 py-1 rounded-xs bg-[#99332e] hover:brightness-110 text-xs font-bold text-white transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>销毁卷宗</span>
              </button>
            </div>
          </div>
        )}

        {/* Search Bar (Image 3 Style) */}
        <div className="w-full relative mb-3">
          <Search className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索中文原稿、地道表达或标签…"
            className="w-full bg-[#f4edd3] text-stone-950 border-2 border-stone-900 rounded-xs pl-10 pr-4 py-2.5 text-xs sm:text-sm placeholder:text-stone-500 shadow-[3px_3px_0px_#0e1610] outline-none font-serif focus:border-[#d49e3d]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-600 hover:text-stone-900 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Filter Pills: fully wrapped across lines on all devices */}
        <div className="w-full flex flex-wrap items-center gap-2 mb-4">
          <button
            onClick={() => {
              sound.playKeyClick();
              setSelectedCategory('all');
              setOnlyFavorites(false);
            }}
            className={`px-3 py-1 rounded-xs text-xs font-serif-display font-black whitespace-nowrap transition-all cursor-pointer border-2 border-stone-900 shadow-[2px_2px_0px_#0e1610] ${
              selectedCategory === 'all' && !onlyFavorites
                ? 'bg-[#d49e3d] text-stone-950'
                : 'bg-[#243427] text-stone-300 hover:text-white'
            }`}
          >
            全部 · {cards.length}
          </button>

          <button
            onClick={() => {
              sound.playKeyClick();
              setOnlyFavorites((prev) => !prev);
            }}
            className={`px-3 py-1 rounded-xs text-xs font-serif-display font-black whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 border-2 border-stone-900 shadow-[2px_2px_0px_#0e1610] ${
              onlyFavorites
                ? 'bg-[#d49e3d] text-stone-950'
                : 'bg-[#243427] text-stone-300 hover:text-white'
            }`}
          >
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>收藏 · {favoritesCount}</span>
          </button>

          {categories
            .filter((c) => c !== 'all')
            .map((cat) => {
              const count = cards.filter((c) => c.category === cat).length;
              if (count === 0) return null;
              const isSelected = selectedCategory === cat && !onlyFavorites;

              return (
                <button
                  key={cat}
                  onClick={() => {
                    sound.playKeyClick();
                    setSelectedCategory(cat);
                    setOnlyFavorites(false);
                  }}
                  className={`px-3 py-1 rounded-xs text-xs font-serif-display font-black whitespace-nowrap transition-all cursor-pointer border-2 border-stone-900 shadow-[2px_2px_0px_#0e1610] ${
                    isSelected
                      ? 'bg-[#d49e3d] text-stone-950'
                      : 'bg-[#243427] text-stone-300 hover:text-white'
                  }`}
                >
                  {cat} · {count}
                </button>
              );
            })}
        </div>

        {/* Expressions Cards List: 2-Column Grid (Image 3 Style) */}
        {filteredCards.length === 0 ? (
          <div className="w-full p-12 text-center bg-[#243427] rounded-xs border-2 border-dashed border-stone-700 text-stone-400 text-xs">
            未在总局卷宗中找到匹配的电报档案
          </div>
        ) : (
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCards.map((card, idx) => {
              const isSelected = selectedCardIds.includes(card.id);

              return (
                <div
                  key={card.id}
                  onClick={() => {
                    if (isBatchMode) {
                      setSelectedCardIds((prev) =>
                        prev.includes(card.id)
                          ? prev.filter((i) => i !== card.id)
                          : [...prev, card.id]
                      );
                    } else {
                      onSelectCardDetail(card);
                    }
                  }}
                  className={`w-full bg-[#f4edd3] text-stone-900 border-2 border-stone-900 rounded-xs shadow-[3px_3px_0px_#0e1610] p-4 flex flex-col justify-between hover:translate-y-[-1px] transition-transform cursor-pointer relative ${
                    isSelected ? 'ring-2 ring-[#d49e3d]' : ''
                  }`}
                >
                  {/* Metal Paperclip at top-left (Image 3) */}
                  <div className="absolute -top-2 left-6 vintage-paperclip" />

                  <div className="space-y-2 pt-1">
                    {/* Top Row: Category + Stamp + Card Number */}
                    <div className="flex items-center justify-between text-xs border-b border-dashed border-stone-400 pb-2">
                      <div className="flex items-center gap-2">
                        {isBatchMode && (
                          <div
                            onClick={(e) => handleToggleCardSelect(card.id, e)}
                            className="p-0.5 cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#d49e3d]" />
                            ) : (
                              <Square className="w-4 h-4 text-stone-400 hover:text-stone-600" />
                            )}
                          </div>
                        )}
                        <span className="font-serif-display font-black text-xs text-stone-800">
                          {card.category || '日常社交'}
                        </span>
                        {card.isFavorite && (
                          <span className="border border-[#99332e] text-[#99332e] font-mono text-[9px] font-black px-1.5 py-0.2 rounded-xs">
                            加急 URGENT
                          </span>
                        )}
                      </div>

                      <span className="font-mono text-xs text-stone-500 font-bold">
                        {formatCardNumber(cardChronologicalMap.get(card.id) ?? (idx + 1))}
                      </span>
                    </div>

                    {/* Bold English Expression（带红带重点词） */}
                    <div className="font-serif-display text-base sm:text-lg font-black text-stone-950 leading-snug">
                      <HighlightedText text={card.natural} highlights={card.redHighlights} />
                    </div>

                    {/* Chinese Translation */}
                    <div className="text-xs font-serif text-stone-600">
                      原稿：{card.original}
                    </div>

                    {card.tags && card.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        {card.tags.map((t, tidx) => (
                          <span
                            key={tidx}
                            className="text-[10px] font-mono text-stone-600 bg-[#eee5c6] px-1.5 py-0.2 rounded-xs border border-stone-400"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bottom Row Actions (Image 3) */}
                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-dashed border-stone-400 text-xs">
                    <div className="flex items-center gap-2">
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

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          sound.playKeyClick();
                          onToggleFavorite(card.id);
                        }}
                        className="p-1 bg-[#faf7ee] hover:bg-white text-stone-800 rounded-xs border border-stone-900 text-[11px] cursor-pointer"
                        title={card.isFavorite ? '取消绝密' : '设为绝密'}
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            card.isFavorite ? 'fill-[#d49e3d] text-[#d49e3d]' : ''
                          }`}
                        />
                      </button>
                    </div>

                    <span className="font-serif-display font-bold text-xs text-stone-800 hover:text-stone-950">
                      展开 ▾
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Mobile Floating Quick Batch Bar (docked above bottom nav) */}
        {isBatchMode && selectedCardIds.length > 0 && (
          <div className="fixed bottom-20 left-3 right-3 z-30 md:hidden bg-[#243427] text-white p-2.5 rounded-xs border-2 border-[#d49e3d] shadow-[0_8px_20px_rgba(0,0,0,0.5),3px_3px_0px_#0e1610] flex items-center justify-between gap-2 transition-all animate-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-stone-200">
              <span>已选</span>
              <span className="px-1.5 py-0.5 rounded-xs bg-[#d49e3d] text-stone-950 font-black">
                {selectedCardIds.length}
              </span>
              <span>封</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setBatchCategoryModalOpen(true)}
                className="px-2.5 py-1 rounded-xs bg-[#182319] hover:bg-black/40 text-xs font-bold text-[#d49e3d] border border-stone-700 flex items-center gap-1 cursor-pointer"
              >
                <Tag className="w-3 h-3" />
                <span>分类</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onBatchToggleFavorite) {
                    sound.playKeyClick();
                    onBatchToggleFavorite(selectedCardIds, true);
                  }
                }}
                className="px-2.5 py-1 rounded-xs bg-[#182319] hover:bg-black/40 text-xs font-bold text-amber-300 border border-stone-700 flex items-center gap-1 cursor-pointer"
              >
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>绝密</span>
              </button>

              <button
                type="button"
                onClick={handleBatchDelete}
                className="px-2.5 py-1 rounded-xs bg-[#99332e] hover:brightness-110 text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>销毁</span>
              </button>
            </div>
          </div>
        )}

        {/* BATCH CATEGORY MODAL */}
        {batchCategoryModalOpen && (
          <div
            onClick={() => {
              sound.playKeyClick();
              setBatchCategoryModalOpen(false);
            }}
            className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 select-none cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-[#f4edd3] rounded-xs shadow-[6px_6px_0px_#0e1610] border-2 border-stone-900 overflow-hidden flex flex-col cursor-default"
            >
              {/* Header */}
              <div className="bg-[#d49e3d] border-b-2 border-stone-900 px-4 py-2.5 flex items-center justify-between text-stone-900">
                <div className="flex items-center gap-2">
                  <span className="font-serif-display font-black text-xs tracking-wider">
                    ❖ 批量重新归类 · RECLASSIFY
                  </span>
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 bg-[#f4edd3] border border-stone-900 rounded-xs">
                    已选 {selectedCardIds.length} 封
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sound.playKeyClick();
                    setBatchCategoryModalOpen(false);
                  }}
                  className="p-1 text-stone-900 hover:bg-stone-900/10 rounded-xs cursor-pointer"
                  title="关闭"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Punch Holes Row */}
              <div className="punch-holes-row border-b border-dashed border-stone-400/60 bg-[#eee5c6]">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className="punch-hole-dot" />
                ))}
              </div>

              {/* Categories Grid */}
              <div className="p-4 bg-[#faf7ee]">
                <div className="grid grid-cols-2 gap-2">
                  {CARD_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        if (onBatchUpdateCategory) {
                          onBatchUpdateCategory(selectedCardIds, cat);
                        }
                        sound.playSuccess();
                        setBatchCategoryModalOpen(false);
                        setIsBatchMode(false);
                        setSelectedCardIds([]);
                      }}
                      className="p-2 rounded-xs border-2 border-stone-900 bg-[#f4edd3] hover:bg-[#d49e3d] text-stone-900 font-serif-display font-bold text-xs shadow-[2px_2px_0px_#101711] active:translate-y-0.5 transition-all cursor-pointer text-center"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STORY GENERATION MODAL */}
        {isStoryModalOpen && (
          <div
            onClick={() => {
              sound.playKeyClick();
              setIsStoryModalOpen(false);
            }}
            className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 select-none cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-[#f4edd3] rounded-xs shadow-[6px_6px_0px_#0e1610] border-2 border-stone-900 overflow-hidden flex flex-col max-h-[90vh] cursor-default"
            >
              {/* Header */}
              <div className="px-4 sm:px-5 py-2.5 bg-[#d49e3d] text-stone-900 border-b-2 border-stone-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-serif-display font-black text-xs sm:text-sm tracking-wider">
                    ✦ 电报纪事工坊 · SCENARIO GENERATOR
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sound.playKeyClick();
                    setIsStoryModalOpen(false);
                  }}
                  className="p-1 text-stone-900 hover:bg-stone-900/10 rounded-xs cursor-pointer"
                  title="关闭"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Punch Holes Row */}
              <div className="punch-holes-row border-b border-dashed border-stone-400/60 bg-[#eee5c6]">
                {Array.from({ length: 22 }).map((_, i) => (
                  <div key={i} className="punch-hole-dot" />
                ))}
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs font-sans text-stone-900">
                {!generatedStory ? (
                  <>
                    {storyError && (
                      <div className="p-3 rounded-xs border-2 border-[#99332e] bg-red-50 text-[#99332e] font-serif space-y-2">
                        <p>{storyError}</p>
                        <button
                          type="button"
                          onClick={handleGenerateStory}
                          disabled={isGeneratingStory || selectedCardIdsForStory.length === 0}
                          className="px-3 py-1.5 border border-[#99332e] font-bold cursor-pointer disabled:opacity-50"
                        >
                          重试生成
                        </button>
                      </div>
                    )}
                    {/* Strategy Selector */}
                    <div className="space-y-1.5">
                      <label className="font-serif-display font-black text-stone-900 block">
                        1. 故事素材抽取策略
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => applyStoryStrategy('smart')}
                          className={`p-2 rounded-xs border-2 border-stone-900 text-center transition-all cursor-pointer font-serif-display text-xs ${
                            storyStrategy === 'smart'
                              ? 'bg-[#243427] text-[#d49e3d] font-black shadow-[2px_2px_0px_#101711]'
                              : 'bg-[#faf7ee] text-stone-800 font-bold hover:bg-white shadow-[1px_1px_0px_#101711]'
                          }`}
                        >
                          智能精选 (5条)
                        </button>

                        <button
                          type="button"
                          onClick={() => applyStoryStrategy('today')}
                          className={`p-2 rounded-xs border-2 border-stone-900 text-center transition-all cursor-pointer font-serif-display text-xs ${
                            storyStrategy === 'today'
                              ? 'bg-[#243427] text-[#d49e3d] font-black shadow-[2px_2px_0px_#101711]'
                              : 'bg-[#faf7ee] text-stone-800 font-bold hover:bg-white shadow-[1px_1px_0px_#101711]'
                          }`}
                        >
                          今日所学
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            applyStoryStrategy(
                              'date',
                              new Date().toISOString().slice(0, 10)
                            )
                          }
                          className={`p-2 rounded-xs border-2 border-stone-900 text-center transition-all cursor-pointer font-serif-display text-xs ${
                            storyStrategy === 'date'
                              ? 'bg-[#243427] text-[#d49e3d] font-black shadow-[2px_2px_0px_#101711]'
                              : 'bg-[#faf7ee] text-stone-800 font-bold hover:bg-white shadow-[1px_1px_0px_#101711]'
                          }`}
                        >
                          按学习日期
                        </button>
                      </div>
                    </div>

                    {/* Selected Cards List */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-stone-700">
                        <span className="font-serif-display font-bold">
                          已勾选 {selectedCardIdsForStory.length} 张表达素材：
                        </span>
                        <span className="font-mono text-[10px] text-stone-500">点击条目增减</span>
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1 p-2 bg-[#faf7ee] rounded-xs border-2 border-stone-900">
                        {cards.map((c) => {
                          const isSelected = selectedCardIdsForStory.includes(c.id);
                          return (
                            <div
                              key={c.id}
                              onClick={() => {
                                sound.playKeyClick();
                                setSelectedCardIdsForStory((prev) =>
                                  prev.includes(c.id)
                                    ? prev.filter((id) => id !== c.id)
                                    : [...prev, c.id]
                                );
                              }}
                              className={`p-2 rounded-xs text-xs flex items-center justify-between cursor-pointer border transition-all ${
                                isSelected
                                  ? 'bg-[#243427] text-[#d49e3d] border-stone-900 font-medium'
                                  : 'bg-[#f4edd3] border-stone-300 hover:border-stone-900 text-stone-900'
                              }`}
                            >
                              <span className="truncate max-w-[240px] font-serif font-bold">"{c.natural}"</span>
                              <span className="text-[10px] opacity-75 truncate max-w-[120px] font-serif">
                                {c.original}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom Topic / Scene */}
                    <div className="space-y-1.5">
                      <label className="font-serif-display font-black text-stone-900 block">
                        2. 纪事剧本场景设定
                      </label>
                      <input
                        type="text"
                        value={customScene}
                        onChange={(e) => setCustomScene(e.target.value)}
                        placeholder="例如：在伦敦老电报局值班室内的一场对话…"
                        className="w-full bg-[#faf7ee] border-2 border-stone-900 rounded-xs px-3 py-2 text-xs text-stone-900 outline-none font-serif placeholder:text-stone-400 shadow-inner"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleGenerateStory}
                      disabled={isGeneratingStory || selectedCardIdsForStory.length === 0}
                      className="w-full py-2.5 rounded-xs bg-[#d49e3d] hover:bg-[#c99333] active:translate-y-0.5 text-stone-900 font-serif-display font-black text-xs sm:text-sm border-2 border-stone-900 shadow-[2px_2px_0px_#101711] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isGeneratingStory ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-stone-900" />
                          <span>电报纪事编排中…</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-stone-900" />
                          <span>拍发并生成电报剧本</span>
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  /* Generated Story View */
                  <div className="space-y-4">
                    <div className="p-4 rounded-xs bg-[#faf7ee] border-2 border-stone-900 shadow-[2px_2px_0px_#101711] space-y-3">
                      <h4 className="font-serif-display text-base font-black text-stone-950 border-b-2 border-dashed border-stone-300 pb-2">
                        {generatedStory.title}
                      </h4>

                      <div className="font-serif text-xs sm:text-sm leading-relaxed text-stone-900 space-y-2">
                        <MarkdownRenderer content={generatedStory.englishContent} />
                      </div>

                      {generatedStory.chineseTranslation && (
                        <div className="pt-2 border-t border-dashed border-stone-300 text-xs text-stone-600 font-serif">
                          <MarkdownRenderer content={generatedStory.chineseTranslation} />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          sound.playKeyClick();
                          setGeneratedStory(null);
                        }}
                        className="px-4 py-2 rounded-xs bg-[#faf7ee] hover:bg-white text-stone-900 border-2 border-stone-900 font-serif-display font-bold text-xs shadow-[2px_2px_0px_#101711] cursor-pointer"
                      >
                        ↺ 重新设定
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          sound.playKeyClick();
                          setIsStoryModalOpen(false);
                        }}
                        className="px-5 py-2 rounded-xs bg-[#243427] hover:bg-[#182319] text-[#d49e3d] border-2 border-stone-900 font-serif-display font-black text-xs shadow-[2px_2px_0px_#101711] cursor-pointer"
                      >
                        ✓ 完成并归档入库
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
