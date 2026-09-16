import { FlashCard, CardCategory, PhraseItem, RegisterVariants } from '../types';
import { normalizeCategory, sanitizeTags } from './storage';

export interface ParsedCardDraft {
  natural: string;
  original: string;
  category: CardCategory | string;
  tags: string[];
  explanation: string;
  phrases: PhraseItem[];
  redHighlights?: string[];
  variants?: RegisterVariants;
}

/**
 * Extract phrase items, red highlights, and synonyms from explanation bullets
 */
function extractPhrasesAndHighlights(
  explanationText: string,
  naturalText: string
): { phrases: PhraseItem[]; redHighlights: string[]; variants?: RegisterVariants } {
  const phrases: PhraseItem[] = [];
  const redHighlights: string[] = [];
  let variants: RegisterVariants | undefined;

  const lines = explanationText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Pattern 1: * **key/label**：content
    // Example 1: * **influencer**：社交媒体时代专指...
    // Example 2: * **by next year**：**by** 表示...
    // Example 3: * **同义表达**：表达“坚持发帖当网红”时，口语中也常说 **If I keep posting daily...**
    const headerMatch = trimmed.match(/^\*?\s*\*\*([^*：:]+)\*\*[:：](.+)$/);
    if (headerMatch) {
      const headerTerm = headerMatch[1].trim();
      const content = headerMatch[2].trim();

      // Check if headerTerm is primarily English/Latin words (e.g. "influencer", "by next year")
      const isEnglishTerm = /^[a-zA-Z0-9\s'-]+$/.test(headerTerm);

      if (isEnglishTerm && headerTerm.length >= 2) {
        // Direct English word or key phrase in bullet heading
        const cleanMeaning = content
          .replace(/\*\*[^*]+\*\*/g, (m) => m.replace(/\*\*/g, ''))
          .replace(/\*[^*]+\*/g, (m) => m.replace(/\*/g, ''))
          .replace(/^[：:\s]+/, '')
          .trim();

        phrases.push({
          phrase: headerTerm,
          pos: headerTerm.includes(' ') ? '短语' : '重点词',
          meaning: cleanMeaning.slice(0, 100),
          example: naturalText || headerTerm,
        });

        if (!redHighlights.includes(headerTerm)) {
          redHighlights.push(headerTerm);
        }
      } else {
        // Header term is Chinese label like "同义表达", "动词活用", "习惯缩略", "核心词组"
        const boldMatches = Array.from(content.matchAll(/\*\*([^*]+)\*\*/g))
          .map((m) => m[1].trim())
          .filter((t) => /[a-zA-Z]/.test(t));

        if (headerTerm.includes('同义') || headerTerm.includes('变体') || headerTerm.includes('口语')) {
          if (boldMatches.length > 0) {
            variants = {
              casual: boldMatches[0],
              formal: boldMatches[1] || undefined,
            };
            phrases.push({
              phrase: boldMatches[0],
              pos: '同义表达',
              meaning:
                content
                  .replace(/\*\*[^*]+\*\*/g, '')
                  .replace(/[，。]/g, ' ')
                  .trim()
                  .slice(0, 60) || '母语地道同义口语表达',
              example: boldMatches[1] || naturalText,
            });
          }
        } else if (boldMatches.length > 0) {
          const mainCand = boldMatches[0];
          phrases.push({
            phrase: mainCand,
            pos: headerTerm.length <= 4 ? headerTerm : '短语',
            meaning:
              content
                .replace(/\*\*[^*]+\*\*/g, '')
                .replace(/[，。]/g, ' ')
                .trim()
                .slice(0, 60) || headerTerm,
            example: naturalText || mainCand,
          });
          if (
            !redHighlights.includes(mainCand) &&
            naturalText.toLowerCase().includes(mainCand.toLowerCase())
          ) {
            redHighlights.push(mainCand);
          }
        }
      }
    }
  }

  // If no phrases extracted from bullets, fallback to first few words
  if (phrases.length === 0 && naturalText) {
    const words = naturalText.split(/\s+/).slice(0, 3).join(' ');
    phrases.push({
      phrase: words,
      pos: '短语',
      meaning: '母语地道核心表达',
      example: naturalText,
    });
  }

  return { phrases: phrases.slice(0, 4), redHighlights, variants };
}

