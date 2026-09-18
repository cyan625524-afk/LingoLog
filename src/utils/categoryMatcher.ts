// ⚠️ 本文件在云平台 serverless 的导入链上（server.ts → 这里），相对导入必须带 .js 后缀。
// Vite / esbuild 会把 "./x.js" 解析回 x.ts，前端构建不受影响。
import { CardCategory, CARD_CATEGORIES } from '../types.js';

export const CATEGORY_KEYWORDS: Record<CardCategory, string[]> = {
  '饮食健康': ['餐厅', '味道', '吃饭', '做饭', '美食', '味蕾', '甜点', '美味', '健康', '运动', '养生', '减肥', '早餐', '午餐', '晚餐', '零食', '饮料', '酸奶', '医疗', '身体'],
  '职场办公': ['工作', '职场', '项目', '会议', '办公', '加班', '老板', '同事', '面试', '汇报', '业绩', '薪资', '简历', '上班', '下班', '请假', '商务'],
  '社交聚会': ['朋友', '聊天', '聚会', '社交', '约会', '派对', '聚餐', '认识', '交友', '饭局', '酒吧', '客套'],
  '购物消费': ['买东西', '花钱', '账单', '购物', '打折', '省钱', '预算', '网购', '优惠', '种草', '下单', '退货', '快递', '开销'],
  '出行旅游': ['旅游', '出门', '开车', '坐车', '航班', '旅行', '酒店', '景点', '度假', '通勤', '地铁', '打车', '堵车', '高铁', '交通'],
  '学习提升': ['学习', '考试', '阅读', '读书', '英语', '课程', '知识', '技能', '培训', '作业', '论文', '备考', '专业', '学术'],
  '情感表达': ['情感', '表达', '心情', '疲惫', '开心', '难过', '焦虑', '情绪', '压力', '烦恼', '伤心', '兴奋', '生气', '感动', '孤独', '幸福', '恋爱', '自嘲', '安慰', '心态'],
  '科技生活': ['AI', '网络', '电脑', '手机', '数码', '科技', '软件', '程序', '代码', 'APP', '充电', '网速', '编程', 'bug'],
  '兴趣爱好': ['爱好', '兴趣', '游戏', '音乐', '电影', '摄影', '画画', '健身', '跑步', '追剧', '视频', '娱乐', 'vlog'],
  '日常家务': ['家务', '日常', '生活', '作息', '杂事', '打扫', '洗衣', '洗衣服', '睡觉', '起床', '打扫卫生', '整理'],
};

export const ENGLISH_CATEGORY_MAP: Record<string, CardCategory> = {
  food: '饮食健康',
  diet: '饮食健康',
  health: '饮食健康',
  tech: '科技生活',
  technology: '科技生活',
  code: '科技生活',
  coding: '科技生活',
  travel: '出行旅游',
  trip: '出行旅游',
  tour: '出行旅游',
  daily: '日常家务',
  routine: '日常家务',
  life: '日常家务',
  housework: '日常家务',
  learning: '学习提升',
  study: '学习提升',
  education: '学习提升',
  hobbies: '兴趣爱好',
  hobby: '兴趣爱好',
  leisure: '兴趣爱好',
  game: '兴趣爱好',
  emotions: '情感表达',
  emotion: '情感表达',
  feeling: '情感表达',
  mood: '情感表达',
  shopping: '购物消费',
  shop: '购物消费',
  buy: '购物消费',
  social: '社交聚会',
  friends: '社交聚会',
  chat: '社交聚会',
  work: '职场办公',
  office: '职场办公',
  business: '职场办公',
  job: '职场办公',
};

/**
 * 根据文本内容智能打分匹配所属场景分类
 */
export function detectCategory(text: string): CardCategory {
  if (!text || typeof text !== 'string') return '日常家务';

  let bestCategory: CardCategory = '日常家务';
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [CardCategory, string[]][]) {
    let score = 0;
    for (const kw of keywords) {
      if (text.includes(kw)) {
        score += Math.max(2, kw.length); // 越长的关键词命中权重越高
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

/**
 * 将任意场景输入（如旧版本字段、英文名称、模糊匹配）规范化为 10 大固定分类之一
 */
export function normalizeCategory(cat?: string): CardCategory {
  if (!cat) return '日常家务';
  const trimmed = cat.trim();
  if (CARD_CATEGORIES.includes(trimmed as CardCategory)) {
    return trimmed as CardCategory;
  }

  // 1. 尝试英文小写匹配
  const lower = trimmed.toLowerCase();
  if (ENGLISH_CATEGORY_MAP[lower]) {
    return ENGLISH_CATEGORY_MAP[lower];
  }

  // 2. 尝试根据关键词打分匹配
  const detected = detectCategory(trimmed);
  if (detected) return detected;

  return '日常家务';
}

/**
 * 根据分类和文本推导默认 2 字标签
 */
export function detectDefaultTags(text: string, category: CardCategory): string[] {
  const tagMap: Record<CardCategory, string[]> = {
    '饮食健康': ['美食', '就餐'],
    '职场办公': ['职场', '效率'],
    '社交聚会': ['社交', '交流'],
    '购物消费': ['购物', '消费'],
    '出行旅游': ['旅行', '出行'],
    '学习提升': ['学习', '提升'],
    '情感表达': ['心情', '感受'],
    '科技生活': ['科技', '数码'],
    '兴趣爱好': ['爱好', '生活'],
    '日常家务': ['日常', '家务'],
  };
  return tagMap[category] || ['表达', '日常'];
}
