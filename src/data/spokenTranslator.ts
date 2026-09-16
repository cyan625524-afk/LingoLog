import { FlashCard, CardCategory, PhraseItem, RegisterVariants } from '../types';
import { findInspirationMatch, inspirationToOptimizationResult } from './inspirationData';

export interface SpokenOptimizationResult {
  original: string;
  natural: string;
  category: CardCategory;
  tags: string[];
  explanation: string;
  phrases: PhraseItem[];
  variants?: RegisterVariants;
  redHighlights?: string[];
  /**
   * 这条结果有多可信：
   * - 'exact'：灵感库 / 精确词条命中，或输入本身就是英文。可以当答案学。
   * - 'topic'：只命中了「主题关键词」规则，句子是按主题模板写死的，
   *            和原句不是逐句对应 —— 只能当灵感，不能当翻译。
   *
   * 词库完全没有这条时，translateSpokenInput 直接返回 null，不再编句子。
   */
  confidence?: 'exact' | 'topic';
}

// 10 Mandatory Categories
export const ALLOWED_CATEGORIES: CardCategory[] = [
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

interface DictEntry {
  exactKeywords: string[];
  natural: string;
  category: CardCategory;
  tags: string[];
  explanation: string;
  phrase: PhraseItem;
}

// High-fidelity spoken dictionary for exact or near-exact high-frequency colloquial phrases
export const SPOKEN_EXPRESSIONS_DICT: DictEntry[] = [
  {
    exactKeywords: ['这件事交给我', '交给我吧', '包在我身上', '交给我处理', '交给我来', '交给我做', '我来搞定'],
    natural: "I've got this.",
    category: '职场办公',
    tags: ['承揽', '承诺', '职场'],
    explanation: '• 「I\'ve got this」是母语者在主动承担责任或接手任务时极高频的自信表达，比机械直译的「Give this to me」更具担当感。\n• 日常闲聊中也可表达为「I\'m on it」，意为「我已经在着手处理了」。',
    phrase: {
      phrase: "I'm on it",
      pos: '短语',
      meaning: '交给我、我马上办',
      example: "Don't worry about the task; I'm on it.",
    },
  },
  {
    exactKeywords: ['我马上就到', '在路上了', '马上过来', '快到了', '我正在过去'],
    natural: "I'm on my way.",
    category: '出行旅游',
    tags: ['通勤', '出行', '聚会'],
    explanation: '• 「I\'m on my way」是母语者表示出发或正在赶路的最自然说法，避免中文式直译「I will arrive soon」。\n• 距离极近时可口语化说「I\'m two minutes out」。',
    phrase: {
      phrase: 'minutes out',
      pos: '短语',
      meaning: '还有几分钟到达',
      example: "Almost there, I'm five minutes out.",
    },
  },
  {
    exactKeywords: ['随便你', '你说了算', '看你心情', '由你决定', '听你的'],
    natural: "It's your call.",
    category: '社交聚会',
    tags: ['抉择', '沟通', '日常'],
    explanation: '• 「It\'s your call」将决定权完全交给对方，语气轻松随和，比生硬的「Whatever you want」更有礼貌与情商。\n• 闲聊时亦常用「Up to you」。',
    phrase: {
      phrase: 'make the call',
      pos: '短语',
      meaning: '做决定、拍板',
      example: 'You know the situation best, so you make the call.',
    },
  },
  {
    exactKeywords: ['改天再约', '下次吧', '改期', '找机会再聚', '改天吧'],
    natural: "Let's take a rain check.",
    category: '社交聚会',
    tags: ['邀约', '聚餐', '社交'],
    explanation: '• 「Take a rain check」源自棒球赛因雨延期的换票习惯，现已成为委婉改期、下次再聚的最地道俚语。\n• 既委婉拒绝了当下的邀请，又表达了未来依然想相聚的诚意。',
    phrase: {
      phrase: 'rain check',
      pos: '名词',
      meaning: '改天、延期的邀请',
      example: 'Can I take a rain check on dinner tonight?',
    },
  },
  {
    exactKeywords: ['开门见山', '直奔主题', '别绕弯子', '直接说重点', '说正事吧'],
    natural: "Let's cut to the chase.",
    category: '职场办公',
    tags: ['会议', '效率', '沟通'],
    explanation: '• 「Cut to the chase」源于早期电影剪辑直接切入追逐高潮，是要求快速切入核心议题的最生动表达。\n• 避免冗长的背景介绍，符合当代快节奏沟通习惯。',
    phrase: {
      phrase: 'bottom line',
      pos: '名词',
      meaning: '核心要点、底线',
      example: 'What is the bottom line here?',
    },
  },
  {
    exactKeywords: ['别放在心上', '不用客气', '小事一桩', '不值一提', '没多大事'],
    natural: "Don't sweat it.",
    category: '情感表达',
    tags: ['安慰', '心态', '日常'],
    explanation: '• 「Don\'t sweat it」形象地表达「不用为此流汗焦虑」，是年轻人安慰朋友放下顾虑或宽慰他人的超高频口语。\n• 比正式的「You\'re welcome」更显亲近无拘束。',
    phrase: {
      phrase: 'no biggie',
      pos: '短语',
      meaning: '小事一桩、不打紧',
      example: "Lost the pen? No biggie, I have plenty.",
    },
  },
  {
    exactKeywords: ['我今天打算在家里摆烂', '在家里摆烂', '今天打算摆烂', '只想躺平', '在家里躺一天'],
    natural: "I'm just gonna stay home and rot today.",
    category: '日常家务',
    tags: ['独处', '休息', '日常'],
    explanation: '• 「Rot」或「bed-rotting」是当代极火的年轻人俚语，自嘲式指代躺平彻底放松。\n• 表达拒绝外界干扰、沉浸在极度放松中的心境。',
    phrase: {
      phrase: 'vegetable out',
      pos: '短语',
      meaning: '像植物一样瘫着放空',
      example: 'I just want to vegetable out on the sofa.',
    },
  },
  {
    exactKeywords: ['这不关我的事', '少管闲事', '与我无关', '别扯上我'],
    natural: "That's none of my business.",
    category: '日常家务',
    tags: ['界限', '社交', '日常'],
    explanation: '• 「None of my business」明确划定个人边界，不卷入无关纠纷。\n• 幽默俚语中亦常调侃「Not my circus, not my monkeys」。',
    phrase: {
      phrase: 'steer clear',
      pos: '短语',
      meaning: '避开、不插手',
      example: "I'd steer clear of that drama if I were you.",
    },
  },
  {
    exactKeywords: ['我们各付各的吧', 'AA制', '分开付', '各买各的', '平摊费用'],
    natural: "Let's split the bill.",
    category: '购物消费',
    tags: ['买单', '聚餐', '消费'],
    explanation: '• 「Split the bill」或「Go Dutch」是就餐结账时最自然地道的AA制提议。\n• 现代年轻人闲聊更倾向于直接说「Let\'s split it」。',
    phrase: {
      phrase: 'go Dutch',
      pos: '短语',
      meaning: '平摊费用、各付各账',
      example: 'Shall we go Dutch on the meal?',
    },
  },
  {
    exactKeywords: ['我赞同你的看法', '完全同意', '深有同感', '我也这么觉得', '英雄所见略同'],
    natural: "I'm totally with you on that.",
    category: '情感表达',
    tags: ['共鸣', '赞同', '交流'],
    explanation: '• 「I\'m with you on that」比单纯的「I agree」更有并肩作战与情感共鸣的温度。\n• 闲聊中亦常用「I feel you」表达同理心。',
    phrase: {
      phrase: 'feel you',
      pos: '短语',
      meaning: '感同身受、懂你的感受',
      example: 'I feel you, work has been crazy lately.',
    },
  },
  {
    exactKeywords: ['加油', '坚持住', '别放弃', '撑住', '坚持下去'],
    natural: "Hang in there.",
    category: '学习提升',
    tags: ['励志', '坚持', '鼓励'],
    explanation: '• 「Hang in there」是面对困难时最温暖有力的鼓励，避免中式直译「Add oil」。\n• 强调在逆境中咬牙坚持到底的韧劲。',
    phrase: {
      phrase: 'keep it up',
      pos: '短语',
      meaning: '继续保持、做得很好',
      example: "Great progress, keep it up!",
    },
  },
  {
    exactKeywords: ['我吃饱了', '吃得太撑了', '吃不下了', '肚子好饱', '撑死了'],
    natural: "I'm officially in a food coma.",
    category: '饮食健康',
    tags: ['美食', '就餐', '健康'],
    explanation: '• 「Food coma」形容饱餐后血液流向胃部产生的满足困倦感，比平淡的「I\'m full」生动许多。\n• 亦可直接说「I\'m stuffed」。',
    phrase: {
      phrase: 'stuffed to the gills',
      pos: '短语',
      meaning: '撑到嗓子眼、极饱',
      example: 'That buffet got me stuffed to the gills.',
    },
  },
  {
    exactKeywords: ['忍不住剁手', '冲动消费', '拔草', '买买买', '犒劳一下自己'],
    natural: "I had to treat myself.",
    category: '购物消费',
    tags: ['网购', '犒劳', '消费'],
    explanation: '• 「Treat myself」是当代年轻人自我犒劳、买心仪之物时的经典口头禅。\n• 带有积极的生活愉悦感与自爱态度。',
    phrase: {
      phrase: 'splurge on',
      pos: '短语',
      meaning: '挥霍、大手笔购买',
      example: 'I decided to splurge on a new keyboard.',
    },
  },
  {
    exactKeywords: ['我们想到一块去了', '心有灵犀', '不谋而合'],
    natural: "Great minds think alike.",
    category: '社交聚会',
    tags: ['默契', '沟通', '讨论'],
    explanation: '• 「Great minds think alike」是朋友或同事提出相同绝妙想法时的幽默调侃，拉近彼此距离。\n• 充满机智风趣的交流氛围。',
    phrase: {
      phrase: 'on the same page',
      pos: '短语',
      meaning: '达成共识、步调一致',
      example: "Glad we're on the same page.",
    },
  },
];

// Helper to sanitize tags strictly to 2-character nouns
export function sanitizeTwoCharNounTags(rawTags: string[]): string[] {
  const defaultTags = ['口语', '表达'];
  if (!rawTags || !rawTags.length) return defaultTags;

  const valid = rawTags
    .map((t) => t.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, '').trim())
    .filter(Boolean)
    .map((t) => (t.length >= 2 ? t.slice(0, 2) : `${t}语`))
    .slice(0, 3);

  return valid.length > 0 ? valid : defaultTags;
}

