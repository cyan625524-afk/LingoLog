export type NavTab = 'learn' | 'review' | 'library' | 'study' | 'progress' | 'archive' | 'stats' | 'profile';

export type CardCategory =
  | '日常家务'
  | '职场办公'
  | '社交聚会'
  | '购物消费'
  | '出行旅游'
  | '饮食健康'
  | '兴趣爱好'
  | '情感表达'
  | '科技生活'
  | '学习提升';

export const CARD_CATEGORIES: CardCategory[] = [
  '日常家务',
  '职场办公',
  '社交聚会',
  '购物消费',
  '出行旅游',
  '饮食健康',
  '兴趣爱好',
  '情感表达',
  '科技生活',
  '学习提升',
];

export interface PhraseItem {
  phrase: string;
  pos: string;
  meaning: string;
  example: string;
}

export type MasteryLevel = 'learning' | 'uncertain' | 'mastered';
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy' | 'mastered' | 'uncertain' | 'forgot';

export interface SpeechWordAnalysis {
  word: string;
  status: 'correct' | 'warning' | 'incorrect';
  ipa?: string;
  tip?: string;
}

export interface SpeechEvaluationResult {
  score: number;
  accuracy: number;
  fluency: number;
  completeness: number;
  prosody: number;
  feedback: string;
  encouragement?: string;
  words?: SpeechWordAnalysis[];
}

export interface SpeechRecord {
  date: string;
  score: number;
  accuracy: string | number;
  fluency?: number;
  completeness?: number;
  prosody?: number;
  feedback?: string;
  words?: SpeechWordAnalysis[];
}

export interface RegisterVariants {
  casual?: string;
  neutral?: string;
  formal?: string;
}

export interface RedHighlight {
  text: string;
  reason?: string;
}

export interface FlashCard {
  id: string;
  original: string; // 我的原始表达
  /** @deprecated 历史兼容字段，请优先使用 `original` */
  originalText?: string;
  natural: string; // 地道母语表达
  /** @deprecated 历史兼容字段，请优先使用 `natural` */
  correctedText?: string;
  phonetic?: string;
  colloquial?: string;
  formal?: string;
  variants?: RegisterVariants; // P2 语域变体 (casual/neutral/formal)
  redHighlights?: string[]; // P1 红带标记高亮词汇
  explanation: string; // 深度知识解析（150字以内，分点提行格式）
  category: CardCategory | string; // 固定十组之一
  /** @deprecated 历史兼容字段，请优先使用 `category` */
  scene?: string;
  tags: string[]; // 核心关键词标签（3个以内，每个为2字名词）
  /** @deprecated 历史兼容字段，请优先使用 `tags` */
  manualTags?: string[];
  phrases: PhraseItem[]; // 核心词组/同义表达
  createdAt: string; // ISO String
  lastReviewedAt?: string;
  nextReviewAt: string; // ISO String
  /** @deprecated 历史兼容字段，请优先使用 `nextReviewAt` */
  nextReviewDate?: string;
  intervalStage: number; // 0: new, 1: 1d, 2: 2d, 3: 4d, 4: 7d, 5: 15d, 6: 30d, 7: 60d
  /** @deprecated 历史兼容字段，请优先使用 `intervalStage` */
  reviewStage?: number;
  reviewCount: number;
  reviewHistory?: string[];
  masteryLevel: MasteryLevel;
  isFavorite: boolean;
  /** @deprecated 历史兼容字段，请优先使用 `isFavorite` */
  isStarred?: boolean;
  userNotes?: string;
  /** @deprecated 历史兼容字段，请优先使用 `userNotes` */
  userNote?: string;
  readCount?: number;
  spokenCount?: number;
  spokenDuration?: number;
  lastSpeakDuration?: number;
  speechRecords?: SpeechRecord[];
  /** 换场景复述提示语（≤3条中文场景） */
  transferPrompts?: string[];
  /** 主动提取统计数据 */
  recallStats?: {
    attempts: number;
    successful: number;
    partial: number;
    failed: number;
    revealed: number;
    transferPassCount?: number;
  };
  /** 最近一次提取结果 */
  lastRecallResult?: 'pass' | 'partial' | 'fail' | 'revealed' | 'skipped';
  /** 最近一次复习模式 */
  lastReviewMode?: 'original' | 'transfer';
}

