import { FlashCard, DailyQuest, ShopItem, AppSettings, HeatmapDay, StoryItem, CardCategory, CARD_CATEGORIES, UserProfile } from '../types';
import { INITIAL_CARDS, INITIAL_QUESTS, INITIAL_SHOP_ITEMS, DEFAULT_SETTINGS } from '../data/initialData';
import { getPreset, reviveModelName } from '../data/providers';
import { formatDate } from './ebbinghaus';
import { normalizeCategory } from './categoryMatcher';

export { normalizeCategory };

// P1 #7: Debounce utility for batched localStorage writes
export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => { if (timer) clearTimeout(timer); };
  return debounced as T & { cancel: () => void };
}

// P0 #3: Storage quota warning - check if localStorage is near capacity
let _storageWarningShown = false;
function checkStorageQuota() {
  try {
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        totalSize += (localStorage.getItem(key) || '').length;
      }
    }
    // Warn if usage exceeds ~4MB (localStorage limit is typically 5MB)
    const usageMB = totalSize / (1024 * 1024);
    if (usageMB > 4 && !_storageWarningShown) {
      _storageWarningShown = true;
      console.warn(`[LingoLog] localStorage usage: ${usageMB.toFixed(2)}MB / ~5MB. Consider exporting a backup.`);
    }
  } catch {}
}

// P0 #3: Safe localStorage write with quota error detection
function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e: any) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      console.error(`[LingoLog] 存储空间不足，无法保存 ${key}。请导出备份后清理旧数据。`);
      // Dispatch a custom event so UI can optionally show a toast
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('lingolog-storage-full', { detail: { key } }));
      }
    } else {
      console.error(`Failed to save ${key}:`, e);
    }
    return false;
  }
}

const STORAGE_KEYS = {
  CARDS: 'lingolog_cards_v1',
  FEATHERS: 'lingolog_feathers_v1',
  STREAK: 'lingolog_streak_v1',
  QUESTS: 'lingolog_quests_v1',
  QUESTS_DATE: 'lingolog_quests_date_v1',
  SHOP: 'lingolog_shop_v1',
  SETTINGS: 'lingolog_settings_v1',
  HEATMAP: 'lingolog_heatmap_v1',
  STORIES: 'lingolog_stories_v1',
  USER_PROFILE: 'lingolog_user_profile_v1',
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  id: 'OPERATOR-084',
  name: '首席发报员',
  email: 'telegrapher@lingolog.org',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
  isLoggedIn: true,
  joinDate: '2025-01-01',
  role: '特级电报员',
};

export function getUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    if (!raw) return DEFAULT_USER_PROFILE;
    return { ...DEFAULT_USER_PROFILE, ...JSON.parse(raw) };
  } catch (e) {
    return DEFAULT_USER_PROFILE;
  }
}

