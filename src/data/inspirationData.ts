// ⚠️ 本文件在云平台 serverless 的导入链上（server.ts → 这里），相对导入必须带 .js 后缀。
// Vite / esbuild 会把 "./x.js" 解析回 x.ts，前端构建不受影响。
import { FlashCard, PhraseItem, CardCategory } from '../types.js';
import { pickCoreHighlights } from '../utils/highlightPicker.js';

/**
 * 灵感库条目的重点词。
 *
 * explanation 里作者用 **重点搭配** 标过核心词，优先采用其中**能逐字命中原句**的那一个；
 * 没有可用的就退回按语义分量挑。必须逐字命中 —— 渲染层用 indexOf 精确匹配，
 * 差一个字符红字整段不显示。
 *
 * （原实现是 correctedText.split(' ')[0]，也就是「句子第一个词」，
 *   英文句首几乎总是 I / It / My 这类无记忆价值的功能词。）
 */
function pickItemHighlights(correctedText: string, uniqueTerms: string[]): string[] {
  const authored = uniqueTerms.find((t) => t.length >= 3 && correctedText.includes(t));
  if (authored) return [authored];
  return pickCoreHighlights(correctedText);
}

export interface InspirationItem {
  translatedText: string;
  correctedText: string;
  explanation: string;
  sceneSuggestion: 'daily' | 'work' | 'social' | 'emotions' | 'tech' | 'food' | 'learning' | 'shopping' | 'travel' | 'hobbies';
  tags: string[];
}

export const SCENE_CATEGORY_MAP: Record<string, CardCategory> = {
  daily: '日常家务',
  work: '职场办公',
  social: '社交聚会',
  emotions: '情感表达',
  tech: '科技生活',
  food: '饮食健康',
  learning: '学习提升',
  shopping: '购物消费',
  travel: '出行旅游',
  hobbies: '兴趣爱好',
};