export interface ReviewHistoryEntry {
  cardId: string;
  prevNextReviewAt: string;
  prevIntervalStage: number;
  prevMasteryLevel: MasteryLevel;
  prevReviewCount: number;
  prevLastReviewedAt?: string;
  rating: ReviewRating;
  timestamp: number;
  prevRecallStats?: FlashCard['recallStats'];
  prevLastRecallResult?: FlashCard['lastRecallResult'];
  prevLastReviewMode?: FlashCard['lastReviewMode'];
}

export interface RetrievalContext {
  result: 'pass' | 'partial' | 'fail' | 'revealed' | 'skipped';
  mode: 'original' | 'transfer';
  pronunciationCoverage?: number;
}

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  rewardFeathers: number;
  completed: boolean;
  claimed: boolean;
  iconName: string;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  iconName: string;
  category: 'guarantee' | 'chassis' | 'theme' | 'utility' | 'skin' | 'sound' | 'consumable' | 'feature';
  owned: boolean;
  active?: boolean;
}

export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  count: number;
  learnedCount?: number;
  reviewedCount?: number;
  spokenCount?: number;
  studyMinutes?: number; // 实际学习时长（分钟）
  studySeconds?: number; // 实际学习时长（秒）
  reviews?: number;
  newCards?: number;
  isMakeup?: boolean;
}

export interface StoryItem {
  id: string;
  title: string;
  titleZh?: string;
  content?: string; // 兼容导入的 content
  englishContent: string;
  translation?: string; // 兼容导入的 translation
  chineseTranslation: string;
  matchedCardIds?: string[]; // 兼容导入的 matchedCardIds
  highlightedCards?: string[];
  createdAt: string;
  keyTakeaways?: string[];
}

export interface PracticeScenario {
  id: string;
  tag: string;
  promptZh: string;
  subPrompt: string;
  noteText: string;
  referenceAnswer?: string;
}

export interface FeatherTransaction {
  id: string;
  date: string;
  amount: number; // + or -
  description: string;
}

export interface InputHistoryItem {
  id: string;
  text: string;
  timestamp: number;
  category?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  isLoggedIn: boolean;
  joinDate: string;
  role: string;
  /** 当前佩戴的荣誉称号 */
  equippedTitle?: string;
}

export type TitleCategory = 'join_days' | 'streak' | 'cards';

export interface TitleItem {
  id: string;
  name: string;
  category: TitleCategory;
  categoryLabel: string;
  icon: string;
  description: string;
  targetValue: number;
  currentValue: number;
  isUnlocked: boolean;
  progressText: string;
}

export interface AppSettings {
  /** 服务商预设 id，见 src/data/providers.ts（如 'deepseek' / 'gemini' / 'custom'） */
  apiProvider: string;
  /** 覆盖预设的 Base URL。留空则用预设值。仅 openai-compatible 用得上 */
  customBaseUrl: string;
  modelName: string;
  customApiKey: string;
  /**
   * 智能翻译引擎开关。
   * 只有它为 true 时，密钥才会被带到请求里；false 时一律走公开翻译降级。
   * 存在的意义是「不想用了就关掉」——关掉不必删密钥，下次再开不用重填。
   */
  apiEnabled: boolean;
  /** 最近一次自检通过的时间。仅用于界面显示，不参与任何判断逻辑 */
  apiVerifiedAt?: string;
  soundEnabled: boolean;
  soundVolume: number;
  soundTheme: 'classic' | 'olympia' | 'mechanical';
  typewriterSkin: 'sage' | 'classic' | 'gold' | 'leather' | 'midnight' | 'emerald';
  /** 全局页面皮肤风格：经典复古、暗夜赛博、法式晨曦、深海电讯 */
  pageTheme?: 'vintage' | 'cyber' | 'sunlight' | 'ocean';
  themeMode: 'light' | 'dark';
  enableReminders: boolean;
  reminderTime: string;
  wxpusherUid?: string;
  wxpusherEnabled?: boolean;
  wxpusherAppToken?: string;
  lastWechatReminderDate?: string;
  dailyReviewLimit: number;
  speechRate: number;
  targetRetention: 80 | 85 | 90; // P1 调度目标记忆留存率 (80%, 85%, 90%)
  enableFsrs?: boolean; // P1 预留 FSRS 算法开关
  streakFreezes: number; // P0 冻结卡数量 (每月自动发2张)
  streakFreezeProtection: boolean; // 是否自动消耗断签保护
  makeupCards?: number; // 补签印章卡数量
  autoBackupDownload: boolean; // P2 自动下载备份
  lastBackupDate?: string;
}

export interface DailyReminderConfig {
  enabled: boolean;
  reminderTime: string; // e.g. "21:00"
  wxpusherUid: string;
  customAppToken?: string;
  lastNotifiedDate?: string;
}
