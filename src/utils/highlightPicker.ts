/**
 * 红色色带「重点词」挑选器。
 *
 * 背景：原先所有保底路径（server.ts 三条 + StudyView 两处 + inspirationData 一处）都是
 * 「取句子开头的 1-2 个词」。这在英文里几乎必然挑错 —— 句子开头通常是
 * I / It / This / My / The 这类功能词，语义信息量最低，恰恰是最不该记的东西。
 * 红字标在 "I'm" 上等于没标。
 *
 * 这里改成按语义分量挑：
 *   1) 短语动词 / 惯用搭配（实义词 + 小品词）—— staying up / pile up / circle back
 *   2) 相邻实义词组（动词+宾语 / 形容词+名词），取信息量最大的一组
 *   3) 兜底：句中最长的单个实义词
 *
 * 返回的片段**逐字来自原句**（保留原大小写与词形），因为渲染层用 indexOf 做精确匹配，
 * 一旦改词形就匹配不上，红字会整段消失。
 */

// 功能词：代词、冠词、助动词、连接词、常见程度副词。
// 单独出现时一律不作为重点。
const FUNCTION_WORDS = new Set([
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'its', 'our', 'their', 'mine', 'yours', 'theirs',
  'this', 'that', 'these', 'those', 'there', 'here',
  'the', 'a', 'an', 'and', 'or', 'but', 'so', 'if', 'as', 'than', 'then',
  'because', 'while', 'when', 'what', 'which', 'who', 'whom', 'whose', 'how', 'why',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'have', 'has', 'had', 'having',
  'will', 'would', 'can', 'could', 'shall', 'should', 'may', 'might', 'must', 'ought',
  'not', 'no', 'yes', 'yeah', 'oh', 'hey', 'okay', 'well', 'like',
  'just', 'very', 'really', 'quite', 'too', 'also', 'even', 'still', 'only',
  'much', 'many', 'more', 'most', 'some', 'any', 'all', 'both', 'each', 'every',
  'of', 'for', 'with', 'from', 'at', 'by', 'in', 'on', 'about', 'after', 'before',
  'into', 'through', 'during', 'without', 'within', 'under', 'between', 'against',
]);

// 小品词：跟在实义词后面构成短语动词时属于核心语义，不能当功能词丢掉。
// 刻意只收「真正的小品词」。to / for / at / by / with / about 不算 ——
// 放进来会把 "want to"、"Americano to"、"look at" 这类非搭配结构误判成重点。
const PARTICLES = new Set([
  'up', 'off', 'out', 'down', 'over', 'back', 'away', 'apart', 'around', 'along',
  'through', 'in', 'on', 'into', 'across', 'upon', 'onto', 'past',
]);

/**
 * 归一化：去缩写后缀、去标点，用于查表与判长度（不改变原词形）。
 * 必须先处理 n't —— 否则 don't 会变成 don，而表里只有 do，功能词会被当成实义词。
 */
function normalizeToken(word: string): string {
  return word
    .toLowerCase()
    .replace(/n['’]t$/, '')
    .replace(/['’](s|m|re|ve|ll|d|t)$/, '')
    .replace(/[^a-z]/g, '');
}

/** 剥离片段首尾的标点，避免挑出 "late today," 这种带逗号的红字 */
function stripEdgePunctuation(fragment: string): string {
  return fragment.replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, '');
}

/** 在单个分句里挑重点片段（算法主体） */
function pickFromClause(clause: string, max: number): string[] {
  const tokens = clause.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const isContent = (w: string) => {
    const k = normalizeToken(w);
    return k.length >= 3 && !FUNCTION_WORDS.has(k);
  };
  const isParticle = (w: string) => PARTICLES.has(normalizeToken(w));

  const picked: string[] = [];
  const used = new Set<number>();
  const mark = (i: number, len: number) => {
    for (let k = i; k < i + len; k++) used.add(k);
    const fragment = tokens
      .slice(i, i + len)
      .map(stripEdgePunctuation)
      .filter(Boolean)
      .join(' ');
    if (fragment) picked.push(fragment);
  };

  // 1) 短语动词 / 惯用搭配：实义词 + 小品词
  for (let i = 0; i < tokens.length - 1; i++) {
    if (isContent(tokens[i]) && isParticle(tokens[i + 1])) {
      mark(i, 2);
      break;
    }
  }

  // 2) 相邻实义词组，按两词总长度打分，取信息量最大的一组
  while (picked.length < max) {
    let bestAt = -1;
    let bestScore = -1;
    for (let i = 0; i < tokens.length - 1; i++) {
      if (used.has(i) || used.has(i + 1)) continue;
      if (!isContent(tokens[i]) || !isContent(tokens[i + 1])) continue;
      const score = normalizeToken(tokens[i]).length + normalizeToken(tokens[i + 1]).length;
      if (score > bestScore) {
        bestScore = score;
        bestAt = i;
      }
    }
    if (bestAt < 0) break;
    mark(bestAt, 2);
  }

  // 3) 兜底：最长的实义词（越长的越可能是核心词）
  if (picked.length === 0) {
    let bestAt = -1;
    let bestLen = 0;
    tokens.forEach((w, i) => {
      if (!isContent(w)) return;
      const len = normalizeToken(w).length;
      if (len > bestLen) {
        bestLen = len;
        bestAt = i;
      }
    });
    if (bestAt >= 0) mark(bestAt, 1);
  }

  return picked.slice(0, max);
}

/**
 * 从一句英文里挑出值得标红的重点片段。
 * @param sentence 回电正文（natural / 变体句）
 * @param max 最多返回几段，默认 2；挑不到就给 1 段，再挑不到返回空数组
 */
export function pickCoreHighlights(sentence: string, max = 2): string[] {
  const raw = String(sentence ?? '').replace(/^[\s"'“”‘’]+/, '');
  if (!raw.trim()) return [];

  // 先只看第一分句，避免把后面从句的重点也算进来
  const firstClause = raw.split(/[.!?;]|\s[—–]\s/)[0] || raw;

  const fromFirst = pickFromClause(firstClause, max);
  if (fromFirst.length > 0) return fromFirst;

  // 第一分句里全是功能词时必须退回整句再挑，否则会「拍发了但一个重点都没标」。
  // 实例："You should DM me about this; don't put it on blast in the group chat."
  //       第一分句只有 you / should / me / about / this —— 全在功能词表里。
  if (firstClause !== raw) return pickFromClause(raw, max);
  return fromFirst;
}
