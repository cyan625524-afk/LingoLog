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
    description: '打字机拍发或从AI助手推送至少 1 封新电文',
    target: 1,
    current: 0,
    rewardFeathers: 20,
    completed: false,
    claimed: false,
    iconName: 'Keyboard'
  },
  {
    id: 'quest-review',
    title: '艾宾浩斯复审',
    description: '完成今日待核队列电文复审',
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
    description: '点击电文朗读播报，跟读发音练习 1 次',
    target: 1,
    current: 0,
    rewardFeathers: 20,
    completed: false,
    claimed: false,
    iconName: 'Volume2'
  },
  {
    id: 'quest-favorite',
    title: '机要重点归档',
    description: '收藏星标电文，或在卷宗库中翻阅精读 1 封电文',
    target: 1,
    current: 0,
    rewardFeathers: 15,
    completed: false,
    claimed: false,
    iconName: 'Star'
  }
];

export const INITIAL_SHOP_ITEMS: ShopItem[] = [
  // 1. 值机保障 (Guarantee)
  {
    id: 'shop-makeup-card',
    name: '热力表补签印章 (Makeup Stamp)',
    description: '修补年度热力图漏签记录。可在年度热力表中点击任意未打卡日直接补发值机电报',
    cost: 30,
    iconName: 'CalendarCheck',
    category: 'guarantee',
    owned: false,
  },
  {
    id: 'shop-freeze-card',
    name: '值机免死金牌 (Streak Freeze)',
    description: '增加 1 张冻结卡库存。某天遗漏复习时自动消耗，保护连续值机天数不中断',
    cost: 40,
    iconName: 'Shield',
    category: 'guarantee',
    owned: false,
  },

  // 2. 机身涂装 (Chassis Skin for Typewriter)
  {
    id: 'shop-chassis-classic',
    name: '经典铸铁打字机 (Classic Iron)',
    description: '初入电讯台标配的经典墨绿铸铁机身，低调扎实，经久耐用',
    cost: 0,
    iconName: 'Palette',
    category: 'chassis',
    owned: true,
    active: true,
  },
  {
    id: 'shop-chassis-emerald',
    name: '剑桥学院墨绿 (Cambridge Emerald)',
    description: '英伦学院风复古墨绿涂装。电文起草单变更为沉稳墨绿机壳与象牙白铭牌',
    cost: 60,
    iconName: 'Palette',
    category: 'chassis',
    owned: false,
    active: false,
  },
  {
    id: 'shop-chassis-midnight',
    name: '极夜黑曜石涂装 (Midnight Obsidian)',
    description: '极简深邃磨砂哑光黑曜石机身。暗调金属质感与荧光指示，专为深夜拍发电报打造',
    cost: 60,
    iconName: 'Moon',
    category: 'chassis',
    owned: false,
    active: false,
  },
  {
    id: 'shop-chassis-gold',
    name: '皇家金箔打字机 (Royal Gold)',
    description: '华丽金箔铜件打字机。电文起草单标题、金属铭牌与拍发按钮变为鎏金尊贵质感',
    cost: 80,
    iconName: 'Sparkles',
    category: 'chassis',
    owned: false,
    active: false,
  },

  // 3. 页面皮肤 (Full Webpage Global Theme)
  {
    id: 'shop-theme-vintage',
    name: '经典复古风 (Classic Vintage)',
    description: '默认复古电报风。全站沉浸式墨绿铸铁底板、暖黄羊皮信纸与黄铜金点缀',
    cost: 0,
    iconName: 'Layout',
    category: 'theme',
    owned: true,
    active: true,
  },
  {
    id: 'shop-theme-cyber',
    name: '暗夜极客风 (Cyber Neon)',
    description: '赛博极夜终端风格。全站切换为深邃黑客底色、暗蓝卡片与电光荧绿按键',
    cost: 70,
    iconName: 'Terminal',
    category: 'theme',
    owned: false,
    active: false,
  },
  {
    id: 'shop-theme-sunlight',
    name: '法式晨曦风 (Warm Sunlight)',
    description: '巴黎晨光柔美格调。全站切换为温暖奶油晨光底色、柔和浅褐与暖杏焦糖金',
    cost: 70,
    iconName: 'Sun',
    category: 'theme',
    owned: false,
    active: false,
  },
  {
    id: 'shop-theme-ocean',
    name: '深海监听风 (Deep Oceanic)',
    description: '潜艇深海监听战术风格。全站切换为深邃冷海暗蓝、潜艇舱板与冰川荧光蓝',
    cost: 70,
    iconName: 'Radio',
    category: 'theme',
    owned: false,
    active: false,
  },
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
  typewriterSkin: 'classic',
  pageTheme: 'vintage',
  themeMode: 'light',
  enableReminders: false,
  reminderTime: '20:30',
  dailyReviewLimit: 10,
  speechRate: 0.95,
  targetRetention: 90,
  streakFreezes: 2,
  streakFreezeProtection: true,
  makeupCards: 1,
  autoBackupDownload: false,
};