export function saveUserProfile(profile: UserProfile): void {
  safeLocalStorageSet(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
}



// Sanitize tags to ensure clean nouns, max 5 tags
export function sanitizeTags(tags?: any): string[] {
  if (!Array.isArray(tags)) return ['口语', '地道'];
  const cleaned = tags
    .filter((t) => typeof t === 'string' && t.trim().length > 0)
    .map((t) => {
      const trimmed = t.trim().replace(/^#+/, '');
      return trimmed.length > 8 ? trimmed.slice(0, 8) : trimmed;
    })
    .filter((t) => t.length > 0);

  return cleaned.length > 0 ? cleaned.slice(0, 5) : ['表达', '口语'];
}

// Clean and normalize flashcard data
export function sanitizeFlashCard(raw: any, index: number = 0): FlashCard {
  const original =
    raw.original ||
    raw.originalText ||
    raw.chinese ||
    raw.source ||
    raw.prompt ||
    '日常表达';

  const natural =
    raw.natural ||
    raw.correctedText ||
    raw.english ||
    raw.target ||
    'Natural native expression.';

  const explanation =
    raw.explanation ||
    raw.deepExplanation ||
    '• 地道母语表达，避免中式直译。';

  const category = normalizeCategory(raw.category || raw.scene);
  const tags = sanitizeTags(raw.tags || raw.manualTags);
  const createdAt = raw.createdAt || new Date().toISOString();
  const nextReviewAt = raw.nextReviewAt || raw.nextReviewDate || new Date().toISOString();

  const intervalStage =
    typeof raw.intervalStage === 'number'
      ? raw.intervalStage
      : typeof raw.reviewStage === 'number'
      ? raw.reviewStage
      : 0;

  const historyList = Array.isArray(raw.reviewHistory) ? raw.reviewHistory : [];
  const reviewCount =
    typeof raw.reviewCount === 'number'
      ? raw.reviewCount
      : historyList.length > 0
      ? historyList.length
      : 0;

  const lastReviewedAt =
    raw.lastReviewedAt ||
    (historyList.length > 0 ? historyList[historyList.length - 1] : undefined);

  const masteryLevel =
    raw.masteryLevel ||
    (intervalStage >= 4 || reviewCount >= 4
      ? 'mastered'
      : reviewCount > 0
      ? 'uncertain'
      : 'learning');

  const isFavorite = Boolean(raw.isFavorite ?? raw.isStarred);
  const userNotes = raw.userNotes ?? raw.userNote ?? undefined;
  const phrases = Array.isArray(raw.phrases) ? raw.phrases : [];

  return {
    id: raw.id || `card-${Date.now()}-${index}`,
    original,
    originalText: original,
    natural,
    correctedText: natural,
    colloquial: raw.colloquial,
    formal: raw.formal,
    explanation,
    category,
    scene: raw.scene,
    tags,
    manualTags: raw.manualTags,
    phrases,
    createdAt,
    lastReviewedAt,
    nextReviewAt,
    nextReviewDate: nextReviewAt,
    intervalStage,
    reviewStage: intervalStage,
    reviewCount,
    reviewHistory: historyList,
    masteryLevel,
    isFavorite,
    isStarred: isFavorite,
    userNotes,
    userNote: userNotes,
    readCount: raw.readCount || raw.spokenCount || 0,
    spokenCount: raw.spokenCount || raw.readCount || 0,
    spokenDuration: raw.spokenDuration,
    lastSpeakDuration: raw.lastSpeakDuration,
    speechRecords: raw.speechRecords,
  };
}

// Clean and normalize story data
export function sanitizeStory(raw: any, index: number = 0): StoryItem {
  const title = raw.title || `情景对话 #${index + 1}`;
  const titleZh = raw.titleZh;
  const englishContent = raw.englishContent || raw.content || raw.storyEn || '';
  const chineseTranslation = raw.chineseTranslation || raw.translation || raw.storyZh || '';
  const highlightedCards = Array.isArray(raw.highlightedCards)
    ? raw.highlightedCards
    : Array.isArray(raw.matchedCardIds)
    ? raw.matchedCardIds
    : Array.isArray(raw.relatedCardIds)
    ? raw.relatedCardIds
    : [];

  return {
    id: raw.id || `story-${Date.now()}-${index}`,
    title,
    titleZh,
    content: englishContent,
    englishContent,
    translation: chineseTranslation,
    chineseTranslation,
    matchedCardIds: highlightedCards,
    highlightedCards,
    createdAt: raw.createdAt || new Date().toISOString(),
    keyTakeaways: raw.keyTakeaways,
  };
}

// Calculate actual study minutes for a day with smart estimation fallback
export function getDayStudyMinutes(day?: HeatmapDay): number {
  if (!day) return 0;
  if (typeof day.studyMinutes === 'number' && day.studyMinutes > 0) {
    return day.studyMinutes;
  }
  if (typeof day.studySeconds === 'number' && day.studySeconds > 0) {
    return Math.max(1, Math.round(day.studySeconds / 60));
  }
  if (day.isMakeup) return 15;
  const count = day.count || 0;
  if (count === 0) return 0;
  // Estimate ~2.5 mins per card interaction
  return Math.max(1, Math.round(count * 2.5));
}

// Initial heatmap strictly empty, populated entirely by real user actions
function generateInitialHeatmap(): Record<string, HeatmapDay> {
  return {};
}

export function loadCards(): FlashCard[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CARDS);
    if (!data) return INITIAL_CARDS;
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // 若本地存储中包含旧版16张默认预设卡片，自动平滑替换为新的内置单卡，并保留用户自己添加的卡片
      const hasOldDefaultCards = parsed.some(
        (c) => c && (c.original === '一不小心又熬到很晚了……' || c.originalText === '一不小心又熬到很晚了……')
      );
      if (hasOldDefaultCards) {
        const legacyDefaultIds = new Set([
          'card-1', 'card-2', 'card-3', 'card-4', 'card-5',
          'card-6', 'card-7', 'card-8', 'card-9', 'card-10',
          'card-11', 'card-12', 'card-13', 'card-14', 'card-15', 'card-16',
        ]);
        const userCustomCards = parsed.filter((c) => c && !legacyDefaultIds.has(c.id));
        const migrated = [...userCustomCards, ...INITIAL_CARDS].map((c, idx) => sanitizeFlashCard(c, idx));
        saveCards(migrated);
        return migrated;
      }
      return parsed.map((c, idx) => sanitizeFlashCard(c, idx));
    }
    return INITIAL_CARDS;
  } catch {
    return INITIAL_CARDS;
  }
}