export const INSPIRATION_DATA: InspirationItem[] = [
  {
    "translatedText": "我今天打算在家里摆烂，哪儿也不想去。",
    "correctedText": "I’m just gonna stay home and rot today; I’m not vibing with going out.",
    "explanation": "### **核心词/搭配解释：**\n**Rot** (或 bed-rotting) 是当下极火的 Gen Z 俚语，指长时间躺在床上无所事事，以此作为一种极端的放松方式；**Not vibing with** 指对某事没感觉、不感兴趣。\n\n### **表达细节：**\n这种表达带有强烈的自嘲色彩。相比传统的 I want to relax，**Rot** 传达了一种“彻底瘫痪”的幽默感，非常符合现代年轻人面对压力时的反抗心理。\n\n### **同义表达：**\n如果想表达由于极度疲惫而只想宅在家里什么都不干，还可以用 **I just want to vegetable out on the couch.**",
    "sceneSuggestion": "daily",
    "tags": ["生活", "摆烂", "宅家"]
  },
  {
    "translatedText": "那个会议简直是浪费时间，明明发个邮件就能说清楚。",
    "correctedText": "That meeting was such a drag; it literally could have been an email.",
    "explanation": "### **核心词/搭配解释：**\n**Such a drag** 形容某事非常无聊、令人厌烦且拖沓；**Could have been an email** 是当代职场最经典的吐槽梗，讽刺低效的沟通。\n\n### **表达细节：**\n使用 **Literally** 增加了讽刺力度。这种说法在年轻人的职场圈子里非常有共鸣，体现了对官僚主义和低效会议的厌倦。\n\n### **同义表达：**\n如果想表达会议内容毫无意义、让人昏昏欲睡，还可以用 **That meeting was a total snooze-fest.**",
    "sceneSuggestion": "work",
    "tags": ["职场", "会议", "吐槽"]
  },
  {
    "translatedText": "你今天这身穿搭绝了，气场全开。",
    "correctedText": "Your fit is fire today; you are absolutely slaying.",
    "explanation": "### **核心词/搭配解释：**\n**Fit** 是 outfit 的缩写，当代流行说法；**Fire** 形容超酷、极好；**Slaying** 指表现得极其出色或穿得非常好看。\n\n### **表达细节：**\n这是最典型的当代社交媒体评论风格。**Slay** 带有强烈的肯定和赞美，语气自信且富有活力，是赞美他人的最高级方式之一。\n\n### **同义表达：**\n如果想表达对方的装扮非常精致且极具时尚感，还可以用 **You look so snatched in that dress.**",
    "sceneSuggestion": "social",
    "tags": ["社交", "审美", "夸奖"]
  },
  {
    "translatedText": "我真的很焦虑，总觉得自己做错了很多事。",
    "correctedText": "I’m low-key spiraling right now; I keep overthinking everything I did wrong.",
    "explanation": "### **核心词/搭配解释：**\n**Spiraling** 形象地描述了思维陷入负面循环、逐渐失控的状态，即“心态崩了”；**Low-key** 增加了一种私密且克制的语感。\n\n### **表达细节：**\n**Spiraling** 比 anxious 更具画面感，它传达了一种由于压力过大导致的连锁反应。在当代心理健康讨论中，这是一个非常高频的词汇。\n\n### **同义表达：**\n如果想表达某人因为一点小事就彻底崩溃或陷入混乱，还可以用 **He’s having a total meltdown.**",
    "sceneSuggestion": "emotions",
    "tags": ["情感", "焦虑", "心态"]
  },
  {
    "translatedText": "我手机快没电了，随时可能自动关机。",
    "correctedText": "My phone is on life support; it’s gonna die any second now.",
    "explanation": "### **核心词/搭配解释：**\n**On life support** 原指靠呼吸机维持生命，这里幽默地形容手机电量极低；**Die** 是电子设备关机的标准口语。\n\n### **表达细节：**\n这种拟人化的表达方式非常生动。母语者在面对生活中的小故障时，喜欢用这种带有戏剧张力的词汇来增加沟通的趣味性。\n\n### **同义表达：**\n如果想表达手机已经彻底没电了，还可以用 **My phone is officially bricked.**",
    "sceneSuggestion": "tech",
    "tags": ["科技", "日常", "吐槽"]
  },
  {
    "translatedText": "这顿饭真的太丰盛了，我感觉要吃撑了。",
    "correctedText": "This meal is a whole vibe; I’m definitely going to have a food coma.",
    "explanation": "### **核心词/搭配解释：**\n**A whole vibe** 形容整体氛围和感觉非常好；**Food coma** 指饱餐后因为血液流向胃部而产生的困倦感。\n\n### **表达细节：**\n**Food coma** 是一个非常有生活气息的词。与其说 I'm full，不如说进入了“食物昏迷”状态，这种夸张的说法更能体现餐点的美味和丰盛。\n\n### **同义表达：**\n如果想表达自己吃得太多，胃都要撑爆了，还可以用 **I'm totally stuffed to the gills.**",
    "sceneSuggestion": "food",
    "tags": ["美食", "生活", "感官"]
  },
  {
    "translatedText": "学习这事儿真的没法急，得慢慢积累。",
    "correctedText": "You can't force the grind; learning is all about the long game.",
    "explanation": "### **核心词/搭配解释：**\n**The grind** 指枯燥但必须坚持的努力过程；**Long game** 指需要长期投入、不计较短期得失的策略或过程。\n\n### **表达细节：**\n**Long game** 传达了一种成熟且理性的学习观。比起 It takes time，这种说法更有“战略”色彩，非常受现代职场人和学习者的青睐。\n\n### **同义表达：**\n如果想表达成功的关键在于持之以恒的努力，还可以用 **Consistency is key if you want to see results.**",
    "sceneSuggestion": "learning",
    "tags": ["学习", "励志", "成长"]
  },
  {
    "translatedText": "别老是想那些没用的，顺其自然吧。",
    "correctedText": "Stop overthinking the what-ifs; just let it be.",
    "explanation": "### **核心词/搭配解释：**\n**The what-ifs** 指那些假设出来的、尚未发生的忧虑；**Let it be** 是顺其自然、不再干预的经典表达。\n\n### **表达细节：**\n**What-ifs** 把抽象的担忧具象化了。这句话语气平和且坚定，常用于安慰处于焦虑状态的朋友，鼓励他们放下心理负担。\n\n### **同义表达：**\n如果想表达接受现状、随遇而安的态度，还可以用 **Just roll with the punches.**",
    "sceneSuggestion": "emotions",
    "tags": ["情感", "心态", "治愈"]
  },
  {
    "translatedText": "他刚才跟我说话的方式太没礼貌了，我气炸了。",
    "correctedText": "The way he talked to me was so uncalled for; I’m fuming right now.",
    "explanation": "### **核心词/搭配解释：**\n**Uncalled for** 指某人的言行是不必要的、冒犯性的、没礼貌的；**Fuming** 形容愤怒到冒烟的状态。\n\n### **表达细节：**\n**Uncalled for** 比 rude 更显地道且带有批判性。它不仅仅是在说对方没礼貌，更是在强调这种行为是不合时宜、不被接受的。\n\n### **同义表达：**\n如果想表达对方厚颜无耻、不知廉耻，还可以用 **The nerve of some people!**",
    "sceneSuggestion": "social",
    "tags": ["社交", "情绪", "冲突"]
  },
  {
    "translatedText": "由于这个新规定，我们要从头开始了。",
    "correctedText": "Because of this new rule, we’re back to square one.",
    "explanation": "### **核心词/搭配解释：**\n**Back to square one** 是一个源自游戏的习语，指回到了最开始的起点，之前的努力全部白费了。\n\n### **表达细节：**\n这句话带有一种强烈的无奈感，常用于项目受阻或计划被打乱的场景。它比 restart 更能传达出那种“功亏一篑”的沮丧心情。\n\n### **同义表达：**\n如果想表达必须放弃当前方案重新开始，还可以用 **We have to scratch the whole thing and start from zero.**",
    "sceneSuggestion": "work",
    "tags": ["职场", "挫折", "计划"]
  },
  {
    "translatedText": "我得赶紧去补个觉，我感觉我要累瘫了。",
    "correctedText": "I need to catch some Z's; I'm absolutely wiped out.",
    "explanation": "### **核心词/搭配解释：**\n**Catch some Z's** 是睡觉的地道口语；**Wiped out** 形象地描述了精力被彻底抹去、极度疲劳。\n\n### **表达细节：**\n比起 I'm tired，**Wiped out** 语气更重。Catch some Z's 带有某种程度的随意和调侃，常用于忙碌间隙寻找休息机会的对话。\n\n### **同义表达：**\n如果想表达自己累到了极点、随时会倒下，还可以用 **I'm running on fumes right now.**",
    "sceneSuggestion": "daily",
    "tags": ["生活", "睡眠", "疲劳"]
  },
  {
    "translatedText": "别在那儿装了，我知道你在想什么。",
    "correctedText": "Stop capping; I know exactly what’s on your mind.",
    "explanation": "### **核心词/搭配解释：**\n**Capping** 是当代最流行的俚语之一，意为“吹牛、撒谎、装腔作势”；**No cap** 则表示“不骗你、真的”。\n\n### **表达细节：**\n这是一个非常 Gen Z 的表达。在非正式社交场合，用 capping 代替 lying 会让你听起来非常潮流且接地气。\n\n### **同义表达：**\n如果想表达对方在虚张声势或满口胡言，还可以用 **You're just full of hot air.**",
    "sceneSuggestion": "social",
    "tags": ["社交", "诚实", "俚语"]
  },
  {
    "translatedText": "这事儿越想越不对劲，我觉得这里面有猫腻。",
    "correctedText": "Something feels off about this; I low-key think it’s kinda sus.",
    "explanation": "### **核心词/搭配解释：**\n**Sus** 是 suspicious 的缩写，指“可疑、有猫腻”；**Off** 指不正常、不对劲。\n\n### **表达细节：**\n**Low-key** 表达一种直觉上的、不敢百分百肯定的怀疑。这种说法在当代口语中极其流行，能精准传达出那种“直觉上的不安”。\n\n### **同义表达：**\n如果想表达你闻到了阴谋或不寻常的气息，还可以用 **I smell a rat in this whole situation.**",
    "sceneSuggestion": "emotions",
    "tags": ["怀疑", "直觉", "套力"]
  },
  {
    "translatedText": "我真没想那么多，我就是随口一说。",
    "correctedText": "I didn't mean anything by it; it was just a spur-of-the-moment comment.",
    "explanation": "### **核心词/搭配解释：**\n**Didn't mean anything by it** 指“没有恶意、没别的意思”；**Spur-of-the-moment** 指一时的冲动、没经过预谋的。\n\n### **表达细节：**\n当你怕对方误会你的意图时，这是一个完美的解释句式。语气委婉且带有歉意，能有效化解潜在的尴尬。\n\n### **同义表达：**\n如果想表达自己只是漫不经心地随口一提，还可以用 **It was just a casual remark off the top of my head.**",
    "sceneSuggestion": "social",
    "tags": ["解释", "误会", "沟通"]
  },
  {
    "translatedText": "我昨天本来想学习的，结果刷了一晚上手机。",
    "correctedText": "I was supposed to study, but I ended up doomscrolling all night.",
    "explanation": "### **核心词/搭配解释：**\n**Doomscrolling** 指停不下来地刷手机（通常看些没意义或让人焦虑的内容）；**Ended up** 强调原本没有计划但最终发生的结果。\n\n### **表达细节：**\n**Doomscrolling** 是近年来的热词，精准描述了现代人面对电子屏幕时的无力感。这在学习或提升的场景中充满了强烈的共鸣感。\n\n### **同义表达：**\n如果想表达自己因为被琐事分心而浪费了时间，还可以用 **I got sidetracked by my phone for hours.**",
    "sceneSuggestion": "learning",
    "tags": ["学习", "拖延", "自嘲"]
  },
  {
    "translatedText": "虽然我没去成，但我精神上与你们同在。",
    "correctedText": "Even though I couldn't make it, I’m there with you in spirit.",
    "explanation": "### **核心词/搭配解释：**\n**Make it** 指成功抵达或参加（某个活动）；**In spirit** 指精神上、心意上。\n\n### **表达细节：**\n这是一句非常有礼貌且地道的社交辞令。当你无法出席朋友的聚会时，用这一句能瞬间拉近距离，展示你的关心。\n\n### **同义表达：**\n如果想表达虽然人不在场但心系此事，还可以用 **I'll be rooting for you from afar.**",
    "sceneSuggestion": "social",
    "tags": ["社交", "礼仪", "关心"]
  },
  {
    "translatedText": "他这人太有魅力了，简直是行走的荷尔蒙。",
    "correctedText": "He’s got so much rizz; he’s literally a total heartthrob.",
    "explanation": "### **核心词/搭配解释：**\n**Rizz** 是当代最火的 Gen Z 俚语，由 Charisma 演变而来，指“吸引力、魅力”；**Heartthrob** 形容让人心跳加速的迷人者。\n\n### **表达细节：**\n这种表达极具现代感，非常适合在社交媒体或死党聚会时谈论心动对象。使用 **Literally** 增加了语气强度，符合母语年轻人夸张的表达习惯。\n\n### **同义表达：**\n如果想表达某人非常有魅力且很会撩人，还可以用 **He’s a smooth talker with major game.**",
    "sceneSuggestion": "social",
    "tags": ["社交", "魅力", "撩人"]
  },
  {
    "translatedText": "我昨天被他放鸽子了，真让人无语。",
    "correctedText": "He totally ghosted me yesterday; I’m honestly speechless.",
    "explanation": "### **核心词/搭配解释：**\n**Ghosted** 指像鬼魂一样消失，即“突然失联”或“冷暴力”；**Speechless** 形容无语到说不出话。\n\n### **表达细节：**\n在社交语境下，ghosted 带有明显的当代色彩，常用于约会场景或朋友之间突然不回消息。这种说法比 I was stood up 更具现代感。\n\n### **同义表达：**\n如果想表达某人在最后一刻临时爽约，还可以用 **He flaked on me at the last minute.**",
    "sceneSuggestion": "social",
    "tags": ["社交", "吐槽", "放人"]
  },
  {
    "translatedText": "别再精神内耗了，这又不是你的错。",
    "correctedText": "Stop beating yourself up; it’s not even your fault.",
    "explanation": "### **核心词/搭配解释：**\n**Beat yourself up** 指过分自责、在心理上折磨自己，是“精神内耗”最贴切的口语表达；**Not even** 强调根本不是。\n\n### **表达细节：**\n这种语气充满了同理心和安慰。当代母语者倾向于使用这种带有心理关怀色彩的词汇来缓解对方的焦虑感。\n\n### **同义表达：**\n如果想表达不要对某件事过度思虑、钻牛角尖，还可以用 **Don't overthink it.**",
    "sceneSuggestion": "emotions",
    "tags": ["情感", "安慰", "心态"]
  },
  {
    "translatedText": "我就知道他是在吹牛，他这人太爱装了。",
    "correctedText": "I knew he was capping; he’s always being so extra.",
    "explanation": "### **核心词/搭配解释：**\n**Capping** 指吹牛、撒谎；**Extra** 指行为过分夸张、爱加戏、爱显摆。\n\n### **表达细节：**\n这组词汇极具现代感。如果你在朋友聚会时这么说，会显得你的英语非常紧跟潮流。Extra 带有轻微的嫌弃感。\n\n### **同义表达：**\n如果想表达某人只是在为了面子而说大话，还可以用 **He's just talking big to impress everyone.**",
    "sceneSuggestion": "social",
    "tags": ["社交", "俚语", "评价"]
  },
  {
    "translatedText": "这款手机性能确实好，但价格也太离谱了。",
    "correctedText": "This phone is a beast, but the price tag is straight-up daylight robbery.",
    "explanation": "### **核心词/搭配解释：**\n**A beast** 形容性能极强；**Daylight robbery** 指光天化日下的抢劫，即“贵得离谱”。\n\n### **表达细节：**\n**Straight-up** 是副词，意为“简直就是”。这种表达带有一种强烈的愤慨和调侃，非常适合科技发烧友之间的交流。\n\n### **同义表达：**\n如果想表达某件东西贵得超出了它的实际价值，还可以用 **It's way overpriced for what it is.**",
    "sceneSuggestion": "tech",
    "tags": ["科技", "购物", "评价"]
  },
  {
    "translatedText": "我最近真的很有动力，每天都在卷学习。",
    "correctedText": "I’m so locked in lately; I’ve been on that daily grind with my studies.",
    "explanation": "### **核心词/搭配解释：**\n**Locked in** 指进入了极度专注、心无旁骛的状态；**On the grind** 对应持续刻苦努力的状态。\n\n### **表达细节：**\n这是一种非常积极、有活力的表达方式。Locked in 常用于运动员进入状态，现在被年轻人广泛用于学习和工作。\n\n### **同义表达：**\n如果想表达一个人正在全力以赴地追求目标，还可以用 **I'm going all out to improve my skills.**",
    "sceneSuggestion": "learning",
    "tags": ["学习", "励志", "卷王"]
  },
  {
    "translatedText": "这家餐厅的味道真的绝了，我的味蕾被惊艳到了。",
    "correctedText": "This place slaps; the flavors are absolutely mind-blowing.",
    "explanation": "### **核心词/搭配解释：**\n**Slaps** 是形容食物或音乐极好的俚语；**Mind-blowing** 形容震撼人心的、让人大开眼界的。\n\n### **表达细节：**\n使用 Slaps 会让你听起来像个地道的母语者。这种表达比 Good 或 Delicious 更有力度，情绪饱满。\n\n### **同义表达：**\n如果想表达某种食物味道好极了，还可以用 **This food is to die for.**",
    "sceneSuggestion": "food",
    "tags": ["美食", "评价", "俚语"]
  },
  {
    "translatedText": "我本来想省钱的，但看到打折就没忍住。",
    "correctedText": "I was trying to be low-key with my spending, but I caved when I saw the sale.",
    "explanation": "### **核心词/搭配解释：**\n**Be low-key with** 意为低调处理，这里指“省着点花”；**Caved** 指在诱惑面前屈服、败下阵来。\n\n### **表达细节：**\n**Caved** 形象地表现了心理防线崩塌的过程，带有一种自责又无奈的幽默感，非常贴近现代消费者的心理。\n\n### **同义表达：**\n如果想表达自己一时冲动买了不该买的东西，还可以用 **I made an impulse purchase I might regret.**",
    "sceneSuggestion": "shopping",
    "tags": ["购物", "消费", "省钱"]
  },
  {
    "translatedText": "我这会儿忙得脚不沾地，咱们晚点再说吧。",
    "correctedText": "I’m tied up at the moment; let's circle back later.",
    "explanation": "### **核心词/搭配解释：**\n**Tied up** 意为“被（工作或琐事）缠住”；**Circle back** 是职场高频短语，指“稍后回来讨论”。\n\n### **表达细节：**\n比起简单的 I'm busy，**Tied up** 显得更职业且地道。**Circle back** 展示了你对任务的掌控感，既专业又不会显得生硬。\n\n### **同义表达：**\n如果想表达自己现在手头事情太多无法脱身，还可以用 **I have a lot on my plate right now.**",
    "sceneSuggestion": "work",
    "tags": ["职场", "忙碌", "效率"]
  },
  {
    "translatedText": "我真的很想换个工作，现在这份干得太心累了。",
    "correctedText": "I'm seriously itching for a career change; my current job is just so draining.",
    "explanation": "### **核心词/搭配解释：**\n**Itching for** 渴望做某事，感觉手痒、迫不及待；**Draining** 像抽水一样耗尽精力，即“心累”。\n\n### **表达细节：**\n**Draining** 精准捕捉了现代职场人那种精神上的疲惫感。ITCHING 传达了一种蠢蠢欲动的改变欲望。\n\n### **同义表达：**\n如果想表达你已经对目前的工作彻底厌倦，还可以用 **I'm totally fed up with my job.**",
    "sceneSuggestion": "work",
    "tags": ["职场", "心累", "跳槽"]
  },
  {
    "translatedText": "他平时看着挺冷淡的，其实心肠特别软。",
    "correctedText": "He seems standoffish, but he’s actually a total softie at heart.",
    "explanation": "### **核心词/搭配解释：**\n**Standoffish** 指冷淡、疏远、不友好；**Softie** 指心软的人、容易动情的人。\n\n### **表达细节：**\n**At heart** 表示“内心深处”。这种表达揭示了人物的性格反差，带有一种温暖的转折感。\n\n### **同义表达：**\n如果想表达某人外冷内热，还可以用 **He’s got a tough exterior but he's all mushy inside.**",
    "sceneSuggestion": "social",
    "tags": ["性格", "反差", "社交"]
  },
  {
    "translatedText": "我刚才真的被吓到了，魂都飞了。",
    "correctedText": "I was so shook just now; I literally jumped out of my skin.",
    "explanation": "### **核心词/搭配解释：**\n**Shook** 是当代口语，意为被吓坏了或被震撼了；**Jumped out of one's skin** 形象地描述惊吓过度的反应。\n\n### **表达细节：**\n这是非常典型的夸张法。母语者在描述受惊场景时，喜欢用这种强烈的身体反应描写来增强叙述的画面感。\n\n### **同义表达：**\n如果想表达某事让你感到极度恐惧，还可以用 **It scared the living daylights out of me.**",
    "sceneSuggestion": "emotions",
    "tags": ["情感", "惊讶", "吓坏"]
  },
  {
    "translatedText": "别再为那件事纠结了，反正也改变不了什么。",
    "correctedText": "Stop tripping over it; it’s not like you can change anything now anyway.",
    "explanation": "### **核心词/搭配解释：**\n**Tripping** 是当代非常地道的口语，指为某事过度焦虑、生气或小题大做；**Not like** 常用于引导一个显而易见的理由。\n\n### **表达细节：**\n使用 **Anyway** 在结尾增加了一种“木已成舟”的宿命感。这种表达方式在年轻人闲聊中非常自然，带有一种酷酷的劝慰感。\n\n### **同义表达：**\n如果想表达不要为了已经发生且无法挽回的事情感到压力，还可以用 **Don't sweat the things you can't control.**",
    "sceneSuggestion": "emotions",
    "tags": ["心态", "劝慰", "放下"]
  },
  {
    "translatedText": "我真没想抢你风头，我只是想帮忙。",
    "correctedText": "I wasn't trying to flex on you; I just genuinely wanted to help out.",
    "explanation": "### **核心词/搭配解释：**\n**Flex on someone** 指向某人炫耀、展示优越感或抢风头；**Genuinely** 强调诚意，比 really 更有说服力。\n\n### **表达细节：**\n**Flex** 是近年来极高频的俚语。当你想澄清自己并没有显摆的意思时，用这个词能瞬间拉近与对方的语境距离，显得很懂当代社交礼仪。\n\n### **同义表达：**\n如果想表达无意中盖过了别人的光芒，还可以用 **I didn't mean to upstage you.**",
    "sceneSuggestion": "social",
    "tags": ["社交", "解释", "诚意"]
  },
  {
    "translatedText": "这个方案我们要推倒重来，之前的都白做了。",
    "correctedText": "We need to scrap this proposal; all our hard work just went down the drain.",
    "explanation": "### **核心词/搭配解释：**\n**Scrap** 指像扔废铁一样放弃某个计划或想法；**Go down the drain** 像水流进下水道，形容努力彻底付诸东流。\n\n### **表达细节：**\n**Down the drain** 带有强烈的沮丧感。在职场中，这种表达比 I wasted my time 更有画面感，能引发同事的共鸣。\n\n### **同义表达：**\n如果想表达需要彻底放弃目前的进度并重新寻找方向，还可以用 **We need to go back to the drawing board.**",
    "sceneSuggestion": "work",
    "tags": ["职场", "挫折", "重来"]
  },
  {
    "translatedText": "他这人太假了，当面一套背后一套。",
    "correctedText": "He’s so two-faced; he’ll hype you up to your face and then talk trash behind your back.",
    "explanation": "### **核心词/搭配解释：**\n**Two-faced** 变脸、虚伪；**Hype someone up** 吹捧、给某人打气；**Talk trash** 说坏话、喷人。\n\n### **表达细节：**\n这种结构化的对比描述了典型的社交背叛。使用 **Hype up** 代替 praise 使语气更加当代化，符合年轻人对社交关系的犀利观察。\n\n### **同义表达：**\n如果想表达某人是个典型的伪君子，还可以用 **He’s such a hypocrite, honestly.**",
    "sceneSuggestion": "social",
    "tags": ["吐槽", "人际", "虚伪"]
  },
  {
    "translatedText": "我得赶紧去搞点咖啡，我快困死了。",
    "correctedText": "I need to grab some coffee ASAP; I’m literally crashing hard.",
    "explanation": "### **核心词/搭配解释：**\n**ASAP** 越快越好；**Crashing hard** 指能量耗尽、极度疲劳导致的体力和精神状态骤降。\n\n### **表达细节：**\n**Crashing** 原指药物或咖啡因效果消失后的虚脱感，现在广泛用于形容极度困倦。使用 **Literally** 表现了那种无法抗拒的倦意。\n\n### **同义表达：**\n如果想表达由于熬夜而感到整个人昏昏沉沉，还可以用 **I'm feeling super groggy from the lack of sleep.**",
    "sceneSuggestion": "daily",
    "tags": ["日常", "疲劳", "咖啡"]
  },
  {
    "translatedText": "那个电影的结局真是绝了，我整个人都傻了。",
    "correctedText": "That movie ending was a total mind-f***; I was left completely shook.",
    "explanation": "### **核心词/搭配解释：**\n**Mind-blowing** 指极度烧脑、让人怀疑人生的情节；**Shook** 处于极度震惊的状态。\n\n### **表达细节：**\n这是一种非正式、极具冲击力的评价。当代母语者在讨论那些反转极大的影视作品时，常用这种表达来体现震撼程度。\n\n### **同义表达：**\n如果想表达剧情的发展完全超出了你的预料，还可以用 **I didn't see that plot twist coming at all.**",
    "sceneSuggestion": "hobbies",
    "tags": ["电影", "震惊", "反转"]
  },
  {
    "translatedText": "我最近在极简生活，把没用的东西都扔了。",
    "correctedText": "I’ve been decluttering my life lately; I’m getting rid of everything that doesn’t spark joy.",
    "explanation": "### **核心词/搭配解释：**\n**Decluttering** 清理杂物；**Spark joy** 怦然心动（源自近藤麻理惠，已成为极简主义的代名词）。\n\n### **表达细节：**\n**Spark joy** 不仅仅是整理，更代表了一种生活态度。这种表达会让你的英语听起来非常有文化博主（Influencer）的质感。\n\n### **同义表达：**\n如果想表达自己正在有意识地减少物质需求，还可以用 **I'm trying to embrace a minimalist lifestyle.**",
    "sceneSuggestion": "daily",
    "tags": ["生活", "整理", "极简"]
  },
  {
    "translatedText": "别老是这么消极，凡事要往好处想。",
    "correctedText": "Stop being such a buzzkill; you gotta look on the bright side.",
    "explanation": "### **核心词/搭配解释：**\n**Buzzkill** 扫兴的人、悲观主义者；**Look on the bright side** 寻找光明的一面、乐观对待。\n\n### **表达细节：**\n**Buzzkill** 非常生动，指那种一开口就让现场活跃气氛死掉的人。这句话语气活泼，常用于朋友间的互相打趣和提醒。\n\n### **同义表达：**\n如果想表达不要总是关注事情坏的一面，还可以用 **Don't always assume the worst-case scenario.**",
    "sceneSuggestion": "emotions",
    "tags": ["情感", "乐观", "社交"]
  },
  {
    "translatedText": "由于系统升级，我们现在的进度完全卡住了。",
    "correctedText": "Everything is stalled right now because of the system upgrade; we’re stuck in limbo.",
    "explanation": "### **核心词/搭配解释：**\n**Stalled** 熄火、停滞不前；**In limbo** 处于悬而未决、中间地带、进退两难的状态。\n\n### **表达细节：**\n**In limbo** 是一个非常有深度的词汇，描述了那种想进进不去、想退退不回的尴尬停滞，比 simply stuck 更具描述性。\n\n### **同义表达：**\n如果想表达项目因为等待某个反馈而处于停工状态，还可以用 **The whole project is currently on hold.**",
    "sceneSuggestion": "tech",
    "tags": ["科技", "进度", "困境"]
  },
  {
    "translatedText": "我真的很看好这个项目，我觉得它会火。",
    "correctedText": "I’m really vibing with this project; I feel like it’s gonna blow up.",
    "explanation": "### **核心词/搭配解释：**\n**Vibing with** 对...很有感觉、认可；**Blow up** 在社交媒体语境下指迅速走红、大火。\n\n### **表达细节：**\n使用 **Blow up** 比 successful 更有当代感。这种表达方式常见于创业圈和自媒体圈，充满了一种预见未来的自信感。\n\n### **同义表达：**\n如果想表达某样东西很快就会变得非常流行，还可以用 **This is definitely going to go viral.**",
    "sceneSuggestion": "work",
    "tags": ["职场", "预测", "信心"]
  },
  {
    "translatedText": "他说话总是不着边际，别把他的话当真。",
    "correctedText": "He’s always talking nonsense; don't take anything he says seriously.",
    "explanation": "### **核心词/搭配解释：**\n**Talking nonsense** 指胡说八道、满口胡言；**Take seriously** 认真对待。\n\n### **表达细节：**\n在亲密的朋友圈或吐槽中常用，警告对方不要相信那个人的大话。\n\n### **同义表达：**\n如果想表达对方说的话毫无根据，还可以用 **Take what he says with a grain of salt.**",
    "sceneSuggestion": "social",
    "tags": ["社交", "警告", "吐槽"]
  },
  {
    "translatedText": "我得赶紧去洗个澡，我感觉身上都臭了。",
    "correctedText": "I desperately need to hop in the shower; I feel so gross right now.",
    "explanation": "### **核心词/搭配解释：**\n**Hop in** 快速跳进（淋浴/车等）；**Gross** 恶心的、不干净的。\n\n### **表达细节：**\n使用 **Hop in** 增加了动作的轻快感和紧迫感。当代年轻人常用 **Gross** 来形容自己不修边幅的状态，带有一种自嘲式的嫌弃。\n\n### **同义表达：**\n如果想表达自己需要清洁一下让自己恢复神清气爽，还可以用 **I need to freshen up a bit.**",
    "sceneSuggestion": "daily",
    "tags": ["日常", "清洁", "直白"]
  },
  {
    "translatedText": "别老是鸽我，我时间也很宝贵的。",
    "correctedText": "Stop flaking on me; my time is actually super valuable too.",
    "explanation": "### **核心词/搭配解释：**\n**Flaking** 爽约、放鸽子；**Valuable** 有价值的。\n\n### **表达细节：**\n**Actually** 在这里起到强调对立面的作用，委婉地表达了不满。比起 ghosting（消失），**Flaking** 更侧重于临时变卦。\n\n### **同义表达：**\n如果想表达某人总是言而无信，还可以用 **He’s not exactly a man of his word.**",
    "sceneSuggestion": "social",
    "tags": ["社交", "边界", "不满"]
  },
  {
    "translatedText": "这款耳机真的绝了，降噪效果一级棒。",
    "correctedText": "These headphones are a total game-changer; the noise cancellation is top-tier.",
    "explanation": "### **核心词/搭配解释：**\n**Game-changer** 改变游戏规则的事物，指革命性的产品；**Top-tier** 顶级的、最高端的。\n\n### **表达细节：**\n这是一种典型的开箱式评价语。使用 **Top-tier** 展示了你对电子产品质量的专业认知，比 simply good 更有说服力。\n\n### **同义表达：**\n如果想表达某种功能表现优异、令人印象深刻，还可以用 **The performance is truly impressive for the price.**",
    "sceneSuggestion": "tech",
    "tags": ["科技", "安利", "品质"]
  },
  {
    "translatedText": "我真的很想去吃那家火锅，光想都要流口水了。",
    "correctedText": "I'm low-key craving that hotpot; just thinking about it makes my mouth water.",
    "explanation": "### **核心词/搭配解释：**\n**Craving** 渴望（某种食物）；**Makes my mouth water** 让人流口水。\n\n### **表达细节：**\n**Low-key** 表达了一种隐约、持续的渴望感。这句话非常适合在深夜发动态或跟朋友商量晚饭时使用，极具代入感。\n\n### **同义表达：**\n如果想表达由于饥饿而对某种食物产生了极大的冲动，还可以用 **I'm absolutely famished and could eat a horse.**",
    "sceneSuggestion": "food",
    "tags": ["美食", "渴望", "诱惑"]
  },
  {
    "translatedText": "这顿饭我请客，别跟我争了。",
    "correctedText": "Dinner’s on me tonight; don't even try to argue with me.",
    "explanation": "### **核心词/搭配解释：**\n**It's on me** 我请客；**Don't even try** 连试都别试（增强语气）。\n\n### **表达细节：**\n这种表达方式大方且霸气。在西方文化中，直接说 **It's on me** 比 I'll pay 更有社交上的主导地位，显得非常豪爽。\n\n### **同义表达：**\n如果想表达这次费用由你承担且不接受拒绝，还可以用 **My treat, and I won't take no for an answer.**",
    "sceneSuggestion": "social",
    "tags": ["社交", "大方", "买单"]
  },
  {
    "translatedText": "学习不能靠死记硬背，要理解背后的逻辑。",
    "correctedText": "Don't just rely on rote memorization; you gotta wrap your head around the logic.",
    "explanation": "### **核心词/搭配解释：**\n**Rote memorization** 死记硬背；**Wrap your head around** 理解那些复杂、难懂的概念。\n\n### **表达细节：**\n**Wrap your head around** 是一个非常形象的短语，仿佛用大脑包裹住知识。它比 understand 更有“深度消化”的意味。\n\n### **同义表达：**\n如果想表达彻底掌握了某种复杂的知识体系，还可以用 **I finally got a good handle on the material.**",
    "sceneSuggestion": "learning",
    "tags": ["学习", "技巧", "深度"]
  },
  {
    "translatedText": "我的天，这事儿反转也太大了吧。",
    "correctedText": "Oh my god, the plot thickened so fast; I didn't see that coming.",
    "explanation": "### **核心词/搭配解释：**\n**The plot thickens** 事情变得越来越复杂/离奇（原意指小说剧情）；**Didn't see that coming** 没料到会这样。\n\n### **表达细节：**\n这是一种带有戏剧色彩的惊叹。当代年轻人喜欢把生活比作电影，用 **The plot thickens** 会让你的吐槽听起来很有叙事魅力。\n\n### **同义表达：**\n如果想表达事情突然发生了一个 180 度的大转弯，还可以用 **That was a total 180 from what we expected.**",
    "sceneSuggestion": "social",
    "tags": ["惊叹", "反转", "吃瓜"]
  },
  {
    "translatedText": "我感觉我和他完全不在一个频道上，沟通太难了。",
    "correctedText": "I feel like we’re just not on the same wavelength; it’s so hard to sync up.",
    "explanation": "### **核心词/搭配解释：**\n**On the same wavelength** 在同一波长上（即志同道合、有默契）；**Sync up** 同步、达成一致。\n\n### **表达细节：**\n**Wavelength** 是描述人际默契的高级词汇。这种表达比 We are different 更有科技感和现代感，常见于职场或深度社交。\n\n### **同义表达：**\n如果想表达双方在基本观点上存在巨大分歧，还可以用 **We’re just talking past each other at this point.**",
    "sceneSuggestion": "work",
    "tags": ["沟通", "隔阂", "职场"]
  },
  {
    "translatedText": "那个人真的很爱多管闲事，离他远点。",
    "correctedText": "That guy is a real busybody; just keep your distance from him.",
    "explanation": "### **核心词/搭配解释：**\n**Busybody** 爱管闲事的人、爱打听八卦的人；**Keep your distance** 保持距离。\n\n### **表达细节：**\n**Busybody** 带有明显的贬义，暗示对方管得太宽、手伸得太长。这是一种带有防御性的警告，保护自己的个人边界。\n\n### **同义表达：**\n如果想表达让对方少操心别人的私事，还可以用 **He needs to mind his own business.**",
    "sceneSuggestion": "social",
    "tags": ["社交", "边界", "警告"]
  },
  {
    "translatedText": "我最近手头有点紧，能不能先欠着？",
    "correctedText": "I’m a bit strapped for cash right now; can I pay you back later?",
    "explanation": "### **核心词/搭配解释：**\n**Strapped for cash** 手头紧、缺钱；**Pay back** 还钱。\n\n### **表达细节：**\n**Strapped** 比 poor 或 no money 更委婉，暗示这只是暂时的窘迫。这种表达在向熟人开口时既保留了面子，又说明了情况。\n\n### **同义表达：**\n如果想表达由于超支而导致月底没钱了，还可以用 **I'm broke until my next paycheck comes in.**",
    "sceneSuggestion": "shopping",
    "tags": ["购物", "金钱", "尴尬"]
  },
  {
    "translatedText": "学习这事儿真的急不来，得脚踏实地努力。",
    "correctedText": "You can't rush the process; you've just gotta keep your head down and grind.",
    "explanation": "### **核心词/搭配解释：**\n**Rush the process** 操之过急；**Keep your head down** 埋头苦干、保持专注。\n\n### **表达细节：**\n**Grind** 是当代年轻人的努力代名词。这种表达强调了“过程”的重要性，语气务实且充满力量，适合自我激励。\n\n### **同义表达：**\n如果想表达只要坚持下去，最终会看到成果，还可以用 **Hard work will eventually pay off if you stay consistent.**",
    "sceneSuggestion": "learning",
    "tags": ["学习", "励志", "磨砺"]
  },
  {
    "translatedText": "这件衣服穿在你身上特别显瘦，绝了。",
    "correctedText": "That outfit is super flattering on you; it really cinches your waist.",
    "explanation": "### **核心词/搭配解释：**\n**Flattering** 显好的、修饰身材的；**Cinches your waist** 显得腰细、束腰。\n\n### **表达细节：**\n**Flattering** 是时尚点评里的高级词汇。它比 slim 更有礼貌，暗示衣服完美地衬托了人的优点。这句话绝对能让对方开心。\n\n### **同义表达：**\n如果想表达某样东西非常适合对方的气质和身材，还可以用 **You really pull that look off flawlessly.**",
    "sceneSuggestion": "shopping",
    "tags": ["购物", "夸奖", "审美"]
  },
  {
    "translatedText": "我感觉我的脑子快转不动了，需要休息一下。",
    "correctedText": "My brain is officially fried; I definitely need a quick breather.",
    "explanation": "### **核心词/搭配解释：**\n**Fried** 炸了、糊了（形容脑力耗尽）；**Quick breather** 短暂的休息、喘口气。\n\n### **表达细节：**\n**Fried** 是一种极具当代感的吐槽方式，常用于长时间高强度脑力劳动后。**Officially** 增加了一种正式宣告的幽默感。\n\n### **同义表达：**\n如果想表达思维已经停滞、无法再思考，还可以用 **My mental bandwidth is completely maxed out right now.**",
    "sceneSuggestion": "work",
    "tags": ["职场", "疲劳", "脑力"]
  },
  {
    "translatedText": "别老是想那些过去的事，翻篇吧。",
    "correctedText": "Stop living in the past; it's time to close that chapter for good.",
    "explanation": "### **核心词/搭配解释：**\n**Live in the past** 沉溺于过去；**Close that chapter** 翻过那一页、结束那一章。\n\n### **表达细节：**\n**For good** 意为“永远地、彻底地”。将生活比作一本书，这种叙事感的表达比 Forget it 更有治愈和决断的力量。\n\n### **同义表达：**\n如果想表达应该放下负担，开始新的人生，还可以用 **You need to let go of the baggage and move on.**",
    "sceneSuggestion": "emotions",
    "tags": ["治愈", "心态", "翻篇"]
  },
  {
    "translatedText": "这个价格简直是抢劫，我们去别家看看吧。",
    "correctedText": "This price is a total rip-off; let's go check out some other places.",
    "explanation": "### **核心词/搭配解释：**\n**Rip-off** 坑人、敲竹杠；**Check out** 查看、看看。\n\n### **表达细节：**\n**Total rip-off** 表达了强烈的被冒犯感。这在购物场景中非常实用，能瞬间表达出你对价格的不认可。\n\n### **同义表达：**\n如果想表达你觉得这个东西根本不值这个价，还可以用 **I think they're significantly overcharging for this.**",
    "sceneSuggestion": "shopping",
    "tags": ["购物", "避雷", "吐槽"]
  },
  {
    "translatedText": "我就知道他最后会放我鸽子，早习惯了。",
    "correctedText": "I knew he was gonna bail last minute; I'm honestly used to it by now.",
    "explanation": "### **核心词/搭配解释：**\n**Bail** 临时变卦、退出、鸽了；**Used to it** 习惯了。\n\n### **表达细节：**\n**Bail** 比 flaking 更侧重于从某种约定中“逃跑”。这句话充满了无奈和对他人的失望感，常用于背后吐槽不靠谱的朋友。\n\n### **同义表达：**\n如果想表达某人总是习惯性地爽约，还可以用 **He’s a serial flaker, so I didn't expect much.**",
    "sceneSuggestion": "social",
    "tags": ["社交", "放鸽子", "无奈"]
  },
  {
    "translatedText": "由于网速太慢，我刚才掉线了。",
    "correctedText": "I just got kicked off the call because my Wi-Fi is acting up.",
    "explanation": "### **核心词/搭配解释：**\n**Kicked off** 被踢出（指被迫掉线）；**Acting up** 出毛病、不给力。\n\n### **表达细节：**\n**Acting up** 让无生命的 Wi-Fi 听起来像个调皮的孩子。这种拟人化的表达在解释技术故障时既生动又能缓解尴尬。\n\n### **同义表达：**\n如果想表达网络连接非常不稳定，还可以用 **My internet connection is super spotty right now.**",
    "sceneSuggestion": "tech",
    "tags": ["科技", "掉线", "尴尬"]
  },
  {
    "translatedText": "我得赶紧去搞定那个报告，截止日期快到了。",
    "correctedText": "I need to crank out that report; the deadline is breathing down my neck.",
    "explanation": "### **核心词/搭配解释：**\n**Crank out** 快速产出、赶出；**Breathing down my neck** 紧随其后、由于紧迫感而让人感到压力。\n\n### **表达细节：**\n**Crank out** 暗示了由于时间紧迫而不得不高效率工作。**Breathing down my neck** 非常形象地描述了被截止日期逼近的压迫感。\n\n### **同义表达：**\n如果想表达自己正承受着巨大的时间压力，还可以用 **I'm working under a very tight schedule right now.**",
    "sceneSuggestion": "work",
    "tags": ["职场", "压力", "效率"]
  },
  {
    "translatedText": "别老是想那些没用的假设，过好现在。",
    "correctedText": "Stop living in the land of 'what-ifs'; just focus on the here and now.",
    "explanation": "### **核心词/搭配解释：**\n**Land of 'what-ifs'** 幻想出来的忧虑世界；**Here and now** 此时此刻、当下。\n\n### **表达细节：**\n**Land of 'what-ifs'** 带有一种讽刺的意味，暗示对方想得太多且毫无意义。这种表达非常契合当代“活在当下”的正念（Mindfulness）理念。\n\n### **同义表达：**\n如果想表达不要为了还没发生的事情白白焦虑，还可以用 **Don't cross that bridge until you come to it.**",
    "sceneSuggestion": "emotions",
    "tags": ["情感", "正念", "当下"]
  },
  {
    "translatedText": "我最近在戒糖，感觉整个人都清爽了不少。",
    "correctedText": "I’ve been cutting back on sugar lately; I feel way less sluggish.",
    "explanation": "### **核心词/搭配解释：**\n**Cutting back on** 减少摄入/开支；**Sluggish** 形容由于饮食或缺乏睡眠导致的身体沉重、反应迟钝。\n\n### **表达细节：**\n**Sluggish** 比 tired 更有质感，它描述了那种“黏糊糊”的疲惫感。戒糖（Sugar detox）是当代健康生活的热门话题。\n\n### **同义表达：**\n如果想表达彻底戒掉某种习惯，可以用 **I’m trying to go cold turkey on sweets.**",
    "sceneSuggestion": "daily",
    "tags": ["健康", "生活", "自律"]
  },
  {
    "translatedText": "他刚才那个冷笑话直接把场子聊死了。",
    "correctedText": "That dad joke was so cringe; it literally killed the vibe.",
    "explanation": "### **核心词/搭配解释：**\n**Dad joke** 指那种冷幽默或老掉牙的笑话；**Cringe** 尴尬得让人脚趾抠地；**Killed the vibe** 破坏气氛。\n\n### **表达细节：**\n**Cringe** 是当代互联网最核心的形容词之一。当某件事尴尬到让人生理不适时，这个词就是首选。\n\n### **同义表达：**\n如果想表达气氛瞬间变得尴尬，还可以用 **There was a sudden, awkward silence after he spoke.**",
    "sceneSuggestion": "social",
    "tags": ["社交", "吐槽", "尴尬"]
  },
  {
    "translatedText": "别老是听他画大饼，他根本做不到。",
    "correctedText": "Stop falling for his empty promises; he’s just selling you a dream he can’t deliver.",
    "explanation": "### **核心词/搭配解释：**\n**Empty promises** 空头支票/画大饼；**Selling a dream** 描绘虚假的美好前景。\n\n### **表达细节：**\n**Selling a dream** 比 lying 更有画面感，常用于讽刺不靠谱的老板或过度承诺的合作伙伴。\n\n### **同义表达：**\n如果想表达某人只是在夸夸其谈，可以用 **He's all talk and no action.**",
    "sceneSuggestion": "work",
    "tags": ["职场", "避雷", "醒悟"]
  },
  {
    "translatedText": "我得赶紧去充电，我手机只剩下 1% 的电了。",
    "correctedText": "I need to plug in ASAP; my phone is literally clinging to life at 1%.",
    "explanation": "### **核心词/搭配解释：**\n**Plug in** 插上电源；**Clinging to life** 垂死挣扎、命悬一线。\n\n### **表达细节：**\n**Clinging to life** 原本描述重病人，用在电量上有一种极度夸张的幽默感，是当代“电量焦虑”的真实写照。\n\n### **同义表达：**\n如果想表达电量即将耗尽，可以用 **My battery is about to give up the ghost.**",
    "sceneSuggestion": "tech",
    "tags": ["日常", "手机", "夸张"]
  },
  {
    "translatedText": "这事儿你得私下跟我说，别在群里发。",
    "correctedText": "You should DM me about this; don't put it on blast in the group chat.",
    "explanation": "### **核心词/搭配解释：**\n**DM** (Direct Message) 私信；**Put someone on blast** 在公开场合抨击或揭露某人，使其难堪。\n\n### **表达细节：**\n**On blast** 特指那种公开的、不给面子的行为。在网络社交时代，学会区分“私信”和“公开处刑”非常重要。\n\n### **同义表达：**\n如果想表达私下解决问题，可以用 **Let's take this offline and discuss it privately.**",
    "sceneSuggestion": "social",
    "tags": ["社交", "隐私", "群聊"]
  },
  {
    "translatedText": "我刚才也就是随口一猜，没想到居然猜中了。",
    "correctedText": "It was just a shot in the dark, but I actually nailed it.",
    "explanation": "### **核心词/搭配解释：**\n**A shot in the dark** 盲目猜测、瞎猫碰到死耗子；**Nailed it** 完美搞定、做到了。\n\n### **表达细节：**\n**Nailed it** 带有强烈的成就感。这种转折表达了对自己运气的惊讶和自豪。\n\n### **同义表达：**\n如果想表达这是一个纯粹的巧合，可以用 **It was a total fluke that I got it right.**",
    "sceneSuggestion": "daily",
    "tags": ["惊喜", "运气", "日常"]
  },
  {
    "translatedText": "老板现在正在气头上，你最好别去惹他。",
    "correctedText": "The boss is on a warpath right now; you’d better stay out of his way.",
    "explanation": "### **核心词/搭配解释：**\n**On a warpath** 怒气冲冲（仿佛要去打仗）；**Stay out of one's way** 离远点、别惹麻烦。\n\n### **表达细节：**\n**Warpath** 形象地刻画了一个寻找发泄对象的愤怒形象。在职场生存中，识别老板的情绪“天气预报”是必备技能。\n\n### **同义表达：**\n如果想表达某人非常愤怒，可以用 **He’s absolutely livid right now.**",
    "sceneSuggestion": "work",
    "tags": ["职场", "生存", "情绪"]
  },
  {
    "translatedText": "我今天出门没看黄历，真是倒霉透了。",
    "correctedText": "I’m just having a major string of bad luck today; everything is going sideways.",
    "explanation": "### **核心词/搭配解释：**\n**A string of** 一连串；**Go sideways** 事情变糟、偏离轨道。\n\n### **表达细节：**\n**Go sideways** 比 go wrong 更有动态感，暗示事情的发展完全出乎意料且难以控制。\n\n### **同义表达：**\n如果想表达诸事不顺，可以用 **I guess I just woke up on the wrong side of the bed today.**",
    "sceneSuggestion": "daily",
    "tags": ["吐槽", "运气", "倒霉"]
  },
  {
    "translatedText": "别老是想那些有的没的，先做了再说。",
    "correctedText": "Stop getting caught up in the details; just get the ball rolling first.",
    "explanation": "### **核心词/搭配解释：**\n**Getting caught up in** 纠结于、陷入；**Get the ball rolling** 开始行动、启动计划。\n\n### **表达细节：**\n**Get the ball rolling** 是职场非常经典的地道表达，强调“先动起来”比“完美规划”更重要。\n\n### **同义表达：**\n如果想表达不要过度分析，可以用 **Don't fall into the trap of paralysis by analysis.**",
    "sceneSuggestion": "learning",
    "tags": ["行动", "职场", "励志"]
  },
  {
    "translatedText": "他这人太社牛了，跟谁都能聊得来。",
    "correctedText": "He’s such a social butterfly; he can literally strike up a conversation with anyone.",
    "explanation": "### **核心词/搭配解释：**\n**Social butterfly** 社交达人/社牛；**Strike up a conversation** 攀谈、搭讪。\n\n### **表达细节：**\n虽然 **Social butterfly** 偏传统，但在 2026 年依然是描述高社交能量者的地道词汇。它带有一种轻盈、自如的褒义。\n\n### **同义表达：**\n如果想表达某人非常外向，可以用 **He's a major extrovert who thrives in crowds.**",
    "sceneSuggestion": "social",
    "tags": ["社交", "性格", "社牛"]
  },
  {
    "translatedText": "我真的很想躺平，这种内卷生活我受够了。",
    "correctedText": "I’m so over this rat race; I honestly just want to opt out and live a simple life.",
    "explanation": "### **核心词/搭配解释：**\n**Rat race** 无意义的激烈竞争（内卷）；**Opt out** 选择退出、不参与。\n\n### **表达细节：**\n**Rat race** 是描述现代社会压力的经典词汇。**Opt out** 体现了一种主动选择的姿态，比 simply quitting 更有力量感。\n\n### **同义表达：**\n如果想表达想要彻底放松、不再奋斗，可以用 **I just want to embrace a slow-paced lifestyle.**",
    "sceneSuggestion": "work",
    "tags": ["内卷", "职场", "心态"]
  },
  {
    "translatedText": "这个价格太香了，不买真的亏大了。",
    "correctedText": "This deal is a complete steal; it’d be a crime to pass it up.",
    "explanation": "### **核心词/搭配解释：**\n**A steal** 便宜得像偷来的一样；**Pass it up** 错过、放弃（机会）。\n\n### **表达细节：**\n使用 **It’d be a crime** 是一种强烈的夸张法，表达了由于物超所值而产生的极强购买冲动。\n\n### **同义表达：**\n如果想表达性价比极高，可以用 **It's incredible value for money.**",
    "sceneSuggestion": "shopping",
    "tags": ["购物", "优惠", "超值"]
  },
  {
    "translatedText": "他刚才那个眼神，我感觉他在阴阳怪气我。",
    "correctedText": "The way he looked at me was so shady; I feel like he was low-key throwing shade.",
    "explanation": "### **核心词/搭配解释：**\n**Shady** 可疑的、不正派的；**Throwing shade** 阴阳怪气、冷嘲热讽。\n\n### **表达细节：**\n**Throwing shade** 是现代流行语中描述“阴阳怪气”最精准的词。它通常指那种不带脏字但杀伤力极强的讽刺。\n\n### **同义表达：**\n如果想表达对方说话尖酸刻薄，可以用 **His remarks were quite snarky and passive-aggressive.**",
    "sceneSuggestion": "social",
    "tags": ["社交", "直觉", "冲突"]
  },
  {
    "translatedText": "我得赶紧去复习了，考试要挂了。",
    "correctedText": "I need to hit the books ASAP; otherwise, I’m definitely gonna flunk.",
    "explanation": "### **核心词/搭配解释：**\n**Hit the books** 开始用功读书；**Flunk** 挂科、不及格。\n\n### **表达细节：**\n**Hit the books** 带有某种决绝的仪式感。**Flunk** 是学生群体中极高频的非正式表达。\n\n### **同义表达：**\n如果想表达通宵熬夜赶进度，可以用 **I'll probably have to pull an all-nighter to catch up.**",
    "sceneSuggestion": "learning",
    "tags": ["学习", "焦虑", "考试"]
  },
  {
    "translatedText": "别在那儿婆婆妈妈的，有话直说。",
    "correctedText": "Stop beating around the bush; just give it to me straight.",
    "explanation": "### **核心词/搭配解释：**\n**Beating around the bush** 拐弯抹角、顾左右而言他；**Give it to me straight** 直说吧、别绕弯子。\n\n### **表达细节：**\n这是一种要求高效沟通的语气。在职场或紧急社交情况下，这种表达能迅速让对话进入实质性阶段。\n\n### **同义表达：**\n如果想表达开门见山，可以用 **Let's just get straight to the point.**",
    "sceneSuggestion": "social",
    "tags": ["沟通", "果断", "直接"]
  },
  {
    "translatedText": "我昨天又熬夜了，现在感觉魂儿都没了。",
    "correctedText": "I pulled another all-nighter; I feel like a literal zombie right now.",
    "explanation": "### **核心词/搭配解释：**\n**Pull an all-nighter** 通宵工作或学习；**Zombie** 僵尸（形容极度疲倦、没有活力的状态）。\n\n### **表达细节：**\n**Literal zombie** 是现代人睡眠不足后的标配形容词。它精准描述了那种只有躯壳在移动、大脑停止运转的状态。\n\n### **同义表达：**\n如果想表达精疲力竭，可以用 **I'm totally burnt out after that marathon shift.**",
    "sceneSuggestion": "daily",
    "tags": ["疲劳", "睡眠", "自嘲"]
  },
  {
    "translatedText": "这个博主的内容很干货，值得关注。",
    "correctedText": "This influencer posts some high-value content; definitely worth a follow.",
    "explanation": "### **核心词/搭配解释：**\n**High-value** 高价值、干货；**Worth a follow** 值得关注。\n\n### **表达细节：**\n“干货”在英文中没有对应的单名词，通常用 **High-value** 或 **Informative**。**Worth a follow** 是社交媒体语境下的标准推荐语。\n\n### **同义表达：**\n如果想表达内容非常实用，可以用 **Her posts are always packed with actionable advice.**",
    "sceneSuggestion": "tech",
    "tags": ["社交媒体", "推荐", "学习"]
  },
  {
    "translatedText": "别老是跟我画饼，直接说能给多少钱。",
    "correctedText": "Cut the corporate talk; just tell me the bottom line regarding the salary.",
    "explanation": "### **核心词/搭配解释：**\n**Corporate talk** 职场套话/黑话；**The bottom line** 底线、最核心的信息（通常指钱或结果）。\n\n### **表达细节：**\n**Cut the...** 是要求停止某种虚伪行为的强硬表达。**Bottom line** 展现了你作为一个务实职业人的立场。\n\n### **同义表达：**\n如果想表达别兜圈子，可以用 **Don't sugarcoat it; let's talk numbers.**",
    "sceneSuggestion": "work",
    "tags": ["职场", "金钱", "直接"]
  },
  {
    "translatedText": "我刚才真的尴尬得想找个地缝钻进去。",
    "correctedText": "I was so mortified; I literally wanted the ground to swallow me whole.",
    "explanation": "### **核心词/搭配解释：**\n**Mortified** 极其尴尬、羞愧欲死；**Ground to swallow me whole** 恨不得有地缝钻进去。\n\n### **表达细节：**\n**Mortified** 比 embarrassed 程度深得多，通常指那种让你事后想起来都会老脸一红的瞬间。\n\n### **同义表达：**\n如果想表达极度尴尬，可以用 **That was hands down the most cringeworthy moment of my life.**",
    "sceneSuggestion": "social",
    "tags": ["尴尬", "情绪", "日常"]
  },
  {
    "translatedText": "他这人太双标了，对自己一套对别人一套。",
    "correctedText": "He’s got such a double standard; one rule for him and another for everyone else.",
    "explanation": "### **核心词/搭配解释：**\n**Double standard** 双重标准/双标。\n\n### **表达细节：**\n这种表达非常理性且具有批判性。**One rule for... and another for...** 结构清晰地解释了为什么对方是双标。\n\n### **同义表达：**\n如果想表达虚伪，可以用 **He doesn't practice what he preaches.**",
    "sceneSuggestion": "social",
    "tags": ["吐槽", "社交", "公正"]
  },
  {
    "translatedText": "这款香水味道太高级了，闻起来很有钱。",
    "correctedText": "This perfume smells so expensive; it’s giving major old-money vibes.",
    "explanation": "### **核心词/搭配解释：**\n**Smells expensive** 闻起来高级；**Old-money vibes** 老钱风、低调奢华的气息。\n\n### **表达细节：**\n**It's giving...** 是近年极火的句式，相当于“有种...的感觉”。**Old-money** 代表了 2020 年代中期的一种审美巅峰。\n\n### **同义表达：**\n如果想表达香味很独特，可以用 **This scent is incredibly sophisticated and unique.**",
    "sceneSuggestion": "shopping",
    "tags": ["审美", "时尚", "评价"]
  },
  {
    "translatedText": "由于这个突发状况，我们得随时待命了。",
    "correctedText": "Because of this emergency, we need to be on standby 24/7.",
    "explanation": "### **核心词/搭配解释：**\n**On standby** 待命状态；**24/7** 全天候、随时。\n\n### **表达细节：**\n**24/7** 是现代职场和生活的常态描述，带有一种无法彻底关机的紧迫感和疲惫感。\n\n### **同义表达：**\n如果想表达必须保持联系畅通，可以用 **I need to be reachable at all times in case something happens.**",
    "sceneSuggestion": "work",
    "tags": ["职场", "紧急", "压力"]
  },
  {
    "translatedText": "我刚才也就是开个玩笑，你别往心里去。",
    "correctedText": "I was only joking; please don't take it to heart.",
    "explanation": "### **核心词/搭配解释：**\n**Take it to heart** 介意、往心里去、为此感到受伤。\n\n### **表达细节：**\n这是一种经典的缓和语气。当你发现玩笑开过火时，及时说这句话能有效修补社交裂痕。\n\n### **同义表达：**\n如果想表达只是开玩笑，可以用 **I was just pulling your leg; no offense intended.**",
    "sceneSuggestion": "social",
    "tags": ["社交", "道歉", "解释"]
  },
  {
    "translatedText": "学习不能只会刷题，要学会举一反三。",
    "correctedText": "It’s not just about grinding practice problems; you need to learn how to apply the concepts elsewhere.",
    "explanation": "### **核心词/搭配解释：**\n**Grinding** 机械重复地做某事；**Apply concepts elsewhere** 将概念应用到别处（即举一反三）。\n\n### **表达细节：**\n英文中没有直接对应“举一反三”的成语，通常用 **Apply / Generalize knowledge** 来表达。这种说法更符合逻辑分析的语境。\n\n### **同义表达：**\n如果想表达触类旁通，可以用 **You need to connect the dots between different topics.**",
    "sceneSuggestion": "learning",
    "tags": ["学习", "方法", "深度"]
  },
  {
    "translatedText": "别在这儿刷存在感了，没人理你。",
    "correctedText": "Stop clout-chasing; literally no one is paying attention to you.",
    "explanation": "### **核心词/搭配解释：**\n**Clout-chasing** 蹭热度、刷存在感（为了名利或关注度）。\n\n### **表达细节：**\n**Clout-chasing** 是社交媒体时代的专属词汇，带有强烈的鄙视感，指责对方行为虚伪、急功近利。\n\n### **同义表达：**\n如果想表达某人只是想引起注意，可以用 **He's just doing it for attention, honestly.**",
    "sceneSuggestion": "social",
    "tags": ["社交", "吐槽", "热度"]
  },
  {
    "translatedText": "我昨天本来想省钱的，结果又剁手了。",
    "correctedText": "I planned to save money, but I ended up splurging on stuff I don't need.",
    "explanation": "### **核心词/搭配解释：**\n**Splurging** 挥霍、乱花钱（常指买奢侈品或非必需品）；**Ended up** 最终却（强调意外结果）。\n\n### **表达细节：**\n**Splurge** 捕捉了那种消费时的快感和事后的心痛感。这比 buy things 更有情绪张力。\n\n### **同义表达：**\n如果想表达乱花钱，可以用 **I’m just burning a hole in my pocket today.**",
    "sceneSuggestion": "shopping",
    "tags": ["购物", "剁手", "自嘲"]
  },
  {
    "translatedText": "他这人太会察言观色了，真是个老油条。",
    "correctedText": "He’s so good at reading the room; he’s a total old hand at this.",
    "explanation": "### **核心词/搭配解释：**\n**Reading the room** 察言观色、看气氛；**Old hand** 老手、经验丰富的人（褒贬取决于语境）。\n\n### **表达细节：**\n**Reading the room** 是一项极其重要的社交技能。**Old hand** 比 old bird 更地道，指在某个领域混迹多年、极其圆滑的人。\n\n### **同义表达：**\n如果想表达某人非常世故，可以用 **He’s very street-smart and knows how to play the game.**",
    "sceneSuggestion": "work",
    "tags": ["职场", "社交", "情商"]
  },
  {
    "translatedText": "我真的很想去那个音乐节，可惜没抢到票。",
    "correctedText": "I’m dying to go to that festival, but the tickets sold out in a heartbeat.",
    "explanation": "### **核心词/搭配解释：**\n**Dying to** 极想做某事；**In a heartbeat** 一瞬间、极快地。\n\n### **表达细节：**\n**In a heartbeat** 表现了票务竞争的激烈程度。这种表达比 very fast 更有画面感，能体现出那种错失机会的遗憾。\n\n### **同义表达：**\n如果想表达票很难买，可以用 **It was a total bloodbath trying to get those tickets.**",
    "sceneSuggestion": "hobbies",
    "tags": ["音乐", "遗憾", "日常"]
  },
  {
    "translatedText": "别老是这么死脑筋，变通一下行不行？",
    "correctedText": "Don’t be so rigid; you need to learn how to pivot when things change.",
    "explanation": "### **核心词/搭配解释：**\n**Rigid** 死板的、僵硬的；**Pivot** 变通、转向（原指篮球动作，现为职场流行语）。\n\n### **表达细节：**\n**Pivot** 是当代创业和职场中最推崇的能力之一。这种表达让你的建议听起来既专业又具有前瞻性。\n\n### **同义表达：**\n如果想表达要灵活，可以用 **You have to stay flexible and roll with the changes.**",
    "sceneSuggestion": "work",
    "tags": ["思维", "变通", "建议"]
  },
  {
    "translatedText": "我感觉我现在的状态好极了，正处在巅峰期。",
    "correctedText": "I feel like I'm in my prime right now; I’m totally peaking.",
    "explanation": "### **核心词/搭配解释：**\n**In my prime** 在巅峰期、黄金时代；**Peaking** 达到顶点。\n\n### **表达细节：**\n这是一种充满自信的宣告。**Peaking** 既可以指事业，也可以指颜值或竞技状态，是非常正向的自我肯定。\n\n### **同义表达：**\n如果想表达状态极佳，可以用 **I’m at the top of my game lately.**",
    "sceneSuggestion": "emotions",
    "tags": ["自信", "成功", "状态"]
  },
  {
    "translatedText": "我最近在尝试数字排毒，减少刷手机的时间。",
    "correctedText": "I’m trying a digital detox lately; I really need to cut down my screen time.",
    "explanation": "### **核心词/搭配解释：**\n**Digital detox** 指数字排毒，即一段时间内停止使用电子设备；**Screen time** 屏幕使用时间。\n\n### **表达细节：**\n这是 2026 年非常健康的生活趋势。相比 I don't use phone，**Digital detox** 听起来更像是一种有意识的自我调节和心理建设。\n\n### **同义表达：**\n如果想表达彻底断网，可以用 **I’m going off the grid for a few days.**",
    "sceneSuggestion": "daily",
    "tags": ["健康", "科技", "自律"]
  },
  {
    "translatedText": "他这人说话非常有分量，大家都听他的。",
    "correctedText": "His words carry a lot of weight; everyone looks to him for direction.",
    "explanation": "### **核心词/搭配解释：**\n**Carry weight** 说话有分量、有影响力；**Look to someone for** 指望某人提供（指导、方向等）。\n\n### **表达细节：**\n这是一种高级的赞美。**Carry weight** 暗示这种影响力是基于资历、专业度或人格魅力累积而来的，非常地道的职场评价。\n\n### **同义表达：**\n如果想表达某人是该领域的权威，可以用 **He is a major authority in this field.**",
    "sceneSuggestion": "work",
    "tags": ["职场", "影响力", "赞美"]
  },
  {
    "translatedText": "别老是想那些还没发生的坏事，别自己吓自己。",
    "correctedText": "Stop borrowing trouble from tomorrow; you're just psyching yourself out.",
    "explanation": "### **核心词/搭配解释：**\n**Borrowing trouble** 庸人自扰、为未来担忧；**Psyching someone out** 从心理上击败某人，这里指“自己吓唬自己导致失去信心”。\n\n### **表达细节：**\n**Borrowing trouble** 是一个非常有哲理的成语。**Psyching yourself out** 则精准描述了那种因为过度思虑而产生的心理崩溃。\n\n### **同义表达：**\n如果想表达别过度焦虑，可以用 **Don't let your imagination run wild with worst-case scenarios.**",
    "sceneSuggestion": "emotions",
    "tags": ["情感", "安慰", "心理"]
  },
  {
    "translatedText": "我刚才真的被他气笑了，简直不可理喻。",
    "correctedText": "I was so done with him that I just had to laugh; he’s being totally unreasonable.",
    "explanation": "### **核心词/搭配解释：**\n**So done with** 受够了、无语到了极点；**Unreasonable** 不可理喻、不讲道理。\n\n### **表达细节：**\n**I am so done** 表达了一种放弃沟通的无奈。在这种语境下，“笑”不是因为开心，而是因为荒谬。\n\n### **同义表达：**\n如果想表达对方简直不可思议，可以用 **I can't even wrap my head around his logic.**",
    "sceneSuggestion": "social",
    "tags": ["社交", "吐槽", "情绪"]
  },
  {
    "translatedText": "这款软件用起来很丝滑，用户体验绝了。",
    "correctedText": "This app is so buttery smooth; the UX is just next-level.",
    "explanation": "### **核心词/搭配解释：**\n**Buttery smooth** 像黄油般丝滑（常形容屏幕刷新率或软件操作）；**Next-level** 极高水准、更上一层楼。\n\n### **表达细节：**\n**Buttery smooth** 是科技圈最地道的形容词。如果你想夸一个产品的交互设计，**Next-level** 比 simple 或 great 要高级得多。\n\n### **同义表达：**\n如果想表达无缝衔接，可以用 **The integration is completely seamless.**",
    "sceneSuggestion": "tech",
    "tags": ["科技", "评价", "专业"]
  },
  {
    "translatedText": "我得赶紧去补救一下，不然这事儿就搞砸了。",
    "correctedText": "I need to do some damage control ASAP, or this whole thing is toast.",
    "explanation": "### **核心词/搭配解释：**\n**Damage control** 危机公关、补救措施；**Toast** 完蛋了、彻底坏了（像烤焦的面包）。\n\n### **表达细节：**\n**Damage control** 原本是公关术语，但在日常职场中非常常用。**Toast** 是一种幽默且带点绝望色彩的说法。\n\n### **同义表达：**\n如果想表达事情无可挽回，可以用 **It's a total train wreck at this point.**",
    "sceneSuggestion": "work",
    "tags": ["职场", "补救", "紧急"]
  },
  {
    "translatedText": "他平时深藏不露，关键时刻真靠得住。",
    "correctedText": "He’s such a dark horse; he really steps up when it counts.",
    "explanation": "### **核心词/搭配解释：**\n**Dark horse** 黑马、深藏不露的人；**Steps up** 挺身而出、发挥作用；**When it counts** 在关键时刻。\n\n### **表达细节：**\n**Dark horse** 指平时不显眼但在重要关头表现出众的人。**Steps up** 强调了行动力和责任感。\n\n### **同义表达：**\n如果想表达某人很可靠，可以用 **He is a real rock when things get tough.**",
    "sceneSuggestion": "social",
    "tags": ["性格", "赞美", "可靠"]
  },
  {
    "translatedText": "别老是这么死板，规则是死的，人是活的。",
    "correctedText": "Don't be such a stickler for rules; they're meant to be flexible.",
    "explanation": "### **核心词/搭配解释：**\n**Stickler** 坚持己见的人、死扣细节的人；**Flexible** 灵活的、可变通的。\n\n### **表达细节：**\n**Stickler for rules** 带有轻微的贬义，暗示对方不懂变通，让人感到压抑或麻烦。\n\n### **同义表达：**\n如果想表达要根据情况调整，可以用 **We need to play it by ear depending on the situation.**",
    "sceneSuggestion": "work",
    "tags": ["沟通", "思维", "变通"]
  },
  {
    "translatedText": "我昨天被那个博主种草了，买了全套护肤品。",
    "correctedText": "That influencer totally influenced me; I ended up buying the whole skincare set.",
    "explanation": "### **核心词/搭配解释：**\n**Influenced** 被影响（对应“种草”）；**Skincare set** 护肤套装。\n\n### **表达细节：**\n英文中没有“种草”的直接对应词，但用 **Influenced** 或 **Sold on** 最贴切。2026 年，这种基于信任的消费非常普遍。\n\n### **同义表达：**\n如果想表达非常想要某样东西，可以用 **I’ve had my eye on that set for a while now.**",
    "sceneSuggestion": "shopping",
    "tags": ["购物", "种草", "社交媒体"]
  },
  {
    "translatedText": "我感觉我现在的灵感爆发了，拦都拦不住。",
    "correctedText": "I’m having a massive brain wave right now; I’m on a total creative roll.",
    "explanation": "### **核心词/搭配解释：**\n**Brain wave** 灵光一现、突然的好主意；**On a roll** 接连取得成功、势不可挡。\n\n### **表达细节：**\n**On a roll** 原指赌博中的连赢，现广泛用于形容状态极佳、灵感源源不断的时刻。\n\n### **同义表达：**\n如果想表达创意十足，可以用 **The ideas are just flowing out of me today.**",
    "sceneSuggestion": "learning",
    "tags": ["灵感", "创作", "状态"]
  },
  {
    "translatedText": "他这人太小心眼了，一点小事记恨好几年。",
    "correctedText": "He’s so petty; he’ll hold a grudge over the smallest things for years.",
    "explanation": "### **核心词/搭配解释：**\n**Petty** 小心眼的、琐碎的；**Hold a grudge** 记仇、怀恨在心。\n\n### **表达细节：**\n**Petty** 是社交吐槽中的高频词，形容一个人气量狭小。**Hold a grudge** 则生动描述了这种情绪的长久性。\n\n### **同义表达：**\n如果想表达对方不够大方，可以用 **He really needs to learn how to let things go.**",
    "sceneSuggestion": "social",
    "tags": ["社交", "吐槽", "性格"]
  },
  {
    "translatedText": "这个项目我打算全程跟进，确保万无一失。",
    "correctedText": "I’m going to stay on top of this project to make sure nothing slips through the cracks.",
    "explanation": "### **核心词/搭配解释：**\n**Stay on top of** 掌控、跟进；**Slip through the cracks** 被遗漏、出错。\n\n### **表达细节：**\n**Stay on top of** 展现了极强的责任心。**Slip through the cracks** 形象地描述了在复杂流程中可能出现的小疏忽。\n\n### **同义表达：**\n如果想表达严格监控，可以用 **I'll be keeping a very close eye on the progress.**",
    "sceneSuggestion": "work",
    "tags": ["职场", "责任", "管理"]
  },
  {
    "translatedText": "我真的很想戒掉熬夜，但一刷手机就停不下来。",
    "correctedText": "I really want to stop staying up late, but I always get sucked into a social media rabbit hole.",
    "explanation": "### **核心词/搭配解释：**\n**Sucked into** 被卷入、无法自拔；**Rabbit hole** 兔子洞（指一旦进入就深陷其中、浪费大量时间的事情）。\n\n### **表达细节：**\n**Rabbit hole** 完美形容了短视频或社交媒体带给人的“时间黑洞”感，非常有现代感且地道。\n\n### **同义表达：**\n如果想表达被手机控制，可以用 **I'm literally addicted to my phone, it's a problem.**",
    "sceneSuggestion": "daily",
    "tags": ["生活", "手机", "自嘲"]
  },
  {
    "translatedText": "我想说走就走",
    "correctedText": "I want a spontaneous trip.",
    "explanation": "### **核心词/搭配解释：**\n**Spontaneous** 意为“自发的、心血来潮的”。在旅游语境下，它精准对应“说走就走”，即没有任何预设计划的旅行。\n\n### **表达细节：**\n这比 I want to go now 更有格调。在 2026 年，这代表了一种反抗特种兵式打卡、追求自由与惊喜的旅行态度。\n\n### **同义表达：**\n如果想表达自由自在的出发，可以用 **Let's just pack up and go.**",
    "sceneSuggestion": "travel",
    "tags": ["自由", "心态", "旅行"]
  },
  {
    "translatedText": "这地方太出片了",
    "correctedText": "This place is incredibly photogenic.",
    "explanation": "### **核心词/搭配解释：**\n**Photogenic** 意为“上镜的”。形容风景、建筑或光影非常适合拍照，随手一拍都是大片。\n\n### **表达细节：**\n这是旅行博主（Travel Vlogger）的口头禅。与其说 Beautiful，不如说 photogenic，侧重于视觉产出的高质量。\n\n### **同义表达：**\n如果想表达拍照好看，可以用 **It's totally Instagram-worthy.**",
    "sceneSuggestion": "travel",
    "tags": ["拍照", "安利", "旅行"]
  },
  {
    "translatedText": "这简直是避世天堂",
    "correctedText": "This is a perfect getaway.",
    "explanation": "### **核心词/搭配解释：**\n**Getaway** 意为“逃离、短假”。指那些远离喧嚣、能让人彻底放松身心的小众目的地。\n\n### **表达细节：**\n这是一种带有治愈感的描述。它暗示了旅行的目的不仅是看风景，更是为了躲避世俗压力（Escape from reality）。\n\n### **同义表达：**\n如果想表达绝佳的避世小岛或庄园，可以用 **It's a true hidden sanctuary.**",
    "sceneSuggestion": "travel",
    "tags": ["放松", "赞美", "旅行"]
  }
];

