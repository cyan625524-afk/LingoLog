import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Flame,
  Feather,
  Calendar,
  Sparkles,
  ShoppingBag,
  Check,
  Zap,
  Clock,
  Shield,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Volume2,
  Star,
  Layers,
  ArrowRight,
  Palette,
  AlertCircle,
  Trophy,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DailyQuest, HeatmapDay, ShopItem, FlashCard } from '../../types';
import { sound } from '../../utils/audio';
import { formatDate, calculateStreakFromHeatmap, isCardDue } from '../../utils/ebbinghaus';
import { TelegramStamp } from '../common/TelegramStamp';

interface ProgressViewProps {
  cards?: FlashCard[];
  feathers: number;
  streakDays: number;
  quests: DailyQuest[];
  onClaimQuest: (questId: string) => void;
  heatmap: Record<string, HeatmapDay>;
  onMakeupCheckin: (dateStr: string) => void;
  shopItems: ShopItem[];
  onBuyShopItem: (itemId: string) => void;
  onToggleShopItem: (itemId: string) => void;
  streakFreezes?: number;
  streakFreezeProtection?: boolean;
  onSelectCard?: (card: FlashCard) => void;
  onNavigateTab?: (tab: 'learn' | 'review' | 'archive') => void;
  onStartSprintReview?: () => void;
}

interface YearDayCell {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  weekIndex: number;
  createdCount: number; // number of cards created on this date
  reviewedCount: number; // number of card reviews on this date
  spokenCount: number; // number of card speech practices on this date
  activityCount: number; // total = created + reviews + spoken (+ makeup)
  cards: FlashCard[];
  isToday: boolean;
  isFuture: boolean;
  isMakeup?: boolean;
  isOutOfYear?: boolean; // Padding outside Jan 1 - Dec 31
}