export function saveCards(cards: FlashCard[]) {
  const data = JSON.stringify(cards);
  safeLocalStorageSet(STORAGE_KEYS.CARDS, data);
  checkStorageQuota();
}

export const saveCardsDebounced = debounce((cards: FlashCard[]) => {
  saveCards(cards);
}, 300);

export function loadFeathers(): number {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.FEATHERS);
    const parsed = val !== null ? Number(val) : 180;
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 180;
  } catch {
    return 180;
  }
}

export function saveFeathers(feathers: number) {
  safeLocalStorageSet(STORAGE_KEYS.FEATHERS, feathers.toString());
}

export function loadStreak(): number {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.STREAK);
    const parsed = val !== null ? Number(val) : 0;
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  } catch {
    return 0;
  }
}

export function saveStreak(streak: number) {
  safeLocalStorageSet(STORAGE_KEYS.STREAK, streak.toString());
}

export function loadSettings(): AppSettings {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) return DEFAULT_SETTINGS;
    const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    // 模型名会过期，做一次迁移。这里有个曾经踩过的坑：旧逻辑不管当前是哪个
    // 服务商，一律把过期名改成 Gemini 的名字 —— DeepSeek 用户会被静默改成
    // gemini-3.8-flash，然后自检报错，而界面上看不出模型名被换过。
    // 正确做法是「空值才按当前服务商回落，非空值只做死名字复活」。
    if (!parsed.modelName) {
      parsed.modelName = getPreset(parsed.apiProvider).models[0] || '';
    } else {
      parsed.modelName = reviveModelName(parsed.modelName);
    }
    // 自愈：开关是开着的、密钥却是空的 —— 只可能来自「导入了不含密钥的备份」或
    // 「同步把设置拉到了新设备」（密钥刻意不上传）。此时开关必须视为关闭，
    // 否则界面显示「已开启」，实际请求里没有密钥。
    if (parsed.apiEnabled && !parsed.customApiKey) {
      parsed.apiEnabled = false;
    }
    const reviewLimit = Number(parsed.dailyReviewLimit);
    parsed.dailyReviewLimit = Number.isFinite(reviewLimit)
      ? Math.min(50, Math.max(5, Math.floor(reviewLimit)))
      : DEFAULT_SETTINGS.dailyReviewLimit;
    return parsed;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings) {
  safeLocalStorageSet(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

export function loadShopItems(): ShopItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SHOP);
    if (!data) return INITIAL_SHOP_ITEMS;
    const stored: ShopItem[] = JSON.parse(data);
    const storedMap = new Map(stored.map((i) => [i.id, i]));
    // Merge redesigned INITIAL_SHOP_ITEMS with user's owned/active state
    return INITIAL_SHOP_ITEMS.map((item) => {
      const existing = storedMap.get(item.id);
      if (existing) {
        return {
          ...item,
          owned: existing.owned,
          active: existing.active,
        };
      }
      return item;
    });
  } catch {
    return INITIAL_SHOP_ITEMS;
  }
}

