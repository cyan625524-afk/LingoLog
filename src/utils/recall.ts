import { FlashCard, RegisterVariants } from '../types';

export interface RecallEvaluation {
  result: 'pass' | 'partial' | 'fail';
  coverage: number;        // 0.0 ~ 1.0 词覆盖率
  accuracyPercent: number; // 0 ~ 100 发音词覆盖率百分比 (纯发音参考，非真实发音质量)
  matchedCount: number;
  totalWords: number;
  matchedVariant?: string;
}

/**
 * 纯前端本地评估函数（零运行时 AI，零 API 调用）
 * 复用本地词覆盖算法：逐词 exact +1.0、partial +0.6
 * 额外检测 casual / formal 等语域变体命中
 */
export function evaluateRecall(
  targetText: string,
  recognizedText: string,
  variants?: RegisterVariants,
  isTransferMode: boolean = false
): RecallEvaluation {
  const cleanTarget = (targetText || '').trim();
  const cleanSpoken = (recognizedText || '').trim().toLowerCase();

  // 若识别文本为空或极短
  if (!cleanSpoken || cleanSpoken.length < 2) {
    return {
      result: isTransferMode ? 'partial' : 'fail',
      coverage: 0,
      accuracyPercent: 0,
      matchedCount: 0,
      totalWords: 1,
    };
  }

  // 1. 检测语域变体 (RegisterVariants) 命中（归一化大小写与标点）
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const normalizedSpoken = normalize(cleanSpoken);

  const candidateVariants: string[] = [
    variants?.casual,
    variants?.formal,
    variants?.neutral,
  ].filter((v): v is string => typeof v === 'string' && v.trim().length > 0);

  for (const variant of candidateVariants) {
    const normVariant = normalize(variant);
    if (
      normVariant &&
      (normalizedSpoken.includes(normVariant) || normVariant.includes(normalizedSpoken))
    ) {
      const vWords = normVariant.split(' ').filter(Boolean).length;
      return {
        result: 'pass',
        coverage: 1.0,
        accuracyPercent: 95,
        matchedCount: vWords,
        totalWords: Math.max(1, vWords),
        matchedVariant: variant,
      };
    }
  }

  // 2. 逐词精确匹配与部分匹配 (Exact +1.0, Partial +0.6)
  const targetWords = cleanTarget
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, '').toLowerCase())
    .filter(Boolean);

  const spokenTokens = cleanSpoken
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9']/g, ''))
    .filter(Boolean);

  let matchedCount = 0;
  for (const word of targetWords) {
    if (!word) continue;
    const isExact = spokenTokens.includes(word);
    const isPartial = spokenTokens.some((st) => st.includes(word) || word.includes(st));

    if (isExact) {
      matchedCount += 1.0;
    } else if (isPartial) {
      matchedCount += 0.6;
    }
  }

  const totalWords = Math.max(1, targetWords.length);
  const coverage = Math.min(1.0, matchedCount / totalWords);
  const accuracyPercent = Math.min(100, Math.round(coverage * 100));

  // 3. 判定输出
  let result: 'pass' | 'partial' | 'fail';
  if (coverage >= 0.85) {
    result = 'pass';
  } else if (coverage >= 0.4) {
    result = 'partial';
  } else {
    // 换场景复述（transfer）判分不做语义推断：与目标句差异大时默认落 partial，不落 fail
    result = isTransferMode ? 'partial' : 'fail';
  }

  return {
    result,
    coverage,
    accuracyPercent,
    matchedCount,
    totalWords,
  };
}

/**
 * 换场景复述（transfer）模式与提示语选择
 * 节奏按独立计数器 recallStats.attempts：
 * attempts 0-1: 原句
 * attempts 2: 换场景 (transfer)
 * attempts 3: 原句
 * attempts 4+: 交替（偶数 transfer，奇数 original）
 */
export function getReviewModeAndPrompt(card: FlashCard): {
  mode: 'original' | 'transfer';
  promptZh: string;
} {
  const attempts = card.recallStats?.attempts ?? 0;
  const prompts = Array.isArray(card.transferPrompts)
    ? card.transferPrompts.filter((p) => typeof p === 'string' && p.trim().length > 0)
    : [];

  let isTransfer = false;
  if (prompts.length > 0) {
    if (attempts === 2) {
      isTransfer = true;
    } else if (attempts >= 4 && attempts % 2 === 0) {
      isTransfer = true;
    }
  }

  if (isTransfer) {
    const promptIndex = Math.floor(attempts / 2) % prompts.length;
    return {
      mode: 'transfer',
      promptZh: prompts[promptIndex] || card.original,
    };
  }

  return {
    mode: 'original',
    promptZh: card.original,
  };
}
