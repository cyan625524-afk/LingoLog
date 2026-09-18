import { TitleCategory, TitleItem, UserProfile } from '../types';

export interface TitleDefinition {
  id: string;
  name: string;
  category: TitleCategory;
  categoryLabel: string;
  icon: string;
  description: string;
  targetValue: number;
  unit: string;
}

export const TITLE_DEFINITIONS: TitleDefinition[] = [
  // 1. 司职历程 (严格与热力图有颜色的值机天数挂钩)
  {
    id: 'title-rookie',
    name: '新手电报员',
    category: 'join_days',
    categoryLabel: '司职历程',
    icon: '📻',
    description: '初入电讯台，收发首份电文（首日值机打卡自动获得）',
    targetValue: 1,
    unit: '天',
  },
  {
    id: 'title-senior',
    name: '资深发报员',
    category: 'join_days',
    categoryLabel: '司职历程',
    icon: '⚡',
    description: '热力图值机满 7 天，熟稔发报节奏与收码规范',
    targetValue: 7,
    unit: '天',
  },
  {
    id: 'title-veteran',
    name: '百日特派员',
    category: 'join_days',
    categoryLabel: '司职历程',
    icon: '📜',
    description: '热力图值机满 30 天，成为不可或缺的王牌特派员',
    targetValue: 30,
    unit: '天',
  },

  // 2. 坚守前哨 (连续值机天数)
  {
    id: 'title-streak-3',
    name: '全勤守望者',
    category: 'streak',
    categoryLabel: '坚守前哨',
    icon: '🕯️',
    description: '连续值机打卡达 3 天，初步形成每日学练自律节奏',
    targetValue: 3,
    unit: '天',
  },
  {
    id: 'title-streak-7',
    name: '破晓监听员',
    category: 'streak',
    categoryLabel: '坚守前哨',
    icon: '📡',
    description: '连续值机打卡达 7 天，整整一周风雨无阻守候密电',
    targetValue: 7,
    unit: '天',
  },
  {
    id: 'title-streak-21',
    name: '金牌电讯长',
    category: 'streak',
    categoryLabel: '坚守前哨',
    icon: '👑',
    description: '连续值机打卡达 21 天，永久固化地道语感记忆回路',
    targetValue: 21,
    unit: '天',
  },

  // 3. 密电库藏 (总归档卡片数)
  {
    id: 'title-cards-10',
    name: '初试译电手',
    category: 'cards',
    categoryLabel: '密电库藏',
    icon: '✍️',
    description: '归档词库卡片达 10 封，初建个人专属机密卷宗',
    targetValue: 10,
    unit: '封',
  },
  {
    id: 'title-cards-50',
    name: '密电编译官',
    category: 'cards',
    categoryLabel: '密电库藏',
    icon: '💼',
    description: '归档词库卡片达 50 封，词库储备扎实，随时调遣运用',
    targetValue: 50,
    unit: '封',
  },
  {
    id: 'title-cards-100',
    name: '机要总督导',
    category: 'cards',
    categoryLabel: '密电库藏',
    icon: '🎖️',
    description: '归档词库卡片达 100 封，词汇宝库浩瀚，统领机要密电',
    targetValue: 100,
    unit: '封',
  },
];

/** 计算从注册日期至今的天数（首日即为第 1 天） */
export function calculateDaysSinceJoin(joinDate?: string): number {
  if (!joinDate) return 1;
  try {
    const joined = new Date(joinDate);
    if (isNaN(joined.getTime())) return 1;
    joined.setHours(0, 0, 0, 0);

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const diffMs = now.getTime() - joined.getTime();
    const days = Math.floor(diffMs / (24 * 3600 * 1000)) + 1;
    return Math.max(1, days);
  } catch {
    return 1;
  }
}

export interface TitleMetrics {
  /** 严格与热力图有颜色（新卡片/复核/开口说/补签）的实际有效天数挂钩 */
  activeHeatmapDays?: number;
  daysSinceJoin?: number;
  streakDays: number;
  totalCards: number;
}

/** 计算全部称号的解锁状态与进度 */
export function computeTitles(metrics: TitleMetrics): TitleItem[] {
  return TITLE_DEFINITIONS.map((def) => {
    let currentValue = 0;
    if (def.category === 'join_days') {
      // 严格与热力图有颜色的天数挂钩
      currentValue = metrics.activeHeatmapDays !== undefined ? metrics.activeHeatmapDays : (metrics.daysSinceJoin || 0);
    } else if (def.category === 'streak') {
      currentValue = metrics.streakDays;
    } else if (def.category === 'cards') {
      currentValue = metrics.totalCards;
    }

    // 新手电报员首日自动获得；其余必须达成目标天数/张数
    const isUnlocked = def.id === 'title-rookie' ? true : currentValue >= def.targetValue;
    const progressText = isUnlocked
      ? `已达成 (${def.targetValue}/${def.targetValue} ${def.unit})`
      : `${currentValue}/${def.targetValue} ${def.unit}`;

    return {
      id: def.id,
      name: def.name,
      category: def.category,
      categoryLabel: def.categoryLabel,
      icon: def.icon,
      description: def.description,
      targetValue: def.targetValue,
      currentValue: def.id === 'title-rookie' ? Math.max(1, currentValue) : currentValue,
      isUnlocked,
      progressText,
    };
  });
}

export const DEFAULT_TITLE = '新手电报员';

/** 获取当前佩戴称号，若未佩戴或已佩戴称号不在库中，安全回退到新手电报员 */
export function getEquippedTitle(userProfile?: UserProfile | null): string {
  if (!userProfile?.equippedTitle) {
    return DEFAULT_TITLE;
  }
  return userProfile.equippedTitle;
}