export function saveShopItems(items: ShopItem[]) {
  safeLocalStorageSet(STORAGE_KEYS.SHOP, JSON.stringify(items));
}

export function loadHeatmap(): Record<string, HeatmapDay> {
  try {
    const migrated = localStorage.getItem('lingolog_heatmap_real_v1');
    if (!migrated) {
      // One-time cleanup of legacy fake random mock heatmap data
      localStorage.removeItem(STORAGE_KEYS.HEATMAP);
      localStorage.setItem('lingolog_heatmap_real_v1', 'true');
      return {};
    }
    const data = localStorage.getItem(STORAGE_KEYS.HEATMAP);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveHeatmap(heatmap: Record<string, HeatmapDay>) {
  safeLocalStorageSet(STORAGE_KEYS.HEATMAP, JSON.stringify(heatmap));
}

export const saveHeatmapDebounced = debounce((heatmap: Record<string, HeatmapDay>) => {
  saveHeatmap(heatmap);
}, 300);

export function loadQuests(): DailyQuest[] {
  try {
    const savedDate = localStorage.getItem(STORAGE_KEYS.QUESTS_DATE);
    const todayStr = formatDate(new Date());
    const data = localStorage.getItem(STORAGE_KEYS.QUESTS);

    if (savedDate === todayStr && data) {
      const parsed: DailyQuest[] = JSON.parse(data);
      const parsedMap = new Map(parsed.map((q) => [q.id, q]));
      return INITIAL_QUESTS.map((q) => {
        const existing = parsedMap.get(q.id);
        if (existing) {
          return {
            ...q,
            current: existing.current ?? 0,
            completed: existing.completed ?? false,
            claimed: existing.claimed ?? false,
          };
        }
        return q;
      });
    }
    // New day reset
    localStorage.setItem(STORAGE_KEYS.QUESTS_DATE, todayStr);
    localStorage.setItem(STORAGE_KEYS.QUESTS, JSON.stringify(INITIAL_QUESTS));
    return INITIAL_QUESTS;
  } catch {
    return INITIAL_QUESTS;
  }
}

export function saveQuests(quests: DailyQuest[]) {
  safeLocalStorageSet(STORAGE_KEYS.QUESTS, JSON.stringify(quests));
}

export function loadStories(): StoryItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.STORIES);
    if (data) return JSON.parse(data);
  } catch {}
  return [
    {
      id: 'story-demo-1',
      title: 'Midnight Inspiration in Soho',
      titleZh: '深夜灵感与奇妙夜',
      englishContent:
        "Last night, I completely lost track of time while brainstorming new ideas. Even though my head was pounding like crazy, watching my first application come together filled me with boundless excitement. When the clock struck 3 AM, I knew I had stayed up way past my bedtime, but the sheer joy of creation was worth every minute.",
      chineseTranslation:
        "昨晚在头脑风暴新点子时，我完全忘记了时间。尽管我的脑袋疼得像要裂开一样，但看到我的第一个应用逐渐成型，内心涌动着无尽的欣喜。当钟声敲响三点时，我知道我又严重熬夜了，但创造的纯粹喜悦让每一分钟都无比值得。",
      createdAt: new Date().toISOString(),
      highlightedCards: ['card-1', 'card-2'],
    },
  ];
}

export function saveStories(stories: StoryItem[]) {
  safeLocalStorageSet(STORAGE_KEYS.STORIES, JSON.stringify(stories));
}

