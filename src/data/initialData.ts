import { FlashCard, DailyQuest, ShopItem, PracticeScenario, AppSettings } from '../types';

const now = new Date();

export const INITIAL_CARDS: FlashCard[] = [
  {
    id: 'card-1',
    original: '和我一起学习英语吧！',
    natural: "Come learn English with me!",
    colloquial: "Come learn English with me!",
    formal: "Please join me in studying English.",
    variants: {
      casual: "Come learn English with me!",
      formal: "Please join me in studying English."
    },
    redHighlights: ['learn English with me'],
    explanation: "• 「Come learn English with me!」是母语者向朋友发起邀请时最自然热情的口语表达，生动亲切。\n• 书面表达：Please join me in studying English.\n• 欢迎开启 LingoLog 复古打字机英语手账！",
    category: '学习提升',
    tags: ['学习', '英语', '邀请'],
    phrases: [
      {
        phrase: 'learn with',
        pos: '短语',
        meaning: '与…一起学习',
        example: 'Come learn English with me every day.'
      },
      {
        phrase: 'level up',
        pos: '短语',
        meaning: '大幅进阶、提升',
        example: 'Let’s level up our English together.'
      }
    ],
    createdAt: now.toISOString(),
    nextReviewAt: now.toISOString(),
    intervalStage: 0,
    reviewCount: 0,
    masteryLevel: 'learning',
    isFavorite: true,
    userNotes: '欢迎来到 LingoLog！在这里记录你的每一个地道英语表达。',
    readCount: 1,
  }
];

export const PRACTICE_SCENARIOS: PracticeScenario[] = [
  {
    id: 'sc-1',
    tag: '情感表达',
    promptZh: '他这人太有魅力了，',
    subPrompt: 'How would you say it naturally?',
    noteText: 'Type it out.',
    referenceAnswer: "He's got undeniable charisma — pure magnetism in motion."
  },
  {
    id: 'sc-2',
    tag: '职场办公',
    promptZh: '这件事我先记下了，晚点给你答复。',
    subPrompt: 'How to sound proactive & professional?',
    noteText: 'Keep it crisp.',
    referenceAnswer: "I've made a note of this and will circle back with you shortly."
  },
  {
    id: 'sc-3',
    tag: '社交聚会',
    promptZh: '别往心里去，大家都有失误的时候。',
    subPrompt: 'How to comfort a friend gently?',
    noteText: 'Soft tone.',
    referenceAnswer: "Don't beat yourself up over it; we all have off days."
  },
  {
    id: 'sc-4',
    tag: '职场办公',
    promptZh: '别画大饼了，先拿出点实际行动吧。',
    subPrompt: 'Idiomatic & punchy phrase?',
    noteText: 'No fluff.',
    referenceAnswer: "Cut the sweet talk and put your money where your mouth is."
  }
];

export const INITIAL_QUESTS: DailyQuest[] = [
  {
    id: 'quest-learn',
    title: '起草新电报',
    description: '在打字机拍发并归档至少 2 封新电文',
    target: 2,
    current: 0,
    rewardFeathers: 20,
    completed: false,
    claimed: false,
    iconName: 'Keyboard'
  },
  {
    id: 'quest-review',
    title: '艾宾浩斯复审',
    description: '完成今日待核队列中至少 5 封电文复审',
    target: 5,
    current: 0,
    rewardFeathers: 35,
    completed: false,
    claimed: false,
    iconName: 'FileCheck'
  },
  {
    id: 'quest-audio',
    title: '电波播报跟读',
    description: '点击电文朗读播报，跟读发音练习 2 次',
    target: 2,
    current: 0,
    rewardFeathers: 20,
    completed: false,
    claimed: false,
    iconName: 'Volume2'
  },
  {
    id: 'quest-favorite',
    title: '机要重点归档',
    description: '收藏或掌握至少 1 封重点电文卷宗',
    target: 1,
    current: 0,
    rewardFeathers: 15,
    completed: false,
    claimed: false,
    iconName: 'Star'
  }
];

export const INITIAL_SHOP_ITEMS: ShopItem[] = [
  {
    id: 'shop-freeze-card',
    name: '值机免死金牌 (Streak Freeze)',
    description: '增加 1 张冻结卡库存。某天遗漏复习时自动消耗，保护连续值机天数不中断',
    cost: 40,
    iconName: 'Shield',
    category: 'utility',
    owned: false
  },
  {
    id: 'shop-makeup-card',
    name: '热力表补签印章 (Makeup Stamp)',
    description: '修补年度热力图漏签记录。可在年度热力表中点击任意未打卡日直接加盖值机公章',
    cost: 30,
    iconName: 'CalendarCheck',
    category: 'utility',
    owned: false
  },
  {
    id: 'shop-skin-gold',
    name: '皇家金箔打字机 (Royal Gold)',
    description: '解锁华丽金箔铜件打字机。电文起草单标题、金属铭牌与拍发按钮将变为鎏金色',
    cost: 80,
    iconName: 'Sparkles',
    category: 'skin',
    owned: false,
    active: false
  },
  {
    id: 'shop-skin-emerald',
    name: '剑桥墨绿打字机 (Cambridge Emerald)',
    description: '学院风复古英伦墨绿涂装。电文起草单变更为沉稳墨绿与象牙白铭牌',
    cost: 60,
    iconName: 'Palette',
    category: 'skin',
    owned: false,
    active: false
  },
  {
    id: 'shop-skin-midnight',
    name: '极夜黑曜石打字机 (Midnight Obsidian)',
    description: '极简深邃磨砂哑光黑曜石皮肤。暗调金属质感与荧光指示，专为深夜拍发电报打造',
    cost: 60,
    iconName: 'Moon',
    category: 'skin',
    owned: false,
    active: false
  },
  {
    id: 'shop-sound-olympia',
    name: '德产机械打字音效 (Olympia 1960s)',
    description: '沉浸还原 1960s 机械打字机原声。在打字机输入与翻卡时播放金属击打音',
    cost: 50,
    iconName: 'Volume2',
    category: 'sound',
    owned: true,
    active: true
  },
  {
    id: 'shop-sprint-review',
    name: '雷达突击复查券 (Sprint 10 Cards)',
    description: '打破艾宾浩斯等待期，立即抽取 10 封已归档电报开启一场闪电突击核验',
    cost: 25,
    iconName: 'Zap',
    category: 'consumable',
    owned: false
  }
];

export const DEFAULT_SETTINGS: AppSettings = {
  apiProvider: 'deepseek',
  customBaseUrl: '',
  modelName: 'deepseek-v4-flash',
  customApiKey: '',
  apiEnabled: false,
  soundEnabled: true,
  soundVolume: 0.6,
  soundTheme: 'classic',
  typewriterSkin: 'sage',
  themeMode: 'light',
  enableReminders: false,
  reminderTime: '20:30',
  dailyReviewLimit: 10,
  speechRate: 0.95,
  targetRetention: 90,
  streakFreezes: 2,
  streakFreezeProtection: true,
  autoBackupDownload: false,
};