/**
 * Parse a single Markdown card text block into structured card draft
 */
export function parseSingleMarkdownBlock(rawBlock: string): ParsedCardDraft | null {
  let text = rawBlock.trim();
  if (!text) return null;

  // 清洗 Gemini 网页端可能残留的 UI 文本和空白列表标记
  text = text.replace(/#*\s*Gemini\s+said:?/gi, '');
  text = text.replace(/Custom\s*Gem\s*/gi, '');
  text = text.replace(/^\s*[-*•·]\s*$/gm, '');

  let natural = '';
  let original = '';
  let categoryRaw = '';
  let tagsRaw = '';
  let explanation = '';

  // 1. Match "地道母语表达" section (supports ## 地道母语表达, **地道母语表达**, etc.)
  const naturalMatch = text.match(
    /(?:^|\n)(?:#{1,4}\s*|\*\*|【)?地道母语表达(?:】|\*\*)?[:：]?\s*\n+([\s\S]*?)(?=(?:\n---|\n#{1,4}\s+|\n\*\s*\*\*|\n\*\*我的原始表达|$))/i
  );
  if (naturalMatch) {
    natural = naturalMatch[1]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('---') && !/^#{0,6}\s*(gemini said|custom gem)/i.test(l))
      .join(' ')
      .replace(/^["“'”]+|["“'”]+$/g, '')
      .trim();
  }

  // 2. Match "我的原始表达" section
  const originalMatch = text.match(
    /(?:^|\n)(?:#{1,4}\s*|\*\*|【)?(?:我的)?原始表达(?:】|\*\*)?[:：]?\s*\n+([\s\S]*?)(?=(?:\n---|\n#{1,4}\s+|\n\s*[-*•·]?\s*\*{0,2}(?:场景|标签|深度)|$))/i
  );
  if (originalMatch) {
    original = originalMatch[1]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => {
        if (!l || l.startsWith('---') || /^[-*•·\s]+$/.test(l)) return false;
        // 彻底过滤掉混入原始表达的场景与标签行
        if (/^[-*•·]?\s*\*{0,2}(?:场景归类|场景分类|所属场景|分类|归类|场景|标签提取|核心标签|标签|Tags?)[\*：:]/i.test(l)) return false;
        return true;
      })
      .join(' ')
      .trim();
  }

  // 3. Match "场景归类" / "场景分类" / "所属场景"
  const categoryMatch = text.match(
    /(?:^|\n)\s*[-*•·]?\s*\*{0,2}(?:场景归类|场景分类|所属场景|分类|归类|场景)\*{0,2}\s*[:：]\s*\*{0,2}([^\n*]+)/i
  );
  if (categoryMatch) {
    categoryRaw = categoryMatch[1].trim().replace(/^[*#_:\s：]+|[*#_:\s：]+$/g, '');
  }

  // 4. Match "标签" / "标签提取" / "核心标签"
  const tagsMatch = text.match(
    /(?:^|\n)\s*[-*•·]?\s*\*{0,2}(?:标签提取|核心标签|标签|Tags?)\*{0,2}\s*[:：]\s*\*{0,2}([^\n*]+)/i
  );
  if (tagsMatch) {
    tagsRaw = tagsMatch[1].trim().replace(/^[*#_:\s：]+|[*#_:\s：]+$/g, '');
  }

  // 5. Match "深度知识解析" section
  const explanationMatch = text.match(
    /(?:^|\n)(?:#{1,4}\s*|\*\*|【)?(?:深度知识解析|知识解析|深度解析|解析|Notes)(?:】|\*\*)?[:：]?\s*\n+([\s\S]*)$/i
  );
  if (explanationMatch) {
    explanation = explanationMatch[1]
      .split('\n')
      .map((l) => l.trimEnd())
      .filter((l) => !l.startsWith('---'))
      .join('\n')
      .trim();
  }

  // Secondary heuristics if explicit headers not found
  if (!natural && !original) {
    const cleanLines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('---') && !l.startsWith('#'));

    if (cleanLines.length >= 2) {
      const isFirstEnglish = /^[a-zA-Z0-9\s,.'!?"-]+$/.test(cleanLines[0]);
      const isSecondEnglish = /^[a-zA-Z0-9\s,.'!?"-]+$/.test(cleanLines[1]);

      if (isFirstEnglish && !isSecondEnglish) {
        natural = cleanLines[0];
        original = cleanLines[1];
      } else if (!isFirstEnglish && isSecondEnglish) {
        original = cleanLines[0];
        natural = cleanLines[1];
      }
    }
  }

  // Must have at least natural or original to be a valid card
  if (!natural && !original) {
    return null;
  }

  // Category mapping: Preserve specific category (like "社交媒体") or normalize to standard 10
  const category = categoryRaw || normalizeCategory(categoryRaw || undefined);

  // Tags parsing
  let rawTagList: string[] = [];
  if (tagsRaw) {
    rawTagList = tagsRaw
      .replace(/[*_#]/g, '')
      .split(/[、,，\s/|]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }
  const tags = sanitizeTags(rawTagList);

  // Format Explanation if missing
  if (!explanation) {
    explanation = `* **地道表达**：${natural || original}\n* **语言建议**：符合母语者口语交际习惯。`;
  }

  // Extract phrases, highlights & variants
  const { phrases, redHighlights, variants } = extractPhrasesAndHighlights(
    explanation,
    natural
  );

  return {
    natural: natural || original,
    original: original || natural,
    category,
    tags,
    explanation,
    phrases,
    redHighlights,
    variants,
  };
}

/**
 * Splits a full pasted text into individual card blocks and parses each
 */
export function parsePastedMarkdown(rawText: string): ParsedCardDraft[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // Check if multiple cards exist by splitting on "## 地道母语表达"
  const cardSplits = trimmed
    .split(/(?=(?:^|\n)##\s*地道母语表达)/gi)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  if (cardSplits.length > 1) {
    const results: ParsedCardDraft[] = [];
    for (const block of cardSplits) {
      const parsed = parseSingleMarkdownBlock(block);
      if (parsed) results.push(parsed);
    }
    if (results.length > 0) return results;
  }

  // Try parsing the entire text as a single block
  const singleResult = parseSingleMarkdownBlock(trimmed);
  if (singleResult) {
    return [singleResult];
  }

  return [];
}

/**
 * Converts parsed card drafts into full FlashCard objects ready for storage
 */
export function createCardsFromDrafts(drafts: ParsedCardDraft[]): FlashCard[] {
  const now = new Date();
  return drafts.map((draft, idx) => {
    const timestamp = now.getTime() + idx * 10;
    return {
      id: `card-md-${timestamp}`,
      original: draft.original,
      originalText: draft.original,
      natural: draft.natural,
      correctedText: draft.natural,
      category: draft.category,
      scene: typeof draft.category === 'string' ? draft.category : undefined,
      tags: draft.tags,
      manualTags: draft.tags,
      explanation: draft.explanation,
      phrases: draft.phrases || [],
      redHighlights: draft.redHighlights || [],
      variants: draft.variants,
      createdAt: new Date(timestamp).toISOString(),
      nextReviewAt: new Date(timestamp).toISOString(),
      nextReviewDate: new Date(timestamp).toISOString(),
      intervalStage: 0,
      reviewStage: 0,
      reviewCount: 0,
      masteryLevel: 'learning',
      isFavorite: false,
      isStarred: false,
      readCount: 0,
    };
  });
}