// Helper to find an exact matching or high-confidence inspiration item
export function findInspirationMatch(text: string): InspirationItem | undefined {
  if (!text) return undefined;
  const clean = text.trim().toLowerCase().replace(/[，。？！,.?!'’"“”\s]/g, '');
  if (!clean) return undefined;
  
  // 1. Exact match (ignoring punctuation & whitespace)
  const exact = INSPIRATION_DATA.find((item) => {
    const itemZhClean = item.translatedText.toLowerCase().replace(/[，。？！,.?!'’"“”\s]/g, '');
    const itemEnClean = item.correctedText.toLowerCase().replace(/[，。？！,.?!'’"“”\s]/g, '');
    return itemZhClean === clean || itemEnClean === clean;
  });
  if (exact) return exact;

  // 2. High-confidence distinctive key phrases (only when very close match)
  const keywordMatch = INSPIRATION_DATA.find((item) => {
    const itemZhClean = item.translatedText.toLowerCase().replace(/[，。？！,.?!'’"“”\s]/g, '');
    if (clean === '脚不沾地' || clean === '忙得脚不沾地') {
      return itemZhClean.includes('脚不沾地');
    }
    if (clean === '味道绝了' || clean === '绝了味道') {
      return itemZhClean.includes('味道') && itemZhClean.includes('绝了');
    }
    return false;
  });
  if (keywordMatch) return keywordMatch;

  return undefined;
}

// Convert an InspirationItem to SpokenOptimizationResult
export function inspirationToOptimizationResult(
  item: InspirationItem,
  originalInput?: string
): {
  original: string;
  natural: string;
  category: CardCategory;
  tags: string[];
  explanation: string;
  phrases: PhraseItem[];
  variants?: {
    casual: string;
    neutral: string;
    formal: string;
  };
  redHighlights?: string[];
} {
  const phrases: PhraseItem[] = [];
  const termMatches = item.explanation.match(/\*\*([^*]+)\*\*/g) || [];
  const uniqueTerms = Array.from(
    new Set(termMatches.map((t) => t.replace(/\*\*/g, '').trim()))
  ).filter(
    (t) =>
      t.length > 0 &&
      !['核心词/搭配解释：', '表达细节：', '同义表达：', '核心词/搭配解释', '表达细节', '同义表达'].includes(t)
  );

  uniqueTerms.slice(0, 3).forEach((term) => {
    phrases.push({
      phrase: term,
      pos: '核心搭配',
      meaning: '地道母语高频用法',
      example: item.correctedText,
    });
  });

  return {
    original: originalInput || item.translatedText,
    natural: item.correctedText,
    category: SCENE_CATEGORY_MAP[item.sceneSuggestion] || '日常家务',
    tags:
      item.tags && item.tags.length > 0
        ? item.tags.slice(0, 3).map((t) => (t.length > 2 ? t.slice(0, 2) : t))
        : ['表达', '日常'],
    explanation: item.explanation,
    phrases:
      phrases.length > 0
        ? phrases
        : [
            {
              phrase: item.correctedText.split(';')[0] || item.correctedText,
              pos: '地道短语',
              meaning: item.translatedText,
              example: item.correctedText,
            },
          ],
    variants: {
      casual: item.correctedText,
      neutral: item.correctedText,
      formal: item.correctedText,
    },
    redHighlights: pickItemHighlights(item.correctedText, uniqueTerms),
  };
}

// Convert an InspirationItem directly to a rich FlashCard for study/review/archive
export function createCardFromInspiration(item: InspirationItem): FlashCard {
  const phrases: PhraseItem[] = [];
  
  // Extract key terms formatted as **Term** inside the explanation markdown
  const termMatches = item.explanation.match(/\*\*([^*]+)\*\*/g) || [];
  const uniqueTerms = Array.from(
    new Set(termMatches.map((t) => t.replace(/\*\*/g, '').trim()))
  ).filter(
    (t) =>
      t.length > 0 &&
      !['核心词/搭配解释：', '表达细节：', '同义表达：', '核心词/搭配解释', '表达细节', '同义表达'].includes(t)
  );

  uniqueTerms.slice(0, 3).forEach((term) => {
    phrases.push({
      phrase: term,
      pos: '核心搭配',
      meaning: '地道母语高频用法',
      example: item.correctedText,
    });
  });

  return {
    id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    original: item.translatedText,
    natural: item.correctedText,
    colloquial: item.correctedText,
    formal: item.correctedText,
    explanation: item.explanation,
    category: SCENE_CATEGORY_MAP[item.sceneSuggestion] || '地道表达',
    tags: item.tags && item.tags.length > 0 ? item.tags : ['地道表达'],
    phrases:
      phrases.length > 0
        ? phrases
        : [
            {
              phrase: item.correctedText.split(';')[0] || item.correctedText,
              pos: '地道短语',
              meaning: item.translatedText,
              example: item.correctedText,
            },
          ],
    createdAt: new Date().toISOString(),
    nextReviewAt: new Date().toISOString(),
    intervalStage: 0,
    reviewCount: 0,
    masteryLevel: 'learning',
    isFavorite: false,
    readCount: 0,
    redHighlights: pickItemHighlights(item.correctedText, uniqueTerms),
  };
}
