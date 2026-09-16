import { FlashCard, DailyQuest, ShopItem, PracticeScenario, AppSettings } from '../types';

const now = new Date();

// Create past dates for overdue cards
const daysAgo104 = new Date(now.getTime() - 104 * 24 * 60 * 60 * 1000).toISOString();
const daysAgo107 = new Date(now.getTime() - 107 * 24 * 60 * 60 * 1000).toISOString();
const daysAgo5 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();

export const INITIAL_CARDS: FlashCard[] = [
  {
    id: 'card-1',
    original: '一不小心又熬到很晚了……',
    natural: "I ended up staying up way past my bedtime again...",
    colloquial: "I totally lost track of time and pulled another late one.",
    formal: "I unintentionally stayed awake until late hours again.",
    variants: {
      casual: "Pulled another all-nighter without even realizing it.",
      neutral: "I ended up staying up way past my bedtime again...",
      formal: "I unintentionally stayed awake past my scheduled bedtime."
    },
    redHighlights: ['staying up way past my bedtime'],
    explanation: "• stay up way past one's bedtime 极具自嘲幽默感，比 sleep late 更地道生动地表达明知该睡却没睡。\n• 同义表达：pull a late one（熬夜）。",
    category: '日常家务',
    tags: ['熬夜', '作息'],
    phrases: [
      {
        phrase: 'lose track of time',
        pos: '短语',
        meaning: '忘记了时间、不知不觉时间飞逝',
        example: 'Sorry I am late, I completely lost track of time.'
      },
      {
        phrase: 'stay up late',
        pos: '短语',
        meaning: '熬夜，很晚才睡',
        example: 'Don’t stay up too late before an exam.'
      }
    ],
    createdAt: daysAgo104,
    nextReviewAt: daysAgo104,
    intervalStage: 0,
    reviewCount: 1,
    masteryLevel: 'uncertain',
    isFavorite: true,
    userNotes: '特别适合用来发朋友圈或者在聊天里吐槽熬夜。',
    readCount: 12,
  },
  {
    id: 'card-2',
    original: '好几天没洗袜子了',
    natural: "I've let my dirty socks pile up for days.",
    colloquial: "Haven't done my sock laundry in forever.",
    formal: "I have accumulated unwashed socks over the past few days.",
    variants: {
      casual: "Socks are piling up like crazy.",
      neutral: "I've let my dirty socks pile up for days.",
      formal: "Laundry of unwashed garments has accumulated over several days."
    },
    redHighlights: ['pile up for days'],
    explanation: "• let sth pile up 生动描绘杂事堆积成山的画面，比单纯直译 haven't washed 更生活化。\n• 常用短语：pile up（堆积如山）。",
    category: '日常家务',
    tags: ['家务', '衣物'],
    phrases: [
      {
        phrase: 'pile up',
        pos: '短语动词',
        meaning: '堆积如山、积压未处理',
        example: 'Work has been piling up since Monday.'
      },
      {
        phrase: 'in forever',
        pos: '副词/俚语',
        meaning: '好久好久、很久没做某事',
        example: 'I haven’t done laundry in forever.'
      }
    ],
    createdAt: daysAgo107,
    nextReviewAt: daysAgo107,
    intervalStage: 0,
    reviewCount: 0,
    masteryLevel: 'learning',
    isFavorite: false,
    readCount: 4,
  },
  {
    id: 'card-3',
    original: '头好痛啊啊啊',
    natural: "My head is pounding like crazy!",
    colloquial: "I've got a killer headache.",
    formal: "I am experiencing severe cephalalgia.",
    variants: {
      casual: "My head is throbbing so hard.",
      neutral: "My head is pounding like crazy!",
      formal: "I am afflicted with an intense cranial discomfort."
    },
    redHighlights: ['pounding like crazy'],
    explanation: "• pounding 拟声感极强，形象传递头部如重锤击打的跳痛；like crazy 极大地强化了口语情绪。\n• 同义表达：killer headache（剧烈头疼）。",
    category: '饮食健康',
    tags: ['头痛', '病症'],
    phrases: [
      {
        phrase: 'pounding headache',
        pos: '短语',
        meaning: '剧烈跳痛的偏头痛',
        example: 'The loud music gave me a pounding headache.'
      },
      {
        phrase: 'like crazy',
        pos: '副词短语',
        meaning: '极其厉害地、疯狂地',
        example: 'My head was pounding like crazy.'
      }
    ],
    createdAt: daysAgo107,
    nextReviewAt: daysAgo107,
    intervalStage: 1,
    reviewCount: 2,
    masteryLevel: 'learning',
    isFavorite: false,
    readCount: 7,
  },
  {
    id: 'card-4',
    original: '好开心,第一个网站要做出来了',
    natural: "I'm thrilled that my very first website is coming together!",
    colloquial: "Super hyped—my first site is finally going live!",
    formal: "I am delighted to witness the successful completion of my inaugural web project.",
    variants: {
      casual: "So pumped! My first site is practically done!",
      neutral: "I'm thrilled that my very first website is coming together!",
      formal: "I am pleased to observe the convergence of my web development endeavor."
    },
    redHighlights: ['coming together'],
    explanation: "• come together 传达出项目从零碎模块逐步拼合完整、渐入佳境的欣喜成就感。\n• 同义词组：go live（正式上线）。",
    category: '科技生活',
    tags: ['编程', '网站'],
    phrases: [
      {
        phrase: 'come together',
        pos: '短语动词',
        meaning: '成型、齐备、圆满收官',
        example: 'All the pieces of the plan are coming together nicely.'
      },
      {
        phrase: 'go live',
        pos: '短语',
        meaning: '系统/网站正式上线运行',
        example: 'Our new mobile app will go live next Tuesday.'
      }
    ],
    createdAt: daysAgo107,
    nextReviewAt: daysAgo107,
    intervalStage: 2,
    reviewCount: 3,
    masteryLevel: 'mastered',
    isFavorite: true,
    userNotes: '写完 LingoLog 时的心情！',
    readCount: 15,
  },
  {
    id: 'card-5',
    original: '他这人太有魅力了，简直是行走的荷尔蒙。',
    natural: "He's got undeniable charisma — pure magnetism in motion.",
    colloquial: "He's a total heartthrob, dripping with confidence.",
    formal: "He possesses an exceptionally captivating aura and magnetic presence.",
    variants: {
      casual: "He just oozes confidence everywhere he walks.",
      neutral: "He's got undeniable charisma — pure magnetism in motion.",
      formal: "His charisma and dynamic persona are thoroughly impressive."
    },
    redHighlights: ['magnetism in motion'],
    explanation: "• magnetism in motion 将抽象荷尔蒙化作流动的磁场，极富视觉美感与地道张力。\n• 常用词汇：heartthrob（万人迷）。",
    category: '情感表达',
    tags: ['魅力', '气质'],
    phrases: [
      {
        phrase: 'charisma',
        pos: 'n.',
        meaning: '个人魅力、感召力、领袖气质',
        example: 'She has real stage charisma that captivates audiences.'
      },
      {
        phrase: 'magnetism',
        pos: 'n.',
        meaning: '磁性般的吸引力、诱惑力',
        example: 'He had the magnetism of a born leader.'
      }
    ],
    createdAt: daysAgo5,
    nextReviewAt: now.toISOString(),
    intervalStage: 1,
    reviewCount: 1,
    masteryLevel: 'uncertain',
    isFavorite: true,
    readCount: 20,
  },
  {
    id: 'card-6',
    original: '今天上班差点迟到，还好赶上了地铁。',
    natural: "I almost clocked in late today, but caught the train just in the nick of time.",
    colloquial: "Nearly missed work today, made the subway by the skin of my teeth!",
    formal: "I narrowly avoided tardiness at work by punctually catching the transit.",
    variants: {
      casual: "Almost late for work, barely made the train!",
      neutral: "I almost clocked in late today, but caught the train just in the nick of time.",
      formal: "I arrived punctually despite near transit delays."
    },
    redHighlights: ['just in the nick of time'],
    explanation: "• in the nick of time 意为千钧一发之际刚好赶上，clock in 是地道的打卡上班。\n• 同义表达：by the skin of my teeth（勉强赶上）。",
    category: '职场办公',
    tags: ['通勤', '打卡'],
    phrases: [
      {
        phrase: 'in the nick of time',
        pos: '成语',
        meaning: '在紧要关头、刚好来得及',
        example: 'The ambulance arrived in the nick of time.'
      },
      {
        phrase: 'by the skin of one’s teeth',
        pos: '成语',
        meaning: '死里逃生、侥幸、勉强做成',
        example: 'He passed the driving test by the skin of his teeth.'
      }
    ],
    createdAt: now.toISOString(),
    nextReviewAt: now.toISOString(),
    intervalStage: 0,
    reviewCount: 0,
    masteryLevel: 'learning',
    isFavorite: false,
    readCount: 8,
  },
  {
    id: 'card-7',
    original: '这件事我先记下了，晚点给你答复。',
    natural: "I've made a note of this and will circle back with you shortly.",
    colloquial: "Got it down—I'll get back to you in a bit.",
    formal: "I have recorded your inquiry and will furnish a formal response shortly.",
    variants: {
      casual: "On it! I'll ping you as soon as I check.",
      neutral: "I've made a note of this and will circle back with you shortly.",
      formal: "I will review the matter thoroughly and revert with findings."
    },
    redHighlights: ['circle back with you'],
    explanation: "• circle back 职场极高频地道动词短语，比简单 reply 更显主动跟进的态度。\n• 同义词组：touch base（碰头沟通）。",
    category: '职场办公',
    tags: ['跟进', '回复'],
    phrases: [
      {
        phrase: 'circle back',
        pos: '短语动词',
        meaning: '稍后回访、回头再讨论',
        example: 'Let me look into the data and circle back this afternoon.'
      }
    ],
    createdAt: daysAgo5,
    nextReviewAt: now.toISOString(),
    intervalStage: 1,
    reviewCount: 1,
    masteryLevel: 'uncertain',
    isFavorite: false,
    readCount: 5,
  },
  {
    id: 'card-8',
    original: '别往心里去，大家都有失误的时候。',
    natural: "Don't beat yourself up over it; we all have off days.",
    colloquial: "Shake it off, everyone messes up once in a while.",
    formal: "Please do not burden yourself with remorse; occasional setbacks are universal.",
    variants: {
      casual: "Don't sweat it, you're only human!",
      neutral: "Don't beat yourself up over it; we all have off days.",
      formal: "Please refrain from excessive self-criticism regarding this oversight."
    },
    redHighlights: ['beat yourself up over it'],
    explanation: "• beat oneself up 指过分自责，off day 指状态欠佳、诸事不顺的一天。\n• 同义表达：don't sweat it（别放在心上）。",
    category: '社交聚会',
    tags: ['安慰', '心态'],
    phrases: [
      {
        phrase: 'beat oneself up',
        pos: '短语',
        meaning: '自责、苛求自己',
        example: "Don't beat yourself up, it wasn't your fault."
      },
      {
        phrase: 'off day',
        pos: '名词短语',
        meaning: '不在状态的一天',
        example: 'He just had an off day on the court.'
      }
    ],
    createdAt: daysAgo104,
    nextReviewAt: now.toISOString(),
    intervalStage: 0,
    reviewCount: 0,
    masteryLevel: 'learning',
    isFavorite: true,
    readCount: 9,
  },
  {
    id: 'card-9',
    original: '我今天真的累瘫了，只想躺平。',
    natural: "I'm completely drained today, just want to veg out on the couch.",
    colloquial: "Totally wiped out, just gonna be a couch potato.",
    formal: "I am thoroughly fatigued and require restorative relaxation.",
    variants: {
      casual: "I'm dead tired, gonna do absolutely nothing tonight.",
      neutral: "I'm completely drained today, just want to veg out on the couch.",
      formal: "I have exhausted my mental reserves and must rest."
    },
    redHighlights: ['veg out on the couch'],
    explanation: "• veg out（像植物一样放空躺平）非常形象惬意；drained 比 tired 更深刻表达精力被掏空的感觉。",
    category: '日常家务',
    tags: ['放松', '休息'],
    phrases: [
      {
        phrase: 'veg out',
        pos: '动词短语',
        meaning: '发呆放松、无所事事地躺着',
        example: 'I spent the whole Sunday vegging out in front of the TV.'
      }
    ],
    createdAt: daysAgo5,
    nextReviewAt: now.toISOString(),
    intervalStage: 1,
    reviewCount: 2,
    masteryLevel: 'learning',
    isFavorite: false,
    readCount: 11,
  },
  {
    id: 'card-10',
    original: '别画大饼了，先拿出点实际行动吧。',
    natural: "Cut the sweet talk and put your money where your mouth is.",
    colloquial: "Stop making empty promises and show me real results.",
    formal: "I encourage concrete demonstration rather than speculative assurances.",
    variants: {
      casual: "Less talk, more action, let's see it!",
      neutral: "Cut the sweet talk and put your money where your mouth is.",
      formal: "Substantive execution must precede further projections."
    },
    redHighlights: ['put your money where your mouth is'],
    explanation: "• put your money where your mouth is 是经典英语谚语，意为用实际行动/真金白银兑现诺言。",
    category: '职场办公',
    tags: ['行动', '承诺'],
    phrases: [
      {
        phrase: 'put one’s money where one’s mouth is',
        pos: '成语',
        meaning: '言出必行、用行动证明',
        example: 'If you think the idea works, put your money where your mouth is.'
      }
    ],
    createdAt: now.toISOString(),
    nextReviewAt: now.toISOString(),
    intervalStage: 0,
    reviewCount: 0,
    masteryLevel: 'learning',
    isFavorite: false,
    readCount: 6,
  },
  {
    id: 'card-11',
    original: '这道菜太好吃了，简直惊艳到我了。',
    natural: "This dish is absolutely divine — it blew my mind!",
    colloquial: "This food hits the spot so good, totally out of this world.",
    formal: "The culinary composition of this dish is exceptionally exquisite.",
    variants: {
      casual: "This is insanely good, 10 out of 10!",
      neutral: "This dish is absolutely divine — it blew my mind!",
      formal: "The gastronomic qualities of this preparation are remarkable."
    },
    redHighlights: ['blew my mind'],
    explanation: "• blow one's mind 形容令人震撼惊艳；divine 在美食评价中代表极品美味。",
    category: '饮食健康',
    tags: ['美食', '评价'],
    phrases: [
      {
        phrase: 'blow one’s mind',
        pos: '动词短语',
        meaning: '令人震撼、使人惊叹',
        example: 'The finale of the movie completely blew my mind.'
      }
    ],
    createdAt: now.toISOString(),
    nextReviewAt: now.toISOString(),
    intervalStage: 0,
    reviewCount: 0,
    masteryLevel: 'learning',
    isFavorite: true,
    readCount: 4,
  },
  {
    id: 'card-12',
    original: '我得买杯冰美式续个命。',
    natural: "I desperately need an iced Americano to jumpstart my brain.",
    colloquial: "Need an iced coffee stat or I won't survive today.",
    formal: "I require a chilled caffeinated beverage for cognitive revival.",
    variants: {
      casual: "Running on empty, need cold brew ASAP.",
      neutral: "I desperately need an iced Americano to jumpstart my brain.",
      formal: "Caffeine intake is required to sustain productivity."
    },
    redHighlights: ['jumpstart my brain'],
    explanation: "• jumpstart 比喻像给汽车电瓶搭电一样迅速启动大脑活力，非常生动俏皮。",
    category: '饮食健康',
    tags: ['咖啡', '提神'],
    phrases: [
      {
        phrase: 'jumpstart',
        pos: 'v.',
        meaning: '激发活力、启动、重启',
        example: 'A quick morning run can jumpstart your metabolism.'
      }
    ],
    createdAt: now.toISOString(),
    nextReviewAt: now.toISOString(),
    intervalStage: 0,
    reviewCount: 0,
    masteryLevel: 'learning',
    isFavorite: false,
    readCount: 5,
  },
  {
    id: 'card-13',
    original: '这件衣服虽然贵，但版型质感真的很值。',
    natural: "It's a bit of a splurge, but the tailored fit is worth every penny.",
    colloquial: "Pricey, but the quality speaks for itself.",
    formal: "While an investment, the craftsmanship and silhouette justify the cost.",
    variants: {
      casual: "Cost a pretty penny, but looks so good on me!",
      neutral: "It's a bit of a splurge, but the tailored fit is worth every penny.",
      formal: "The premium craftsmanship warrants the financial expenditure."
    },
    redHighlights: ['worth every penny'],
    explanation: "• a splurge 指偶尔犒劳自己的轻奢消费；worth every penny 意为每一分钱都花在刀刃上。",
    category: '购物消费',
    tags: ['穿搭', '消费'],
    phrases: [
      {
        phrase: 'worth every penny',
        pos: '成语',
        meaning: '非常值得每一分钱',
        example: 'That noise-canceling headphone was worth every penny.'
      }
    ],
    createdAt: now.toISOString(),
    nextReviewAt: now.toISOString(),
    intervalStage: 0,
    reviewCount: 0,
    masteryLevel: 'learning',
    isFavorite: false,
    readCount: 3,
  },
  {
    id: 'card-14',
    original: '我正在努力克服社恐，多走出舒适圈。',
    natural: "I'm actively pushing past my social anxiety and stepping out of my comfort zone.",
    colloquial: "Working on being less introverted and putting myself out there.",
    formal: "I am deliberately addressing interpersonal apprehension to broaden my horizons.",
    variants: {
      casual: "Trying hard not to be awkward and meet more folks.",
      neutral: "I'm actively pushing past my social anxiety and stepping out of my comfort zone.",
      formal: "I endeavor to transcend psychological reservations in collaborative environments."
    },
    redHighlights: ['stepping out of my comfort zone'],
    explanation: "• step out of one's comfort zone 走出舒适圈，push past 克服困难向前迈进。",
    category: '学习提升',
    tags: ['成长', '社交'],
    phrases: [
      {
        phrase: 'step out of one’s comfort zone',
        pos: '短语',
        meaning: '迈出舒适区、挑战自我',
        example: 'Growth happens when you step out of your comfort zone.'
      }
    ],
    createdAt: now.toISOString(),
    nextReviewAt: now.toISOString(),
    intervalStage: 0,
    reviewCount: 0,
    masteryLevel: 'learning',
    isFavorite: true,
    readCount: 14,
  },
  {
    id: 'card-15',
    original: '这里的风景简直绝了，随手一拍就是大片。',
    natural: "The scenery here is breathtaking — every snap looks straight out of a magazine.",
    colloquial: "Unreal views! Every photo is instant postcard material.",
    formal: "The picturesque vista provides exceptional photographic aesthetics.",
    variants: {
      casual: "Insane views here, total photo gold!",
      neutral: "The scenery here is breathtaking — every snap looks straight out of a magazine.",
      formal: "The panoramic landscape affords peerless visual magnificence."
    },
    redHighlights: ['straight out of a magazine'],
    explanation: "• breathtaking 形容美得令人屏息；straight out of a magazine 极赞构图与意境像时尚大片。",
    category: '出行旅游',
    tags: ['风景', '摄影'],
    phrases: [
      {
        phrase: 'straight out of',
        pos: '短语',
        meaning: '宛如出自…、活脱脱就像…',
        example: 'The castle looked straight out of a fairytale.'
      }
    ],
    createdAt: now.toISOString(),
    nextReviewAt: now.toISOString(),
    intervalStage: 0,
    reviewCount: 0,
    masteryLevel: 'learning',
    isFavorite: true,
    readCount: 16,
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