// Backup & Restore
export function exportAllDataJson(): string {
  const currentCards = loadCards();
  const currentStories = loadStories();
  const currentFeathers = loadFeathers();
  const currentStreak = loadStreak();
  const currentHeatmap = loadHeatmap();
  const currentQuests = loadQuests();
  const currentUserProfile = getUserProfile();

  const completedDates = Object.keys(currentHeatmap).sort();

  // 备份文件会离开这台设备（发给别人、进网盘、贴到聊天里），密钥不该跟着走。
  // 导入时本机已有的密钥会被保留，所以"导出 → 导入"不需要重新填。见 importAllDataJson。
  // 引擎开关同理是**每台设备自己的选择**：另一台设备没有密钥，开关对它没有意义。
  const exportSettings: Partial<AppSettings> = { ...loadSettings() };
  delete exportSettings.customApiKey;
  delete exportSettings.apiEnabled;
  delete exportSettings.apiVerifiedAt;

  const payload = {
    app: 'lingolog',
    version: 2,
    exportedAt: new Date().toISOString(),
    items: currentCards,
    cards: currentCards,
    storyDialogues: currentStories,
    stories: currentStories,
    userStats: {
      feathers: currentFeathers,
      streakDays: currentStreak,
      totalFeathersEarned: currentFeathers,
      completedDates,
      firstUseDate: completedDates[0] || new Date().toISOString().slice(0, 10),
    },
    feathers: currentFeathers,
    streak: currentStreak,
    settings: exportSettings,
    shop: loadShopItems(),
    quests: currentQuests,
    userProfile: currentUserProfile,
    heatmap: currentHeatmap,
    categories: CARD_CATEGORIES,
  };
  return JSON.stringify(payload, null, 2);
}

export function importAllDataJson(jsonStr: string): { success: boolean; count?: number; message?: string } {
  try {
    const parsed = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, message: '无效的 JSON 数据' };
    }

    // 1. Cards / Items
    const rawCards = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.items)
      ? parsed.items
      : Array.isArray(parsed.cards)
      ? parsed.cards
      : null;

    let importedCount = 0;
    if (rawCards) {
      const sanitizedCards = rawCards.map((c: any, idx: number) => sanitizeFlashCard(c, idx));
      saveCards(sanitizedCards);
      importedCount = sanitizedCards.length;
    }

    // 2. Stories / Story Dialogues
    const rawStories = Array.isArray(parsed.storyDialogues)
      ? parsed.storyDialogues
      : Array.isArray(parsed.stories)
      ? parsed.stories
      : null;

    if (rawStories) {
      const sanitizedStories = rawStories.map((s: any, idx: number) => sanitizeStory(s, idx));
      saveStories(sanitizedStories);
    }

    // 3. Feathers / UserStats
    const feathersVal = parsed.userStats?.feathers ?? parsed.feathers;
    if (typeof feathersVal === 'number') {
      saveFeathers(feathersVal);
    }

    // 4. Streak
    const streakVal = parsed.userStats?.streakDays ?? parsed.streak;
    if (typeof streakVal === 'number') {
      saveStreak(streakVal);
    }

    // 5. Heatmap / Completed Dates
    if (Array.isArray(parsed.userStats?.completedDates) && parsed.userStats.completedDates.length > 0) {
      const currentHeatmap = loadHeatmap();
      parsed.userStats.completedDates.forEach((dateStr: string) => {
        if (typeof dateStr === 'string' && dateStr.length >= 10) {
          const dKey = dateStr.slice(0, 10);
          if (!currentHeatmap[dKey]) {
            currentHeatmap[dKey] = {
              date: dKey,
              count: 6,
              learnedCount: 2,
              reviewedCount: 4,
              reviews: 4,
              newCards: 2,
            };
          }
        }
      });
      saveHeatmap(currentHeatmap);
    } else if (parsed.heatmap && typeof parsed.heatmap === 'object') {
      saveHeatmap(parsed.heatmap);
    }

    // 6. Settings & Shop
    if (parsed.settings) {
      // 备份文件里不含密钥（见 exportAllDataJson）。这里必须显式保留本机密钥：
      // loadSettings() 会与 DEFAULT_SETTINGS 合并，而 DEFAULT_SETTINGS.customApiKey 是空串，
      // 直接写入会把用户已经填好的密钥清空。
      const localSettings = loadSettings();
      saveSettings({
        ...localSettings,
        ...parsed.settings,
        customApiKey: localSettings.customApiKey,
      });
    }
    if (parsed.shop) {
      saveShopItems(parsed.shop);
    }
    if (Array.isArray(parsed.quests)) {
      saveQuests(parsed.quests);
    }
    if (parsed.userProfile && typeof parsed.userProfile === 'object') {
      saveUserProfile({ ...DEFAULT_USER_PROFILE, ...parsed.userProfile });
    }

    return { success: true, count: importedCount };
  } catch (e: any) {
    console.error('Import failed:', e);
    return { success: false, message: e?.message || '导入解析失败' };
  }
}

