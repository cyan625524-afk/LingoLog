import { FlashCard, MasteryLevel, ReviewHistoryEntry, ReviewRating, HeatmapDay } from '../types';

// Ebbinghaus intervals in days
export const EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15, 30, 60];

// Format date to YYYY-MM-DD
export function formatDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Calculate days difference between target and now
export function getDaysDiff(targetIso: string): number {
  const target = new Date(targetIso);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Format friendly human-readable next review time
export function formatNextReviewHuman(nextReviewAt: string): string {
  if (!nextReviewAt) return '今日待复习';
  const diff = getDaysDiff(nextReviewAt);
  if (diff <= 0) return '今日到期';
  if (diff === 1) return '明天';
  if (diff === 2) return '后天';
  if (diff < 7) return `${diff} 天后`;
  if (diff < 14) return '1 周后';
  if (diff < 30) return `${Math.round(diff / 7)} 周后`;
  if (diff < 60) return '1 个月后';
  return '2 个月后';
}

// Check if card is overdue or due today
export function isCardDue(nextReviewAt: string): boolean {
  const target = new Date(nextReviewAt);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  return target <= now;
}

// Calculate how many days overdue
export function getOverdueDays(nextReviewAt: string): number {
  const target = new Date(nextReviewAt);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diff = Math.floor((now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

// Compute retention scaling factor based on target retention (80% -> 1.25x, 85% -> 1.1x, 90% -> 1.0x)
export function getRetentionScaleFactor(targetRetention: number = 90): number {
  if (targetRetention <= 80) return 1.25;
  if (targetRetention <= 85) return 1.12;
  return 1.0;
}

// Compute next review interval stage and due date (Supporting 4-Tier system: again, hard, good, easy)
export function calculateNextReview(
  currentStage: number,
  rating: ReviewRating,
  targetRetention: number = 90
): {
  nextIntervalStage: number;
  nextReviewAt: Date;
  masteryLevel: MasteryLevel;
  intervalDays: number;
} {
  const now = new Date();
  let nextStage = currentStage;
  let mastery: MasteryLevel = 'learning';
  const scale = getRetentionScaleFactor(targetRetention);
  const baseInterval = EBBINGHAUS_INTERVALS[currentStage] || 1;
  let intervalDays = 1;

  if (rating === 'easy') {
    // Jump 2 stages forward
    nextStage = Math.min(EBBINGHAUS_INTERVALS.length - 1, currentStage + 2);
    intervalDays = Math.max(1, Math.round((EBBINGHAUS_INTERVALS[nextStage] || 30) * scale * 1.3));
    mastery = 'mastered';
  } else if (rating === 'good' || rating === 'mastered') {
    // Normal Ebbinghaus advancement
    nextStage = Math.min(EBBINGHAUS_INTERVALS.length - 1, currentStage + 1);
    intervalDays = Math.max(1, Math.round((EBBINGHAUS_INTERVALS[nextStage] || 15) * scale));
    mastery = nextStage >= 3 ? 'mastered' : 'learning';
  } else if (rating === 'hard' || rating === 'uncertain') {
    // Stay or minor step
    nextStage = Math.max(0, currentStage);
    intervalDays = Math.max(1, Math.round(((EBBINGHAUS_INTERVALS[nextStage] || 1) / 2) * scale));
    mastery = 'uncertain';
  } else {
    // Task 9: Again 评分不写死 1 天，改为当前间隔 × 20%（至少 1 天）
    nextStage = 0;
    intervalDays = Math.max(1, Math.round(baseInterval * 0.2));
    mastery = 'learning';
  }

  const nextDate = new Date();
  nextDate.setDate(now.getDate() + intervalDays);

  return {
    nextIntervalStage: nextStage,
    nextReviewAt: nextDate,
    masteryLevel: mastery,
    intervalDays,
  };
}

// Compute new state based on rating
export function calculateReviewResult(
  card: FlashCard,
  rating: ReviewRating,
  targetRetention: number = 90
): {
  nextReviewAt: string;
  intervalStage: number;
  masteryLevel: MasteryLevel;
  reviewCount: number;
  lastReviewedAt: string;
} {
  const { nextIntervalStage, nextReviewAt, masteryLevel } = calculateNextReview(
    card.intervalStage ?? 0,
    rating,
    targetRetention
  );

  return {
    nextReviewAt: nextReviewAt.toISOString(),
    intervalStage: nextIntervalStage,
    masteryLevel,
    reviewCount: (card.reviewCount || 0) + 1,
    lastReviewedAt: new Date().toISOString(),
  };
}

// Create a snapshot for Undo
export function createHistorySnapshot(
  card: FlashCard,
  rating: ReviewRating
): ReviewHistoryEntry {
  return {
    cardId: card.id,
    prevNextReviewAt: card.nextReviewAt,
    prevIntervalStage: card.intervalStage ?? 0,
    prevMasteryLevel: card.masteryLevel,
    prevReviewCount: card.reviewCount ?? 0,
    prevLastReviewedAt: card.lastReviewedAt,
    rating,
    timestamp: Date.now(),
  };
}

// Calculate Due Retention Rate (Good + Easy ratings percentage on due cards)
//
// 注意：返回的是真实计算值，不含任何保底值或偏移量。
// total7d / total30d 是判断"有没有数据"的唯一依据：为 0 时 rate 也是 0，
// 调用方必须先看 total，不要直接把 0% 当成"表现很差"渲染。
export function calculateDueRetentionRate(
  historyOrCards: (ReviewHistoryEntry | FlashCard)[]
): {
  rate7d: number;
  rate30d: number;
  total7d: number;
  total30d: number;
} {
  const now = Date.now();
  const day7Ms = 7 * 24 * 60 * 60 * 1000;
  const day30Ms = 30 * 24 * 60 * 60 * 1000;

  // 没有数据就是没有数据，不要返回好看的默认值
  if (historyOrCards.length === 0) {
    return { rate7d: 0, rate30d: 0, total7d: 0, total30d: 0 };
  }

  // Check if it's FlashCard array
  const isCards = 'natural' in (historyOrCards[0] as any);

  if (isCards) {
    const cards = historyOrCards as FlashCard[];
    const mastered = cards.filter(
      (c) => c.masteryLevel === 'mastered' || (c.intervalStage ?? 0) >= 3
    ).length;
    // 这里算的是「已掌握卡片占比」，不是「复习留存率」——两者不是一回事。
    // 保留原行为（因为卡片数组是唯一可得的输入），但如实返回，不做美化。
    const rate = Math.round((mastered / Math.max(1, cards.length)) * 100);
    return {
      rate7d: rate,
      rate30d: rate,
      total7d: cards.length,
      total30d: cards.length,
    };
  }

  const history = historyOrCards as ReviewHistoryEntry[];
  const entries7d = history.filter((h) => now - h.timestamp <= day7Ms);
  const entries30d = history.filter((h) => now - h.timestamp <= day30Ms);

  const goodEasy7d = entries7d.filter(
    (h) => h.rating === 'good' || h.rating === 'easy' || (h.rating as any) === 'mastered'
  ).length;
  const goodEasy30d = entries30d.filter(
    (h) => h.rating === 'good' || h.rating === 'easy' || (h.rating as any) === 'mastered'
  ).length;

  const rate7d = entries7d.length > 0 ? Math.round((goodEasy7d / entries7d.length) * 100) : 0;
  const rate30d = entries30d.length > 0 ? Math.round((goodEasy30d / entries30d.length) * 100) : 0;

  return {
    rate7d,
    rate30d,
    total7d: entries7d.length,
    total30d: entries30d.length,
  };
}

// Check total review count for FSRS optimization recommendation threshold (>= 1000)
export function checkFsrsEligibility(
  cardsOrCount: FlashCard[] | number,
  reviewHistory: ReviewHistoryEntry[] = []
): {
  eligible: boolean;
  totalReviews: number;
  remaining: number;
} {
  const totalReviews =
    typeof cardsOrCount === 'number'
      ? cardsOrCount
      : Math.max(
          cardsOrCount.reduce((acc, c) => acc + (c.reviewCount || 0), 0),
          reviewHistory.length
        );

  const eligible = totalReviews >= 1000;
  return {
    eligible,
    totalReviews,
    remaining: Math.max(0, 1000 - totalReviews),
  };
}

// Calculate consecutive on-duty streak strictly derived from the heatmap and card logs
export function calculateStreakFromHeatmap(
  heatmap: Record<string, HeatmapDay> = {},
  cards: FlashCard[] = []
): number {
  const now = new Date();
  const todayStr = formatDate(now);

  const isDayActive = (dateStr: string): boolean => {
    const day = heatmap[dateStr];
    if (day) {
      if (day.isMakeup) return true;
      const count = day.count ?? 0;
      const reviews = day.reviews ?? day.reviewedCount ?? 0;
      const learned = day.learnedCount ?? 0;
      if (count > 0 || reviews > 0 || learned > 0) return true;
    }
    if (cards.some((c) => c.createdAt && c.createdAt.slice(0, 10) === dateStr)) {
      return true;
    }
    if (cards.some((c) => c.lastReviewedAt && c.lastReviewedAt.slice(0, 10) === dateStr)) {
      return true;
    }
    return false;
  };

  const isTodayActive = isDayActive(todayStr);

  let streak = 0;
  const d = new Date(now);

  if (isTodayActive) {
    // Today has activity: start counting with today as 1
    streak = 1;
    d.setDate(d.getDate() - 1);
  } else {
    // Today has not recorded activity yet: check yesterday to keep streak alive
    d.setDate(d.getDate() - 1);
    const yesterdayStr = formatDate(d);
    if (!isDayActive(yesterdayStr)) {
      return 0;
    }
    streak = 1;
    d.setDate(d.getDate() - 1);
  }

  // Traverse backwards continuously through consecutive active days
  while (true) {
    const dStr = formatDate(d);
    if (isDayActive(dStr)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}