// Semantic Sentence Composition Rules for Arbitrary Chinese Input
interface RulePattern {
  matcher: (text: string) => boolean;
  generate: (text: string) => SpokenOptimizationResult;
}

const SEMANTIC_PATTERNS: RulePattern[] = [
  // 1. AI Chat / Conversation
  {
    matcher: (t) =>
      (t.toLowerCase().includes('ai') || t.includes('人工智能') || t.includes('机器人')) &&
      (t.includes('聊') || t.includes('说') || t.includes('问') || t.includes('对话')),
    generate: (t) => {
      const hasBlank = t.includes('不知道') || t.includes('没想好') || t.includes('聊些什么') || t.includes('说什么');
      const natural = hasBlank
        ? "I wanna chat with AI, but I'm completely drawing a blank on what to talk about."
        : "I'm just having a casual chat with AI to pass the time.";
      return {
        original: t,
        natural,
        category: '科技生活',
        tags: ['智能', '对话', '数码'],
        explanation: '• 「Drawing a blank」是母语者表达大脑一片空白、一时想不起或不知该说什么时的极高频地道口语。\n• 「Chat with AI」是与人工智能交流的最自然表达，语气轻松无拘束。',
        phrases: [
          {
            phrase: 'draw a blank',
            pos: '短语',
            meaning: '脑中一片空白、毫无头绪',
            example: "I wanted to ask something, but I completely drew a blank.",
          },
        ],
      };
    },
  },
  // 2. Chatting / Not knowing what to say in general
  {
    matcher: (t) =>
      (t.includes('不知道聊') || t.includes('不知道说') || t.includes('没话说') || t.includes('尬聊') || t.includes('冷场')),
    generate: (t) => ({
      original: t,
      natural: "I'm totally running out of things to say; the silence is getting awkward.",
      category: '社交聚会',
      tags: ['沟通', '社交', '对话'],
      explanation: '• 「Run out of things to say」表达词穷或不知道聊什么，符合年轻人口语日常。\n• 描述尴尬冷场常用「awkward silence」。',
      phrases: [
        {
          phrase: 'run out of',
          pos: '短语',
          meaning: '用尽、耗尽（话题/精力）',
          example: "I've run out of topics to chat about.",
        },
      ],
    }),
  },
  // 3. Learning English / Skill Acquisition
  {
    matcher: (t) =>
      (t.includes('英语') || t.includes('口语') || t.includes('学') || t.includes('背单词')) &&
      (t.includes('想') || t.includes('提升') || t.includes('练') || t.includes('坚持')),
    generate: (t) => ({
      original: t,
      natural: "I really want to level up my spoken English and sound more natural.",
      category: '学习提升',
      tags: ['口语', '进阶', '成长'],
      explanation: '• 「Level up」借用游戏升级概念，在母语年轻人中广泛用于形容技能提升与突破。\n• 「Sound natural」表达口语地道流畅的标准说法。',
      phrases: [
        {
          phrase: 'level up',
          pos: '短语',
          meaning: '大幅提升、进阶升级',
          example: 'Daily practice helps you level up your communication skills.',
        },
      ],
    }),
  },
  // 4. Coffee / Drinks / Food Hangout
  {
    matcher: (t) =>
      (t.includes('咖啡') || t.includes('奶茶') || t.includes('喝一杯') || t.includes('吃点东西')) &&
      (t.includes('想') || t.includes('去') || t.includes('约') || t.includes('买')),
    generate: (t) => ({
      original: t,
      natural: "I'm craving a coffee run to get through the rest of the day.",
      category: '饮食健康',
      tags: ['咖啡', '就餐', '日常'],
      explanation: '• 「Coffee run」指中途快速去买杯咖啡充能，是现代职场与校园生活不可或缺的口头短语。\n• 「Get through the day」意为支撑度过一天。',
      phrases: [
        {
          phrase: 'coffee run',
          pos: '名词短语',
          meaning: '买咖啡的小跑一趟',
          example: 'Anyone want to join me for a quick coffee run?',
        },
      ],
    }),
  },
  // 5. Tech devices / Lagging / Frozen
  {
    matcher: (t) =>
      (t.includes('电脑') || t.includes('手机') || t.includes('软件') || t.includes('网页') || t.includes('系统')) &&
      (t.includes('卡') || t.includes('死机') || t.includes('崩') || t.includes('慢') || t.includes('闪退')),
    generate: (t) => ({
      original: t,
      natural: "My screen is totally frozen; it's lagging so badly right now.",
      category: '科技生活',
      tags: ['数码', '卡顿', '故障'],
      explanation: '• 「Lagging」与「frozen」是描述数码设备卡顿、画面定格最标准的当代口语词汇。\n• 遇到软件彻底崩溃可用「It crashed on me」。',
      phrases: [
        {
          phrase: 'lag so badly',
          pos: '短语',
          meaning: '严重卡顿、延迟极高',
          example: 'My laptop is lagging so badly after the update.',
        },
      ],
    }),
  },
  // 5b. Phone Battery / Charging / Low Battery
  {
    matcher: (t) =>
      (t.includes('充电') || t.includes('没电') || t.includes('只剩') || t.includes('电量') || t.includes('1%') || t.includes('电池')) &&
      (t.includes('手机') || t.includes('充') || t.includes('电') || t.includes('设备')),
    generate: (t) => ({
      original: t,
      natural: "I gotta plug my phone in right away, my battery is literally at 1%.",
      category: '科技生活',
      tags: ['数码', '充电', '电量'],
      explanation: '• 「Plug in」是母语者给手机接电源充电最地道鲜活的动作表达，比生硬直译 charge 更具现场感。\n• 「My battery is literally at 1%」是极具年轻人口语张力的低电量警报表达。',
      phrases: [
        {
          phrase: 'plug in',
          pos: '动词短语',
          meaning: '插上电源（充电）',
          example: 'Let me find an outlet to plug my phone in.',
        },
        {
          phrase: 'be down to',
          pos: '短语',
          meaning: '降低至、只剩下',
          example: 'My phone is down to five percent.',
        },
      ],
    }),
  },
  // 5c. Eating / Starving / Food / Takeout
  {
    matcher: (t) =>
      t.includes('饿') || t.includes('吃点') || t.includes('外卖') || t.includes('晚饭') || t.includes('午饭') || t.includes('夜宵') || t.includes('火锅'),
    generate: (t) => ({
      original: t,
      natural: "I'm absolutely starving, let's grab a quick bite or order some takeout.",
      category: '饮食健康',
      tags: ['美食', '聚餐', '点餐'],
      explanation: '• 「Starving」在口语中极高频夸张地表达“快饿扁了”。\n• 「Grab a bite」是母语者找地方随便吃点东西的经典非正式口语。',
      phrases: [
        {
          phrase: 'grab a bite',
          pos: '短语',
          meaning: '随便吃点东西、垫垫肚子',
          example: "Let's grab a quick bite before the movie starts.",
        },
      ],
    }),
  },
  // 5d. Sleep / Exhaustion / Bedtime
  {
    matcher: (t) =>
      t.includes('睡') || t.includes('好困') || t.includes('熬夜') || t.includes('失眠') || t.includes('躺下'),
    generate: (t) => ({
      original: t,
      natural: "I'm completely wiped out, I'm just gonna call it a night and hit the hay.",
      category: '饮食健康',
      tags: ['睡眠', '休息', '作息'],
      explanation: '• 「Call it a night」意为今晚到此为止准备休息；「hit the hay」是母语者极地道的上床睡觉俚语表达。\n• 比普通直译「I am going to sleep」更有地道市井烟火气。',
      phrases: [
        {
          phrase: 'call it a night',
          pos: '短语',
          meaning: '今晚就到这里、准备休息',
          example: "It's past midnight, let's call it a night.",
        },
        {
          phrase: 'hit the hay',
          pos: '短语',
          meaning: '上床睡觉',
          example: "I'm ready to hit the hay after this long day.",
        },
      ],
    }),
  },
  // 5e. Rush / Hurry / Running late
  {
    matcher: (t) =>
      t.includes('赶时间') || t.includes('来不及') || t.includes('快点') || t.includes('迟到') || t.includes('赶紧'),
    generate: (t) => ({
      original: t,
      natural: "I'm in a huge rush right now, we gotta get a move on or we'll be late.",
      category: '出行旅游',
      tags: ['急促', '赶路', '时间'],
      explanation: '• 「In a rush」形容时间紧迫、急匆匆；「get a move on」是催促赶快动身、加快脚步的地道口语。\n• 节奏明快紧凑。',
      phrases: [
        {
          phrase: 'get a move on',
          pos: '动词短语',
          meaning: '赶快行动、加快脚步',
          example: 'We need to get a move on if we want to catch the train.',
        },
      ],
    }),
  },
  // 5f. Gratitude / Apology
  {
    matcher: (t) =>
      t.includes('谢谢') || t.includes('多亏') || t.includes('感谢') || t.includes('太棒了你'),
    generate: (t) => ({
      original: t,
      natural: "I can't thank you enough, you are an absolute lifesaver.",
      category: '社交聚会',
      tags: ['致谢', '感恩', '社交'],
      explanation: '• 「You are an absolute lifesaver」是极度感谢对方雪中送炭帮大忙时的英美黄金赞誉口语。\n• 比简单的「Thank you very much」真挚热烈得多。',
      phrases: [
        {
          phrase: 'lifesaver',
          pos: '名词',
          meaning: '救星、帮了大忙的人',
          example: 'Thanks for lending me the charger, you are a lifesaver!',
        },
      ],
    }),
  },
  {
    matcher: (t) =>
      t.includes('对不起') || t.includes('抱歉') || t.includes('不好意思') || t.includes('我的错'),
    generate: (t) => ({
      original: t,
      natural: "My bad, I totally dropped the ball on this one.",
      category: '社交聚会',
      tags: ['致歉', '道歉', '责任'],
      explanation: '• 「My bad」是当代口语中承担轻微责任最自然的用语；「drop the ball」形象表达把事情搞砸失误。\n• 展现勇于担当且轻松不刻板的沟通智慧。',
      phrases: [
        {
          phrase: 'drop the ball',
          pos: '动词短语',
          meaning: '出现失误、办砸事情',
          example: "I was supposed to send the email, but I dropped the ball.",
        },
      ],
    }),
  },
  // 6. Overwhelmed / High Stress / Tired
  {
    matcher: (t) =>
      (t.includes('累') || t.includes('压力') || t.includes('焦虑') || t.includes('烦') || t.includes('心累') || t.includes('喘不过气')),
    generate: (t) => ({
      original: t,
      natural: "I'm honestly feeling so overwhelmed and burnt out lately.",
      category: '情感表达',
      tags: ['压力', '心态', '疲惫'],
      explanation: '• 「Overwhelmed」形容被压力压得喘不过气；「burnt out」精准形容身心俱疲的倦怠状态。\n• 比简单的「I am tired」更具心理层面的深度与共鸣。',
      phrases: [
        {
          phrase: 'burnt out',
          pos: '形容词短语',
          meaning: '筋疲力竭、身心倦怠',
          example: 'Take a weekend break if you are feeling burnt out.',
        },
      ],
    }),
  },
  // 7. Work / Project / Meeting / Boss
  {
    matcher: (t) =>
      (t.includes('工作') || t.includes('项目') || t.includes('开会') || t.includes('加班') || t.includes('老板') || t.includes('方案')),
    generate: (t) => ({
      original: t,
      natural: "Let's align on this project so we can wrap things up before the deadline.",
      category: '职场办公',
      tags: ['职场', '项目', '协作'],
      explanation: '• 「Align on」指各方达成共识与对齐；「wrap things up」指圆满收尾结束工作。\n• 极具专业度与现代外企协作感。',
      phrases: [
        {
          phrase: 'wrap up',
          pos: '动词短语',
          meaning: '圆满收尾、结束',
          example: "Let's wrap up this meeting in five minutes.",
        },
      ],
    }),
  },
  // 8. Travel / Vacation / Going out
  {
    matcher: (t) =>
      (t.includes('旅游') || t.includes('度假') || t.includes('出去玩') || t.includes('放假') || t.includes('旅行')),
    generate: (t) => ({
      original: t,
      natural: "I desperately need a quick getaway to recharge my batteries.",
      category: '出行旅游',
      tags: ['旅行', '度假', '休闲'],
      explanation: '• 「Getaway」指远离烦嚣的短途度假；「recharge batteries」形象指代给自己充电恢复活力。\n• 当代白领与学生极高频的旅行期盼口语。',
      phrases: [
        {
          phrase: 'weekend getaway',
          pos: '名词短语',
          meaning: '周末短途度假',
          example: 'We planned a spontaneous weekend getaway to the beach.',
        },
      ],
    }),
  },
  // 9. Shopping / Buying / Price
  {
    matcher: (t) =>
      (t.includes('买') || t.includes('逛街') || t.includes('价格') || t.includes('便宜') || t.includes('贵') || t.includes('打折')),
    generate: (t) => ({
      original: t,
      natural: "That price is an absolute steal; you gotta grab it before it's gone.",
      category: '购物消费',
      tags: ['折扣', '购物', '消费'],
      explanation: '• 「An absolute steal」极度夸张地赞叹价格便宜到如同白捡一般划算。\n• 比普通直译「It is cheap」更有感染力与促单语感。',
      phrases: [
        {
          phrase: 'an absolute steal',
          pos: '名词短语',
          meaning: '太便宜了、极其划算',
          example: 'At twenty dollars, this jacket is an absolute steal.',
        },
      ],
    }),
  },
];