// Generate Anki-compatible CSV with UTF-8 BOM
export function exportAnkiCsv(cards: FlashCard[]): string {
  // UTF-8 BOM so Excel and Anki parse Chinese cleanly without garbled characters
  let csv = '\uFEFF';
  csv += '#separator:Comma\n';
  csv += '#html:true\n';
  csv += '#tags column:3\n';
  csv += '正面(中文),背面(地道英文),标签,解析与例句\n';

  const escapeCsv = (str: string = ''): string => {
    const formatted = str.replace(/"/g, '""');
    return `"${formatted}"`;
  };
  const escapeHtml = (str: string = '') =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  cards.forEach((card) => {
    const front = escapeCsv(card.original);
    
    // Format back with variants and phonetic if available
    let backContent = `<div style="font-family:serif;font-size:18px;color:#2c3a26;font-weight:bold;">${escapeHtml(card.natural)}</div>`;
    if (card.variants) {
      backContent += `<div style="font-size:12px;color:#666;margin-top:4px;"><b>口语:</b> ${escapeHtml(card.variants.casual || card.natural)} | <b>书面:</b> ${escapeHtml(card.variants.formal || card.natural)}</div>`;
    }
    const back = escapeCsv(backContent);

    // Tags separated by space for Anki
    const tagList = [...card.tags, card.category].filter(Boolean).map((t) => t.replace(/\s+/g, '_'));
    const tags = escapeCsv(tagList.join(' '));

    // Explanation & Phrases
    let notes = escapeHtml(card.explanation).replace(/\n/g, '<br/>');
    if (card.phrases && card.phrases.length > 0) {
      notes += '<br/><br/><b>核心短语:</b><br/>' + card.phrases.map((p) => `• <i>${escapeHtml(p.phrase)}</i> (${escapeHtml(p.pos)}): ${escapeHtml(p.meaning)} — <i>${escapeHtml(p.example)}</i>`).join('<br/>');
    }
    const explanation = escapeCsv(notes);

    csv += `${front},${back},${tags},${explanation}\n`;
  });

  return csv;
}

// Near-duplicate finder (checks Chinese exact match or English similarity)
export function findSimilarCard(
  text: string,
  cards: FlashCard[],
  excludeId?: string
): FlashCard | null {
  if (!text || !text.trim() || cards.length === 0) return null;
  const cleanInput = text.trim().toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, '');

  return (
    cards.find((c) => {
      if (excludeId && c.id === excludeId) return false;
      const cleanOrig = c.original.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, '');
      const cleanNat = c.natural.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, '');

      // Exact substring or high similarity
      if (cleanOrig === cleanInput || cleanNat === cleanInput) return true;
      if (cleanInput.length > 4 && (cleanOrig.includes(cleanInput) || cleanInput.includes(cleanOrig))) {
        return true;
      }
      return false;
    }) || null
  );
}