export const ProgressView: React.FC<ProgressViewProps> = ({
  cards = [],
  feathers,
  quests,
  onClaimQuest,
  heatmap,
  onMakeupCheckin,
  shopItems,
  onBuyShopItem,
  onToggleShopItem,
  streakFreezes = 2,
  streakFreezeProtection = true,
  onSelectCard,
  onNavigateTab,
  onStartSprintReview,
}) => {
  // Simplified subtabs: "总进度" and "商店"
  const [activeSubTab, setActiveSubTab] = useState<'progress' | 'shop'>('progress');
  const [selectedHeatmapDate, setSelectedHeatmapDate] = useState<string | null>(null);
  const [shopCategoryFilter, setShopCategoryFilter] = useState<'all' | 'skin' | 'consumable' | 'feature'>('all');
  const [makeupNotice, setMakeupNotice] = useState<string | null>(null);
  const [claimedQuestIds, setClaimedQuestIds] = useState<Set<string>>(new Set());
  const heatmapScrollRef = useRef<HTMLDivElement>(null);

  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const celebrationShownDateRef = useRef<string>('');

  // 2秒后自动退出庆祝弹窗
  useEffect(() => {
    if (showCelebrationModal) {
      const timer = setTimeout(() => {
        setShowCelebrationModal(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showCelebrationModal]);

  const todayStr = useMemo(() => formatDate(new Date()), []);
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  // 1. Calculate streak authoritatively from heatmap and cards
  const derivedStreakDays = useMemo(() => {
    return calculateStreakFromHeatmap(heatmap, cards);
  }, [heatmap, cards]);

  // 2. Synchronize daily tasks with actual cards & review activities of today
  const syncedQuests = useMemo(() => {
    // A. 当天新卡片（包括打字机起草与Gemini推送）
    const todayNewCardsCount = cards.filter(
      (c) => c.createdAt && c.createdAt.slice(0, 10) === todayStr
    ).length;

    // B. 当天复审过的电文
    const todayReviewedCardsCount = cards.filter(
      (c) =>
        (c.lastReviewedAt && c.lastReviewedAt.slice(0, 10) === todayStr) ||
        (Array.isArray(c.reviewHistory) &&
          c.reviewHistory.some((rh) => typeof rh === 'string' && rh.slice(0, 10) === todayStr))
    ).length;

    const todayHeatmapReviewed =
      heatmap[todayStr]?.reviewedCount || heatmap[todayStr]?.reviews || 0;
    const todayHeatmapLearned = heatmap[todayStr]?.learnedCount || 0;
    const todayHeatmapSpoken = heatmap[todayStr]?.spokenCount || 0;

    const actualLearned = Math.max(todayNewCardsCount, todayHeatmapLearned);
    const actualReviewed = Math.max(todayReviewedCardsCount, todayHeatmapReviewed);
    const actualSpoken = todayHeatmapSpoken;

    // C. 动态复核任务目标计算：
    // 第一次用时，今日复习里的艾宾浩斯可能达不到5张，不足5张的以用户当天加入的为准；
    // 之后当天复审不足5张的也以用户当天应该复习的为准
    const currentDueCount = cards.filter((c) => isCardDue(c.nextReviewAt)).length;
    const totalReviewWorkloadToday = actualReviewed + currentDueCount;
    let dynamicReviewTarget = 5;
    if (totalReviewWorkloadToday > 0) {
      dynamicReviewTarget = Math.min(5, Math.max(1, totalReviewWorkloadToday));
    } else {
      const basis = todayNewCardsCount > 0 ? todayNewCardsCount : cards.length;
      dynamicReviewTarget = Math.min(5, Math.max(1, basis || 1));
    }

    // D. "机要重点归档":
    // 只要用户收藏了卡片、掌握了卡片、或者当天有新学/复习/开口说记录，即可轻松达成
    const hasFavoriteOrMastered = cards.some((c) => c.isFavorite || c.masteryLevel === 'mastered');
    const hasAnyActivityToday = actualLearned > 0 || actualReviewed > 0 || actualSpoken > 0;
    const actualFavorite = hasFavoriteOrMastered || hasAnyActivityToday || cards.length > 0 ? 1 : 0;

    return quests.map((quest) => {
      let current = quest.current;
      let target = quest.target;
      let description = quest.description;

      if (quest.id === 'quest-learn' || quest.id === 'quest-1' || quest.id === 'learn_1') {
        current = Math.max(quest.current, actualLearned);
        target = 1;
        description = '打字机输入或从AI助手推送至少 1 封新电文';
      } else if (quest.id === 'quest-review' || quest.id === 'quest-2' || quest.id === 'review_5') {
        target = dynamicReviewTarget;
        current = Math.max(quest.current, actualReviewed);
        description = `完成今日待核队列（${target} 封）电文复审`;
      } else if (quest.id === 'quest-audio' || quest.id === 'quest-3') {
        current = Math.max(quest.current, actualSpoken);
        target = Math.min(quest.target, 1);
        description = '点击电文朗读播报，跟读发音练习 1 次';
      } else if (quest.id === 'quest-favorite' || quest.id === 'quest-4') {
        current = Math.max(quest.current, actualFavorite);
        target = 1;
        description = '收藏星标电文，或在卷宗库中翻阅精读 1 封电文';
      }

      const completed = current >= target;
      return {
        ...quest,
        current,
        target,
        description,
        completed,
      };
    });
  }, [quests, cards, heatmap, todayStr]);

  const completedQuestsCount = useMemo(() => {
    return syncedQuests.filter((q) => q.completed || q.current >= q.target).length;
  }, [syncedQuests]);

  // 3. Calculate which years have learning records (当年有记录的才可切换)
  const availableYears = useMemo(() => {
    const yearsWithActivity = new Set<number>();

    // Check card creation timestamps
    cards.forEach((c) => {
      if (!c.createdAt) return;
      try {
        const d = new Date(c.createdAt);
        if (!isNaN(d.getTime())) {
          yearsWithActivity.add(d.getFullYear());
        }
      } catch {
        const yr = parseInt(c.createdAt.slice(0, 4), 10);
        if (!isNaN(yr) && yr > 2000 && yr < 2100) {
          yearsWithActivity.add(yr);
        }
      }
    });

    // Check heatmap activity logs
    Object.entries(heatmap).forEach(([dStr, day]) => {
      const hasActivity =
        (day.count ?? 0) > 0 ||
        (day.learnedCount ?? 0) > 0 ||
        (day.reviewedCount ?? 0) > 0 ||
        (day.spokenCount ?? 0) > 0 ||
        (day.studyMinutes ?? 0) > 0 ||
        day.isMakeup;

      if (hasActivity) {
        const yr = parseInt(dStr.slice(0, 4), 10);
        if (!isNaN(yr) && yr > 2000 && yr < 2100) {
          yearsWithActivity.add(yr);
        }
      }
    });

    // Ensure current year always exists
    if (yearsWithActivity.size === 0) {
      yearsWithActivity.add(currentYear);
    }

    return Array.from(yearsWithActivity).sort((a, b) => b - a);
  }, [cards, heatmap, currentYear]);

  // Selected year state
  const [selectedYear, setSelectedYear] = useState<number>(() => currentYear);

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  const selectedYearIndex = availableYears.indexOf(selectedYear);

  // 4. Build the Full Year Heatmap: strictly from Jan 1st to Dec 31st of selectedYear
  const { fullYearWeeks, monthLabels, totalYearCreatedCards, activeDaysCount, totalWeeksCount } = useMemo(() => {
    const dateToCards: Record<string, FlashCard[]> = {};
    const reviewCountByDate: Record<string, number> = {};
    const spokenCountByDate: Record<string, number> = {};

    cards.forEach((c) => {
      // 1. 新卡片 (Created)
      if (c.createdAt) {
        try {
          const d = new Date(c.createdAt);
          if (!isNaN(d.getTime())) {
            const dStr = formatDate(d);
            if (!dateToCards[dStr]) dateToCards[dStr] = [];
            dateToCards[dStr].push(c);
          }
        } catch {
          const dStr = c.createdAt.slice(0, 10);
          if (dStr) {
            if (!dateToCards[dStr]) dateToCards[dStr] = [];
            dateToCards[dStr].push(c);
          }
        }
      }

      // 2. 复习卡片 (Reviewed)
      if (Array.isArray(c.reviewHistory) && c.reviewHistory.length > 0) {
        c.reviewHistory.forEach((rh) => {
          if (typeof rh === 'string') {
            const rDate = rh.slice(0, 10);
            if (rDate) {
              reviewCountByDate[rDate] = (reviewCountByDate[rDate] || 0) + 1;
            }
          }
        });
      } else if (c.lastReviewedAt) {
        const lrDate = c.lastReviewedAt.slice(0, 10);
        if (lrDate) {
          reviewCountByDate[lrDate] = (reviewCountByDate[lrDate] || 0) + 1;
        }
      }

      // 3. 开口说卡片 (Spoken)
      if (Array.isArray(c.speechRecords) && c.speechRecords.length > 0) {
        c.speechRecords.forEach((sr) => {
          if (sr?.date) {
            const sDate = sr.date.slice(0, 10);
            if (sDate) {
              spokenCountByDate[sDate] = (spokenCountByDate[sDate] || 0) + 1;
            }
          }
        });
      } else if ((c.spokenCount || 0) > 0 && c.createdAt) {
        const sDate = c.createdAt.slice(0, 10);
        spokenCountByDate[sDate] = (spokenCountByDate[sDate] || 0) + (c.spokenCount || 0);
      }
    });

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const nowTime = now.getTime();

    // Jan 1 of selectedYear
    const yearStart = new Date(selectedYear, 0, 1);
    yearStart.setHours(0, 0, 0, 0);

    // Dec 31 of selectedYear
    const yearEnd = new Date(selectedYear, 11, 31);
    yearEnd.setHours(23, 59, 59, 999);

    // Sunday of the week containing Jan 1st
    const gridStart = new Date(yearStart);
    gridStart.setDate(yearStart.getDate() - yearStart.getDay());
    gridStart.setHours(0, 0, 0, 0);

    // Saturday of the week containing Dec 31st
    const gridEnd = new Date(yearEnd);
    gridEnd.setDate(yearEnd.getDate() + (6 - yearEnd.getDay()));
    gridEnd.setHours(23, 59, 59, 999);

    const totalDays = Math.round((gridEnd.getTime() - gridStart.getTime()) / (24 * 3600 * 1000));
    const numWeeks = Math.ceil(totalDays / 7);

    const weeks: YearDayCell[][] = [];
    let totalCardsInYear = 0;
    let activeDays = 0;

    for (let w = 0; w < numWeeks; w++) {
      const weekDays: YearDayCell[] = [];

      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(gridStart);
        cellDate.setDate(gridStart.getDate() + (w * 7 + d));
        cellDate.setHours(0, 0, 0, 0);

        const dStr = formatDate(cellDate);
        const dayYear = cellDate.getFullYear();
        const isOutOfYear = dayYear !== selectedYear;

        const dayCards = dateToCards[dStr] || [];
        const cardCreatedCount = isOutOfYear ? 0 : dayCards.length;

        const hDay = heatmap[dStr];
        const isMakeup = isOutOfYear ? false : !!hDay?.isMakeup;

        // 真实追踪三大行为：新卡片、复习卡片、开口说卡片
        const createdCount = isOutOfYear
          ? 0
          : Math.max(cardCreatedCount, hDay?.newCards || 0, hDay?.learnedCount || 0);
        const reviewedCount = isOutOfYear
          ? 0
          : Math.max(reviewCountByDate[dStr] || 0, hDay?.reviewedCount || 0, hDay?.reviews || 0);
        const spokenCount = isOutOfYear
          ? 0
          : Math.max(spokenCountByDate[dStr] || 0, hDay?.spokenCount || 0);

        // 仅当当天有新卡片/复习卡片/开口说卡片时才会有数值，颜色深浅根据上述行为多少变化
        const activityCount = createdCount + reviewedCount + spokenCount + (isMakeup ? 5 : 0);

        if (!isOutOfYear) {
          totalCardsInYear += createdCount;
          if (activityCount > 0) activeDays++;
        }

        const isToday = dStr === todayStr;
        const isFuture = cellDate.getTime() > nowTime;

        weekDays.push({
          date: cellDate,
          dateStr: dStr,
          dayOfWeek: d,
          weekIndex: w,
          createdCount,
          reviewedCount,
          spokenCount,
          activityCount,
          cards: dayCards,
          isToday,
          isFuture,
          isMakeup,
          isOutOfYear,
        });
      }

      weeks.push(weekDays);
    }

    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const months: { weekIndex: number; label: string }[] = [];
    for (let m = 0; m < 12; m++) {
      const monthFirst = new Date(selectedYear, m, 1);
      monthFirst.setHours(0, 0, 0, 0);
      const dayOffset = Math.round((monthFirst.getTime() - gridStart.getTime()) / (24 * 3600 * 1000));
      const weekIdx = Math.floor(dayOffset / 7);
      months.push({
        weekIndex: Math.min(numWeeks - 1, Math.max(0, weekIdx)),
        label: monthNames[m],
      });
    }

    return {
      fullYearWeeks: weeks,
      monthLabels: months,
      totalYearCreatedCards: totalCardsInYear,
      activeDaysCount: activeDays,
      totalWeeksCount: numWeeks,
    };
  }, [cards, heatmap, selectedYear, todayStr]);

  // Adjust scroll position on year change
  useEffect(() => {
    if (heatmapScrollRef.current) {
      if (selectedYear === currentYear) {
        heatmapScrollRef.current.scrollLeft = heatmapScrollRef.current.scrollWidth;
      } else {
        heatmapScrollRef.current.scrollLeft = 0;
      }
    }
  }, [selectedYear, activeSubTab, currentYear]);

  // Reset selected date if year changes
  useEffect(() => {
    if (selectedHeatmapDate) {
      const yr = parseInt(selectedHeatmapDate.slice(0, 4), 10);
      if (yr !== selectedYear) {
        setSelectedHeatmapDate(null);
      }
    }
  }, [selectedYear, selectedHeatmapDate]);

  // Heatmap day color calculation: 当天没有学习情况就是空的，颜色随着学习复习次数越多渐深
  const getCellColor = (cell: YearDayCell) => {
    if (cell.isOutOfYear) {
      return 'bg-transparent border-transparent opacity-0 pointer-events-none';
    }

    if (cell.isFuture) {
      return 'bg-transparent border-dashed border-stone-400/20 dark:border-stone-800/40 opacity-30 cursor-default';
    }

    if (cell.isMakeup) {
      return 'bg-[#d49e3d] border-stone-900 shadow-[0px_0px_3px_#d49e3d]';
    }

    const c = cell.activityCount;
    // 0次：当天没有学习情况就是空的
    if (c === 0) {
      return 'bg-transparent border border-stone-300 dark:border-stone-700/60 hover:border-stone-400';
    }
    // 渐深：1-2浅绿 -> 3-5中绿 -> 6-10深绿 -> 11+浓绿
    if (c <= 2) {
      return 'bg-[#bbf7d0] dark:bg-[#78c992] border-[#86efac] dark:border-[#52b572] hover:brightness-105';
    }
    if (c <= 5) {
      return 'bg-[#4ade80] dark:bg-[#349c53] border-[#22c55e] dark:border-[#2b8245] hover:brightness-105';
    }
    if (c <= 10) {
      return 'bg-[#16a34a] dark:bg-[#1e6f3b] border-[#15803d] dark:border-[#17592f] hover:brightness-105';
    }
    return 'bg-[#14532d] dark:bg-[#114b27] border-[#052e16] dark:border-[#0a331a] hover:brightness-105';
  };

  const handleClaim = (quest: DailyQuest) => {
    sound.playSuccess();
    const nextClaimed = new Set(claimedQuestIds).add(quest.id);
    setClaimedQuestIds(nextClaimed);
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
    });
    onClaimQuest(quest.id);

    // 检查是否当天所有任务均已达成且全部完成领取
    const allDoneAndClaimed = syncedQuests.every(
      (q) => (q.completed || q.current >= q.target) && (q.claimed || nextClaimed.has(q.id))
    );

    if (allDoneAndClaimed && celebrationShownDateRef.current !== todayStr) {
      celebrationShownDateRef.current = todayStr;
      setTimeout(() => {
        setShowCelebrationModal(true);
        sound.playSuccess();
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 },
        });
      }, 350);
    }
  };

  const handleApplyMakeup = (dateStr: string) => {
    sound.playKeyClick();
    if (feathers < 30) {
      setMakeupNotice('补签需消耗 30 功勋羽毛，当前储备不足。可通过起草或复核赚取！');
      setTimeout(() => setMakeupNotice(null), 4000);
      return;
    }
    onMakeupCheckin(dateStr);
    sound.playSuccess();
    confetti({
      particleCount: 40,
      spread: 50,
    });
  };

  // Selected Day Information Drawer
  const selectedDayInfo = useMemo(() => {
    if (!selectedHeatmapDate) return null;

    let targetCell: YearDayCell | null = null;
    for (const week of fullYearWeeks) {
      for (const day of week) {
        if (day.dateStr === selectedHeatmapDate) {
          targetCell = day;
          break;
        }
      }
      if (targetCell) break;
    }

    const dayLog = heatmap[selectedHeatmapDate];
    return {
      dateStr: selectedHeatmapDate,
      cards: targetCell ? targetCell.cards : [],
      createdCount: targetCell ? targetCell.createdCount : 0,
      activityCount: targetCell ? targetCell.activityCount : 0,
      isToday: selectedHeatmapDate === todayStr,
      isMakeup: targetCell?.isMakeup || !!dayLog?.isMakeup,
      studyMinutes: dayLog?.studyMinutes || 0,
      reviewedCount: dayLog?.reviewedCount || dayLog?.reviews || 0,
    };
  }, [selectedHeatmapDate, fullYearWeeks, heatmap, todayStr]);

  const getQuestIcon = (questId: string) => {
    if (questId.includes('learn') || questId.includes('1')) {
      return <Keyboard className="w-4 h-4 text-stone-900 dark:text-[#d49e3d]" />;
    }
    if (questId.includes('review') || questId.includes('2')) {
      return <Zap className="w-4 h-4 text-[#d49e3d]" />;
    }
    if (questId.includes('audio') || questId.includes('3')) {
      return <Volume2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />;
    }
    if (questId.includes('favorite') || questId.includes('4')) {
      return <Star className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    }
    return <Sparkles className="w-4 h-4 text-[#d49e3d]" />;
  };

  const handleQuestAction = (questId: string) => {
    sound.playKeyClick();
    if (questId.includes('learn') || questId.includes('1')) {
      onNavigateTab?.('learn');
    } else if (questId.includes('review') || questId.includes('2')) {
      onNavigateTab?.('review');
    } else if (questId.includes('audio') || questId.includes('3')) {
      onNavigateTab?.('review');
    } else if (questId.includes('favorite') || questId.includes('4')) {
      onNavigateTab?.('archive');
    }
  };

  const getQuestActionLabel = (questId: string) => {
    if (questId.includes('learn') || questId.includes('1')) return '去起草电文';
    if (questId.includes('review') || questId.includes('2')) return '去复审归档';
    if (questId.includes('audio') || questId.includes('3')) return '去听读发音';
    if (questId.includes('favorite') || questId.includes('4')) return '去标星电文';
    return '去完成';
  };

  // Filtered shop items
  const filteredShopItems = useMemo(() => {
    if (shopCategoryFilter === 'all') return shopItems;
    return shopItems.filter((i) => i.category === shopCategoryFilter);
  }, [shopItems, shopCategoryFilter]);

  return (
    <div
      id="lingolog-progress-view"
      className="flex-1 w-full bg-[#182319] min-h-[calc(100vh-64px)] pt-5 sm:pt-8 pb-24 md:pb-12 px-4 sm:px-6 flex flex-col items-center justify-start text-stone-100 transition-colors select-none"
    >
      <div className="w-full max-w-5xl flex flex-col items-center space-y-4 sm:space-y-6">
        {/* Top Header Action Buttons Row (Matches ArchiveView position, size and style) */}
        <div className="w-full flex items-center justify-end mb-4">
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                sound.playKeyClick();
                setActiveSubTab('progress');
              }}
              className={`px-2 sm:px-3 py-1.5 rounded-xs font-serif-display text-[11px] sm:text-xs font-bold border-2 border-stone-900 flex items-center justify-center gap-1 sm:gap-1.5 shadow-[2px_2px_0px_#0e1610] transition-all cursor-pointer whitespace-nowrap ${
                activeSubTab === 'progress'
                  ? 'bg-[#d49e3d] text-stone-950'
                  : 'bg-[#243427] text-stone-300 hover:text-white'
              }`}
            >
              <Calendar className={`w-3.5 h-3.5 shrink-0 ${activeSubTab === 'progress' ? 'text-stone-950' : 'text-[#d49e3d]'}`} />
              <span>总进度</span>
            </button>

            <button
              onClick={() => {
                sound.playKeyClick();
                setActiveSubTab('shop');
              }}
              className={`px-2 sm:px-3 py-1.5 rounded-xs font-serif-display text-[11px] sm:text-xs font-bold border-2 border-stone-900 flex items-center justify-center gap-1 sm:gap-1.5 shadow-[2px_2px_0px_#0e1610] transition-all cursor-pointer whitespace-nowrap ${
                activeSubTab === 'shop'
                  ? 'bg-[#d49e3d] text-stone-950'
                  : 'bg-[#243427] text-stone-300 hover:text-white'
              }`}
            >
              <ShoppingBag
                className={`w-3.5 h-3.5 shrink-0 ${
                  activeSubTab === 'shop' ? 'text-stone-950' : 'text-[#d49e3d]'
                }`}
              />
              <span>羽毛商店</span>
              <span className={`text-[10px] font-mono font-bold ${activeSubTab === 'shop' ? 'text-stone-950' : 'text-[#d49e3d]'}`}>({feathers}🪶)</span>
            </button>
          </div>
        </div>

        {activeSubTab === 'progress' ? (
          /* TAB 1: 总进度 (OVERALL PROGRESS & FULL YEAR HEATMAP) */
          <div className="w-full space-y-4 sm:space-y-5">
            {/* Operator Duty Card & Streak (Authoritatively computed from Heatmap & Cards) */}
            <div className="relative bg-[#243427] text-white rounded-xs p-4 sm:p-5 shadow-[4px_4px_0px_#0e1610] border-2 border-stone-900 flex items-center justify-between overflow-hidden">
              <div className="space-y-1 z-10">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] text-[#d49e3d] font-bold tracking-widest uppercase">
                    ON-DUTY STREAK
                  </span>
                  <span className="text-[10px] font-mono text-emerald-300 font-bold flex items-center gap-1 px-1.5 py-0.5 bg-stone-900/60 rounded-xs border border-[#37493a]">
                    <Shield className="w-3 h-3 text-[#d49e3d]" />
                    <span>冻结卡: {streakFreezes} 张在库</span>
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black font-serif-display text-white tracking-tight">
                    {derivedStreakDays}
                  </span>
                  <span className="text-xs sm:text-sm font-black text-[#d49e3d] font-serif-body">
                    日连续值机
                  </span>
                </div>

                <p className="font-serif-body italic text-stone-300 text-xs">
                  {streakFreezeProtection
                    ? '已同步年度学练热力表 · 突发缺席自动消耗冻结卡'
                    : '“Every cable dispatched cements permanent memory.”'}
                </p>
              </div>

              {/* Mechanical Brass Stamp Plaque */}
              <div className="w-14 h-14 rounded-xs bg-[#d49e3d] p-1 shadow-[2px_2px_0px_#0e1610] flex items-center justify-center rotate-2 shrink-0 border-2 border-stone-900 text-stone-950">
                <Flame className="w-7 h-7 fill-stone-950 text-stone-950 animate-pulse" />
              </div>
            </div>

            {/* FULL YEAR HEATMAP (Jan 1 to Dec 31 of selected year, with Year Switcher) */}
            <div className="bg-[#f4edd3] dark:bg-[#1a251c] rounded-xs p-4 sm:p-5 border-2 border-stone-900 shadow-[4px_4px_0px_#0e1610] space-y-4">
              {/* Header with Title & Year Switcher Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-stone-900 pb-3">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-5 h-5 text-stone-900 dark:text-[#d49e3d]" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-serif-display font-black text-stone-900 dark:text-stone-100 text-sm sm:text-base">
                        值机热力图
                      </span>
                      <TelegramStamp text={`${selectedYear}年度`} variant="official" />
                    </div>
                    <span className="text-[10px] font-mono text-stone-600 dark:text-stone-400 block font-bold">
                      {selectedYear}年 1月1日 – 12月31日 · 活跃 {activeDaysCount} 天 · 归档入库 {totalYearCreatedCards} 封
                    </span>
                  </div>
                </div>

                {/* Year Switcher (Only years with activity can be selected) */}
                <div className="flex items-center gap-1.5 self-start sm:self-auto bg-[#faf7ee] dark:bg-[#152017] p-1 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711]">
                  <button
                    disabled={selectedYearIndex >= availableYears.length - 1}
                    onClick={() => {
                      sound.playKeyClick();
                      if (selectedYearIndex < availableYears.length - 1) {
                        setSelectedYear(availableYears[selectedYearIndex + 1]);
                      }
                    }}
                    className="p-1 rounded-xs hover:bg-stone-200 dark:hover:bg-stone-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed text-stone-900 dark:text-stone-200"
                    title="上一年"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-2 font-mono font-black text-xs text-stone-900 dark:text-[#d49e3d]">
                    {selectedYear} 年
                  </span>

                  <button
                    disabled={selectedYearIndex <= 0}
                    onClick={() => {
                      sound.playKeyClick();
                      if (selectedYearIndex > 0) {
                        setSelectedYear(availableYears[selectedYearIndex - 1]);
                      }
                    }}
                    className="p-1 rounded-xs hover:bg-stone-200 dark:hover:bg-stone-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed text-stone-900 dark:text-stone-200"
                    title="下一年"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Heatmap Grid & Day-of-week indicators */}
              <div className="space-y-2">
                <div
                  ref={heatmapScrollRef}
                  className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-stone-400 scrollbar-track-transparent"
                >
                  <div className="inline-flex flex-col min-w-[780px] select-none">
                    {/* Month Label Row */}
                    <div className="flex text-[10px] font-mono text-stone-600 dark:text-stone-400 font-bold mb-1 pl-7">
                      {monthLabels.map((m, idx) => (
                        <div
                          key={idx}
                          className="truncate text-left"
                          style={{
                            width: `${(53 / 12) * 15}px`,
                          }}
                        >
                          {m.label}
                        </div>
                      ))}
                    </div>

                    {/* Day-of-week labels + 7-Row Heatmap Grid */}
                    <div className="flex gap-2">
                      {/* Weekday indicator labels */}
                      <div className="flex flex-col justify-between py-0.5 text-[9px] font-mono text-stone-500 font-bold w-5 shrink-0">
                        <span className="h-3 leading-3">日</span>
                        <span className="h-3 leading-3 opacity-0">一</span>
                        <span className="h-3 leading-3">二</span>
                        <span className="h-3 leading-3 opacity-0">三</span>
                        <span className="h-3 leading-3">四</span>
                        <span className="h-3 leading-3 opacity-0">五</span>
                        <span className="h-3 leading-3">六</span>
                      </div>

                      {/* 53 Columns of Weeks */}
                      <div className="flex gap-1">
                        {fullYearWeeks.map((week, wIdx) => (
                          <div key={wIdx} className="flex flex-col gap-1 shrink-0">
                            {week.map((cell) => {
                              const isSelected = selectedHeatmapDate === cell.dateStr;

                              return (
                                <button
                                  key={cell.dateStr}
                                  onClick={() => {
                                    if (cell.isOutOfYear || cell.isFuture) return;
                                    sound.playKeyClick();
                                    setSelectedHeatmapDate(
                                      selectedHeatmapDate === cell.dateStr ? null : cell.dateStr
                                    );
                                  }}
                                  disabled={cell.isOutOfYear || cell.isFuture}
                                  className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-[2px] border transition-all cursor-pointer relative ${getCellColor(
                                    cell
                                  )} ${
                                    isSelected
                                      ? 'ring-2 ring-[#d49e3d] scale-125 z-10 shadow-[0px_0px_6px_#d49e3d]'
                                      : ''
                                  } ${cell.isToday ? 'ring-1.5 ring-emerald-400' : ''}`}
                                  title={`${cell.dateStr}：${
                                    cell.activityCount === 0
                                      ? '无学练记录'
                                      : `新卡 ${cell.createdCount} 封 · 复习 ${cell.reviewedCount} 次 · 开口说 ${cell.spokenCount} 次 (总计 ${cell.activityCount} 次)`
                                  }${cell.isMakeup ? ' [已补签]' : ''}`}
                                />
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Heatmap Legend */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] font-mono text-stone-600 dark:text-stone-400 pt-1 border-t border-stone-300 dark:border-stone-800">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">学练频次（新卡/复习/开口说）：</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px]">空 (0次)</span>
                      <div className="w-2.5 h-2.5 rounded-[2px] bg-transparent border border-stone-400/60 dark:border-stone-700" />
                      <div className="w-2.5 h-2.5 rounded-[2px] bg-[#bbf7d0] dark:bg-[#78c992] border border-[#86efac] dark:border-[#52b572]" />
                      <div className="w-2.5 h-2.5 rounded-[2px] bg-[#4ade80] dark:bg-[#349c53] border border-[#22c55e] dark:border-[#2b8245]" />
                      <div className="w-2.5 h-2.5 rounded-[2px] bg-[#16a34a] dark:bg-[#1e6f3b] border border-[#15803d] dark:border-[#17592f]" />
                      <div className="w-2.5 h-2.5 rounded-[2px] bg-[#14532d] dark:bg-[#114b27] border border-[#052e16] dark:border-[#0a331a]" />
                      <span className="text-[9px]">深 (多频)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-[2px] bg-[#d49e3d] border border-stone-900" />
                      <span>补签日</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-[2px] border-1.5 border-emerald-400 bg-transparent" />
                      <span>今日</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* In-UI Notification if makeup has insufficient feathers */}
              {makeupNotice && (
                <div className="p-2.5 bg-amber-100 dark:bg-amber-950/80 border-2 border-stone-900 rounded-xs text-amber-900 dark:text-amber-200 text-xs font-serif-body flex items-center gap-2 shadow-[2px_2px_0px_#101711]">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-700 dark:text-amber-400" />
                  <span>{makeupNotice}</span>
                </div>
              )}

              {/* Selected Day Details Inspection Box */}
              {selectedDayInfo && (
                <div className="mt-3 p-3.5 rounded-xs bg-[#faf7ee] dark:bg-[#152017] border-2 border-stone-900 shadow-[3px_3px_0px_#101711] space-y-3 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-300 dark:border-stone-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-stone-900 dark:text-[#d49e3d]">
                        {selectedDayInfo.dateStr}
                      </span>
                      {selectedDayInfo.isToday && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-xs bg-emerald-700 text-white font-bold">
                          TODAY · 今日
                        </span>
                      )}
                      {selectedDayInfo.isMakeup && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-xs bg-[#d49e3d] text-stone-950 font-black">
                          MAKEUP · 已补签
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-stone-700 dark:text-stone-300">
                      <span className="px-1.5 py-0.5 bg-stone-200/80 dark:bg-stone-800 rounded-xs">
                        新卡: {selectedDayInfo.createdCount} 封
                      </span>
                      <span className="px-1.5 py-0.5 bg-stone-200/80 dark:bg-stone-800 rounded-xs">
                        复习: {selectedDayInfo.reviewedCount} 次
                      </span>
                      <span className="px-1.5 py-0.5 bg-stone-200/80 dark:bg-stone-800 rounded-xs">
                        开口说: {selectedDayInfo.spokenCount} 次
                      </span>
                      <span className="font-bold text-stone-900 dark:text-[#d49e3d]">
                        总计: {selectedDayInfo.activityCount} 次
                      </span>
                    </div>

                    {/* Makeup Checkin Button for past inactive day */}
                    {selectedDayInfo.activityCount === 0 && !selectedDayInfo.isMakeup && !selectedDayInfo.isToday && (
                      <button
                        onClick={() => handleApplyMakeup(selectedDayInfo.dateStr)}
                        className="px-3 py-1.5 rounded-xs bg-[#d49e3d] hover:bg-[#c99333] active:translate-y-0.5 text-stone-900 font-serif-display font-black text-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] cursor-pointer whitespace-nowrap transition-all"
                      >
                        补签此日 (30🪶)
                      </button>
                    )}
                  </div>

                  {/* List of cards added on that day */}
                  {selectedDayInfo.cards.length > 0 ? (
                    <div className="space-y-1.5 pt-0.5">
                      <span className="text-[10px] text-stone-600 dark:text-stone-400 font-mono font-bold block">
                        当日录入卷宗明细：
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {selectedDayInfo.cards.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => onSelectCard?.(c)}
                            className="p-2.5 rounded-xs bg-[#f4edd3] dark:bg-[#1a251c] border-2 border-stone-900 shadow-[1px_1px_0px_#101711] hover:shadow-[2px_2px_0px_#101711] cursor-pointer transition-all space-y-0.5"
                          >
                            <div className="flex items-center justify-between text-[10px]">
                              <TelegramStamp text={c.category || '电报'} variant="archive" />
                              <span className="text-stone-500 font-mono">
                                {c.createdAt ? c.createdAt.slice(11, 16) : ''}
                              </span>
                            </div>
                            <div className="text-xs font-serif-display font-bold text-stone-900 dark:text-stone-100 truncate">
                              "{c.natural}"
                            </div>
                            <div className="text-[10px] text-stone-500 truncate">
                              {c.original}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-stone-500 font-serif-body italic">
                      该日无新电文起草录入记录。
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 今日值机任务 (Full-width, dynamically linked with today's card learning & reviewing) */}
            <div className="bg-[#f4edd3] dark:bg-[#1a251c] rounded-xs p-4 sm:p-5 border-2 border-stone-900 shadow-[3px_3px_0px_#101711] space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-stone-900 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-xs bg-[#d49e3d] text-stone-950 border border-stone-900 shadow-[1px_1px_0px_#101711]">
                    <Zap className="w-4 h-4 fill-stone-950" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-serif-display font-black text-sm sm:text-base text-stone-900 dark:text-stone-100">
                        今日值机任务
                      </span>
                      <span className="text-[10px] font-mono font-bold text-stone-900 dark:text-[#d49e3d] px-2 py-0.5 rounded-xs bg-[#eee8d1] dark:bg-[#243427] border border-stone-900">
                        已达成 {completedQuestsCount}/{syncedQuests.length} 项
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-stone-600 dark:text-stone-400 font-bold">
                  <Clock className="w-3.5 h-3.5 text-[#d49e3d]" />
                  <span>每日 00:00 自动刷新 · 实时关联今日学练</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {syncedQuests.map((quest) => {
                  const isDone = quest.completed || quest.current >= quest.target;
                  const progressPercent = Math.min(100, Math.round((quest.current / quest.target) * 100));

                  return (
                    <div
                      key={quest.id}
                      className="bg-[#faf7ee] dark:bg-[#152017] border-2 border-stone-900 rounded-xs p-3 sm:p-3.5 flex flex-col justify-between gap-2.5 shadow-[2px_2px_0px_#101711] hover:shadow-[3px_3px_0px_#101711] transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-xs bg-[#e8e0c5] dark:bg-[#243427] border border-stone-900 flex items-center justify-center shrink-0 mt-0.5">
                            {getQuestIcon(quest.id)}
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 font-serif-display">
                                {quest.title}
                              </span>
                              {isDone && (
                                <span className="text-[9px] font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-1 rounded-xs border border-emerald-800">
                                  达成
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-tight">
                              {quest.description}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar & Real Counts */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                          <span className="text-stone-600 dark:text-stone-400">
                            进度: {quest.current}/{quest.target}
                          </span>
                          <span className="text-stone-900 dark:text-[#d49e3d]">
                            {progressPercent}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[#e8e0c5] dark:bg-[#121c13] rounded-xs overflow-hidden border border-stone-900">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isDone ? 'bg-emerald-600' : 'bg-[#d49e3d]'
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Action Row */}
                      <div className="pt-2 border-t border-dashed border-stone-300 dark:border-stone-800 flex items-center justify-between">
                        <div className="flex items-center gap-1 font-mono text-xs text-[#d49e3d] font-black">
                          <Feather className="w-3.5 h-3.5 fill-current" />
                          <span>+{quest.rewardFeathers} 🪶</span>
                        </div>

                        <div>
                          {quest.claimed || claimedQuestIds.has(quest.id) ? (
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xs bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs font-serif-body font-bold border border-stone-400 dark:border-stone-700">
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                              <span>已领取</span>
                            </div>
                          ) : isDone ? (
                            <button
                              onClick={() => handleClaim(quest)}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xs bg-[#d49e3d] hover:bg-[#c99333] active:translate-y-0.5 text-stone-900 font-serif-display font-black text-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] cursor-pointer transition-all animate-bounce"
                            >
                              <Feather className="w-3 h-3 fill-stone-950" />
                              <span>领取奖励 (+{quest.rewardFeathers})</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleQuestAction(quest.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-xs bg-[#faf7ee] hover:bg-white text-stone-800 dark:bg-[#1f2b21] dark:text-stone-200 text-[10px] font-serif-body font-bold border border-stone-900 shadow-[1px_1px_0px_#101711] cursor-pointer"
                            >
                              <span>{getQuestActionLabel(quest.id)}</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* TAB 2: 羽毛商店 (FEATHER SHOP - REDESIGNED FOR ACTUAL FEATURES & INTERACTIONS) */
          <div className="w-full space-y-4 sm:space-y-5">
            {/* Feather Balance Header */}
            <div className="bg-[#f4edd3] dark:bg-[#1a251c] rounded-xs p-4 sm:p-5 border-2 border-stone-900 shadow-[3px_3px_0px_#101711] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xs bg-[#d49e3d] border-2 border-stone-900 shadow-[2px_2px_0px_#101711] flex items-center justify-center text-stone-950">
                  <Feather className="w-6 h-6 fill-current" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono text-stone-600 dark:text-stone-400 font-bold tracking-wider block">
                    TELEGRAPH QUARTERMASTER ASSETS
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-black font-serif-display text-[#d49e3d]">
                      {feathers}
                    </span>
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-200 font-serif-body">
                      枚功勋羽毛可用
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-stone-600 dark:text-stone-400 font-serif-body border-t sm:border-t-0 sm:border-l-2 border-stone-900 border-dashed pt-2 sm:pt-0 sm:pl-4">
                <span className="font-bold block text-stone-800 dark:text-stone-200 mb-0.5">功勋获取渠道：</span>
                <span>起草新电报 (+3🪶) · 艾宾浩斯复审 (+2~4🪶) · 今日值机任务 (+10~15🪶)</span>
              </div>
            </div>

            {/* Shop Category Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: 'all', label: '全部物资' },
                { id: 'skin', label: '机身涂装' },
                { id: 'consumable', label: '值机保障' },
                { id: 'feature', label: '交互特权' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    sound.playKeyClick();
                    setShopCategoryFilter(cat.id as typeof shopCategoryFilter);
                  }}
                  className={`px-3 py-1.5 rounded-xs text-xs font-serif-display font-black border-2 border-stone-900 transition-all cursor-pointer whitespace-nowrap ${
                    shopCategoryFilter === cat.id
                      ? 'bg-[#d49e3d] text-stone-950 shadow-[2px_2px_0px_#101711]'
                      : 'bg-[#faf7ee] dark:bg-[#152017] text-stone-700 dark:text-stone-300 hover:bg-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Shop Items Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredShopItems.map((item) => {
                const isSkin = item.category === 'skin';
                const isFreeze = item.id === 'shop-freeze-card';
                const isSprint = item.id === 'shop-sprint-review';
                const isMakeup = item.id === 'shop-makeup-card';

                return (
                  <div
                    key={item.id}
                    className="bg-[#faf7ee] dark:bg-[#1a251c] rounded-xs p-4 border-2 border-stone-900 shadow-[3px_3px_0px_#101711] flex flex-col justify-between gap-3 hover:shadow-[4px_4px_0px_#101711] transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {isSkin && (
                            <div
                              className={`w-4 h-4 rounded-full border border-stone-900 shrink-0 ${
                                item.id === 'shop-skin-gold'
                                  ? 'bg-[#f7d984]'
                                  : item.id === 'shop-skin-emerald'
                                  ? 'bg-[#1c3829]'
                                  : 'bg-[#1a201c]'
                              }`}
                            />
                          )}
                          <span className="text-sm font-bold text-stone-900 dark:text-stone-100 font-serif-display">
                            {item.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {isSkin && item.owned && (
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded-xs border border-stone-900 font-bold font-mono ${
                                item.active
                                  ? 'bg-[#243427] text-[#d49e3d]'
                                  : 'bg-stone-200 dark:bg-stone-800 text-stone-500'
                              }`}
                            >
                              {item.active ? 'ACTIVE · 已装配' : 'OWNED · 仓库中'}
                            </span>
                          )}
                          {isFreeze && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-xs bg-[#243427] text-emerald-400 border border-stone-900 font-bold font-mono">
                              在库: {streakFreezes} 张
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-stone-700 dark:text-stone-300 font-serif-body leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="pt-2.5 border-t-2 border-dashed border-stone-300 dark:border-stone-800 flex items-center justify-between">
                      <div className="flex items-center gap-1 font-mono text-xs font-black text-[#d49e3d]">
                        <Feather className="w-3.5 h-3.5 fill-current" />
                        <span>{item.cost} 🪶</span>
                      </div>

                      <div>
                        {isSkin ? (
                          item.owned ? (
                            <button
                              onClick={() => {
                                sound.playKeyClick();
                                onToggleShopItem(item.id);
                              }}
                              className={`px-3 py-1.5 rounded-xs text-xs font-serif-display font-black border-2 border-stone-900 transition-all cursor-pointer ${
                                item.active
                                  ? 'bg-[#243427] text-[#d49e3d] shadow-[2px_2px_0px_#0e1610]'
                                  : 'bg-[#d49e3d] hover:bg-[#c99333] text-stone-900 shadow-[2px_2px_0px_#101711]'
                              }`}
                            >
                              {item.active ? '当前使用中' : '装配此涂装'}
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                sound.playKeyClick();
                                onBuyShopItem(item.id);
                              }}
                              disabled={feathers < item.cost}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-serif-display font-black border-2 border-stone-900 transition-all ${
                                feathers >= item.cost
                                  ? 'bg-[#d49e3d] hover:bg-[#c99333] active:translate-y-0.5 text-stone-900 shadow-[2px_2px_0px_#101711] cursor-pointer'
                                  : 'bg-stone-200 dark:bg-stone-800 text-stone-400 border-stone-400 cursor-not-allowed'
                              }`}
                            >
                              <span>兑换涂装</span>
                            </button>
                          )
                        ) : isFreeze ? (
                          <button
                            onClick={() => {
                              sound.playKeyClick();
                              onBuyShopItem(item.id);
                            }}
                            disabled={feathers < item.cost}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-serif-display font-black border-2 border-stone-900 transition-all ${
                              feathers >= item.cost
                                ? 'bg-[#d49e3d] hover:bg-[#c99333] active:translate-y-0.5 text-stone-900 shadow-[2px_2px_0px_#101711] cursor-pointer'
                                : 'bg-stone-200 dark:bg-stone-800 text-stone-400 border-stone-400 cursor-not-allowed'
                            }`}
                          >
                            <span>+1 兑换入库</span>
                          </button>
                        ) : isSprint ? (
                          <button
                            onClick={() => {
                              sound.playKeyClick();
                              onBuyShopItem(item.id);
                            }}
                            disabled={feathers < item.cost}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-serif-display font-black border-2 border-stone-900 transition-all ${
                              feathers >= item.cost
                                ? 'bg-[#d49e3d] hover:bg-[#c99333] active:translate-y-0.5 text-stone-900 shadow-[2px_2px_0px_#101711] cursor-pointer'
                                : 'bg-stone-200 dark:bg-stone-800 text-stone-400 border-stone-400 cursor-not-allowed'
                            }`}
                          >
                            <span>兑换并立即复查 ⚡</span>
                          </button>
                        ) : isMakeup ? (
                          item.owned ? (
                            <button
                              onClick={() => {
                                sound.playKeyClick();
                                setActiveSubTab('progress');
                              }}
                              className="px-3 py-1.5 rounded-xs bg-[#faf7ee] hover:bg-white text-stone-900 font-serif-display font-bold text-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] cursor-pointer transition-all"
                            >
                              前往热力表补签 📅
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                sound.playKeyClick();
                                onBuyShopItem(item.id);
                              }}
                              disabled={feathers < item.cost}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-serif-display font-black border-2 border-stone-900 transition-all ${
                                feathers >= item.cost
                                  ? 'bg-[#d49e3d] hover:bg-[#c99333] active:translate-y-0.5 text-stone-900 shadow-[2px_2px_0px_#101711] cursor-pointer'
                                  : 'bg-stone-200 dark:bg-stone-800 text-stone-400 border-stone-400 cursor-not-allowed'
                              }`}
                            >
                              <span>兑换凭证</span>
                            </button>
                          )
                        ) : item.owned ? (
                          <span className="text-xs text-stone-500 font-mono font-bold">已入库</span>
                        ) : (
                          <button
                            onClick={() => {
                              sound.playKeyClick();
                              onBuyShopItem(item.id);
                            }}
                            disabled={feathers < item.cost}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-serif-display font-black border-2 border-stone-900 transition-all ${
                              feathers >= item.cost
                                ? 'bg-[#d49e3d] hover:bg-[#c99333] active:translate-y-0.5 text-stone-900 shadow-[2px_2px_0px_#101711] cursor-pointer'
                                : 'bg-stone-200 dark:bg-stone-800 text-stone-400 border-stone-400 cursor-not-allowed'
                            }`}
                          >
                            <span>兑换特权</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 任务全圆满达成庆祝弹窗（点旁边或2秒后自动退出） */}
      {showCelebrationModal && (
        <div
          onClick={() => setShowCelebrationModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs animate-in fade-in duration-200 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-[#faf7ee] dark:bg-[#1a251c] rounded-xs border-3 border-stone-900 shadow-[8px_8px_0px_#101711] p-6 text-center space-y-4 animate-in zoom-in-95 duration-200 cursor-default"
          >
            <button
              onClick={() => setShowCelebrationModal(false)}
              className="absolute top-2.5 right-2.5 p-1 rounded-xs text-stone-500 hover:text-stone-900 dark:hover:text-stone-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-16 h-16 mx-auto rounded-full bg-[#d49e3d] border-2 border-stone-900 flex items-center justify-center shadow-[3px_3px_0px_#101711] animate-bounce">
              <Trophy className="w-8 h-8 text-stone-950 fill-stone-950" />
            </div>

            <div className="space-y-1.5">
              <div className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono text-[11px] font-bold border border-emerald-700">
                ★ 今日值机任务全部圆满达成 ★
              </div>
              <h3 className="font-serif-display font-black text-lg sm:text-xl text-stone-900 dark:text-stone-100">
                全勤值机 · 勋章加冕！
              </h3>
              <p className="text-xs font-serif-body text-stone-600 dark:text-stone-300 leading-relaxed">
                今日所有起草、复核、跟读与机要归档任务均已全部达成，功勋羽毛已尽数收入囊中！
              </p>
            </div>

            <div className="text-[10px] font-mono text-stone-400 dark:text-stone-500 pt-2 border-t border-dashed border-stone-300 dark:border-stone-800">
              点击任意空白处或 2 秒后自动退出
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