// Helper to translate arbitrary Chinese sentence to a faithful, natural spoken English sentence
/**
 * 纯英文输入的「回显」处理：补上句号，给一条通用解析。
 *
 * 中文输入不走这里 —— 见 translateSpokenInput 第 5 步。
 * 原先这个函数的下半段是一条 trimmed.includes(...) 的 if-else 链，
 * 无论输入什么中文都会硬塞一句写死的英文；完全没命中时会落进最后那个
 * 无条件 else，返回一句和输入毫无关系的句子。那不是在翻译，是在编，
 * 而用户会把它当成目标句去背。所以那一段整段删掉了。
 */
function buildEnglishEchoResult(trimmed: string): SpokenOptimizationResult {
  const natural = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  return {
    original: trimmed,
    natural,
    category: '日常家务',
    tags: ['口语', '交流'],
    explanation: `• 原始英文表达「${trimmed}」语意通顺自然。\n• 在口语交流中，保持语调抑扬顿挫即可展现地道母语感。`,
    phrases: [
      {
        phrase: 'flow naturally',
        pos: '短语',
        meaning: '表达自然流畅',
        example: 'Keep practicing to make your conversation flow naturally.',
      },
    ],
    confidence: 'exact',
  };
}

// Generate complete authentic translation result for any input
/** 纯英文输入（允许数字与常见标点）：本身就是可用答案，不需要翻译。 */
function isPureEnglishText(text: string): boolean {
  return /^[a-zA-Z0-9\s,.'!?"-]+$/.test(text);
}

/**
 * 离线兜底：把中文口语映射成地道英文表达。
 *
 * 返回 null = 「词库真的没有这条」，调用方必须如实告诉用户，
 * 不要再拿一句无关的英文顶上。
 *
 * 这条路径以前最后会走 buildSyntacticTranslation 里那条 includes() 宽匹配链，
 * 实测输入「周末想去爬山」会拿到 "Let's make sure we approach this with the
 * right perspective." —— 和输入毫无关系，用户却会把它当成目标句去背。
 */
export function translateSpokenInput(input: string): SpokenOptimizationResult | null {
  const trimmed = input.trim();

  // 空输入就是没答案。原先这里会返回 "I've got this covered."（承揽任务），
  // 和用户没输入这件事毫无关系。
  if (!trimmed) return null;

  // 1. 灵感库命中 —— 高置信，可以当答案学
  const inspirationMatch = findInspirationMatch(trimmed);
  if (inspirationMatch) {
    return {
      ...inspirationToOptimizationResult(inspirationMatch, trimmed),
      confidence: 'exact',
    };
  }

  // 2. 精确词条命中（严格相等，不会误伤）—— 高置信
  const matchedEntry = SPOKEN_EXPRESSIONS_DICT.find((entry) =>
    entry.exactKeywords.some((kw) => trimmed === kw || trimmed === `${kw}。` || trimmed === `${kw}！` || trimmed === `${kw}？`)
  );

  if (matchedEntry) {
    return {
      original: trimmed,
      natural: matchedEntry.natural,
      category: matchedEntry.category,
      tags: sanitizeTwoCharNounTags(matchedEntry.tags),
      explanation: matchedEntry.explanation,
      phrases: [matchedEntry.phrase],
      confidence: 'exact',
    };
  }

  // 3. 输入本身就是英文：原样回显（补个句号）就是可用答案 —— 高置信
  if (isPureEnglishText(trimmed)) {
    return buildEnglishEchoResult(trimmed);
  }

  // 4. 主题规则命中：给的是「这个主题下的一句真地道表达」，
  //    不是「你这句话的翻译」。标成 'topic'，由上层如实说明。
  for (const pattern of SEMANTIC_PATTERNS) {
    if (pattern.matcher(trimmed)) {
      return { ...pattern.generate(trimmed), confidence: 'topic' };
    }
  }

  // 5. 词库确实没有这条 —— 如实返回 null，不编句子。
  return null;
}
