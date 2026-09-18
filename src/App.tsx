import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  NavTab,
  FlashCard,
  ReviewHistoryEntry,
  AppSettings,
  DailyQuest,
  ShopItem,
  StoryItem,
  ReviewRating,
  CardCategory,
  UserProfile,
} from './types';
import { Navbar } from './components/Navbar';
import { TopHeader } from './components/TopHeader';
import { StudyView } from './components/views/StudyView';
import { ReviewView } from './components/views/ReviewView';
import { ArchiveView } from './components/views/ArchiveView';
import { ProgressView } from './components/views/ProgressView';
import { ProfileView } from './components/views/ProfileView';
import { SideProfileDrawer } from './components/modals/SideProfileDrawer';

// Modals & Common
import { CardDetailModal } from './components/modals/CardDetailModal';
import { FlashcardReviewModal } from './components/modals/FlashcardReviewModal';
import { BatchImportModal } from './components/modals/BatchImportModal';
import { SpeechPracticeModal } from './components/modals/SpeechPracticeModal';
import { SyncLoginModal } from './components/modals/SyncLoginModal';
import { SupabaseAuthModal } from './components/modals/SupabaseAuthModal';
import { CoachMarkTour } from './components/common/CoachMarkTour';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import {
  getCurrentUser,
  syncCardsWithCloud,
  uploadSingleCardToCloud,
  deleteSingleCardFromCloud,
} from './utils/supabase';

// Utilities
import {
  loadCards,
  saveCards,
  saveCardsDebounced,
  loadFeathers,
  saveFeathers,
  loadStreak,
  saveStreak,
  loadHeatmap,
  saveHeatmap,
  saveHeatmapDebounced,
  loadQuests,
  saveQuests,
  loadShopItems,
  saveShopItems,
  loadSettings,
  saveSettings,
  loadStories,
  saveStories,
  getUserProfile,
  saveUserProfile,
} from './utils/storage';
import { sound } from './utils/audio';
import {
  calculateNextReview,
  createHistorySnapshot,
  isCardDue,
  formatDate,
  calculateStreakFromHeatmap,
} from './utils/ebbinghaus';
import { showBrowserNotification, SPEECH_NOTICE_EVENT, type SpeechNoticeDetail } from './utils/tts';
import { syncOnBoot } from './utils/sync';
import { parsePastedMarkdown, createCardsFromDrafts } from './utils/markdownCardParser';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('learn');

  // Core Data States
  const [cards, setCards] = useState<FlashCard[]>(() => loadCards());
  const [feathers, setFeathers] = useState<number>(() => loadFeathers());
  const [heatmap, setHeatmap] = useState(() => loadHeatmap());
  const [quests, setQuests] = useState<DailyQuest[]>(() => loadQuests());
  const [shopItems, setShopItems] = useState<ShopItem[]>(() => loadShopItems());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  // 引擎关闭时不下发密钥：服务端收到空密钥就走公开翻译降级。
  // 「关掉」必须是真不发，而不是「发了但不用」—— 少一次外发就少一分泄露面。
  const activeApiKey = settings.apiEnabled ? settings.customApiKey : '';
  const [stories, setStories] = useState<StoryItem[]>(() => loadStories());

  // Continuous streak days derived authoritatively from heatmap and cards
  const streakDays = useMemo(() => {
    return calculateStreakFromHeatmap(heatmap, cards);
  }, [heatmap, cards]);

  // Review & Undo History Stack
  const [reviewHistoryStack, setReviewHistoryStack] = useState<ReviewHistoryEntry[]>([]);

  // Profile & Drawer States
  const [userProfile, setUserProfile] = useState<UserProfile>(() => getUserProfile());
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [selectedCardForDetail, setSelectedCardForDetail] = useState<FlashCard | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [activeReviewQueue, setActiveReviewQueue] = useState<FlashCard[]>([]);
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  const [isSpeechPracticeOpen, setIsSpeechPracticeOpen] = useState(false);
  const [speechTargetCard, setSpeechTargetCard] = useState<FlashCard | null>(null);
  const [isSyncLoginModalOpen, setIsSyncLoginModalOpen] = useState(false);
  const [isSupabaseAuthOpen, setIsSupabaseAuthOpen] = useState(false);

  // Card Generation Progress for Top Header Punch Tape
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(100);
  const [generationStatus, setGenerationStatus] = useState('');

  // Task 11: Onboarding Tour State
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    try {
      const done = localStorage.getItem('lingolog_onboarding_completed');
      return !done && cards.length <= 15;
    } catch {
      return false;
    }
  });
  const questDateRef = useRef(formatDate(new Date()));
  const reminderKeyRef = useRef('');

  // 引导结束（跳过或走完）统一落标记，避免下次再弹
  const closeOnboarding = useCallback(() => {
    setShowOnboarding(false);
    try {
      localStorage.setItem('lingolog_onboarding_completed', 'true');
    } catch {}
  }, []);

  // Storage Quota Alert State
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  // 朗读失败提示。过去 tts.ts 所有失败路径都是静默 resolve()，
  // 手机点了朗读没声音却一句话都没有，用户只能认为按钮坏了。
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);

  useEffect(() => {
    const handleStorageFull = () => {
      setStorageWarning('存储空间不足，无法自动保存新记录。请在「个人中心」及时导出备份并清理旧数据。');
    };
    window.addEventListener('lingolog-storage-full', handleStorageFull);
    return () => window.removeEventListener('lingolog-storage-full', handleStorageFull);
  }, []);

  useEffect(() => {
    const handleSpeechNotice = (e: Event) => {
      const detail = (e as CustomEvent<SpeechNoticeDetail>).detail;
      if (detail?.message) setSpeechNotice(detail.message);
    };
    window.addEventListener(SPEECH_NOTICE_EVENT, handleSpeechNotice);
    return () => window.removeEventListener(SPEECH_NOTICE_EVENT, handleSpeechNotice);
  }, []);

  // Flush writes immediately when window/tab is closing
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveCards(cards);
      saveHeatmap(heatmap);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [cards, heatmap]);

  // Sync Audio config & Theme on load
  useEffect(() => {
    sound.setConfig(settings.soundEnabled, settings.soundVolume);
    if (settings.themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    const theme = settings.pageTheme || 'vintage';
    document.documentElement.setAttribute('data-page-theme', theme);
  }, [settings]);

  // Sync to localStorage (with debounce for high-frequency cards & heatmap)
  useEffect(() => {
    saveCardsDebounced(cards);
  }, [cards]);

  useEffect(() => {
    saveFeathers(feathers);
  }, [feathers]);

  useEffect(() => {
    saveStreak(streakDays);
  }, [streakDays]);

  useEffect(() => {
    saveHeatmapDebounced(heatmap);
  }, [heatmap]);

  useEffect(() => {
    saveQuests(quests);
  }, [quests]);

  useEffect(() => {
    saveShopItems(shopItems);
  }, [shopItems]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveStories(stories);
  }, [stories]);

  const reloadAllData = useCallback(() => {
    setCards(loadCards());
    setFeathers(loadFeathers());
    setHeatmap(loadHeatmap());
    setQuests(loadQuests());
    setShopItems(loadShopItems());
    setSettings(loadSettings());
    setStories(loadStories());
    setUserProfile(getUserProfile());
  }, []);

  // Check Cloudflare D1 cloud sync on startup
  useEffect(() => {
    syncOnBoot()
      .then((res) => {
        if (res.state === 'pulled') {
          reloadAllData();
        }
      })
      .catch(() => {});
  }, [reloadAllData]);

  // Daily Checkin & Reminder & Date Change Checker
  useEffect(() => {
    const checkDateAndReminders = () => {
      const loaded = loadQuests();
      const todayStr = formatDate(new Date());
      if (todayStr !== questDateRef.current) {
        questDateRef.current = todayStr;
        setQuests(loaded);
      }

      if (!settings.enableReminders) return;
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;

      const reminderKey = `${todayStr} ${settings.reminderTime}`;
      if (timeStr === settings.reminderTime && reminderKeyRef.current !== reminderKey) {
        const dueCount = cards.filter((c) => isCardDue(c.nextReviewAt)).length;
        if (dueCount > 0) {
          reminderKeyRef.current = reminderKey;
          showBrowserNotification(
            '打字机复习提醒',
            `您有 ${dueCount} 条地道口语表达待复习，敲几下键盘巩固记忆吧！`
          );
        }
      }
    };

    checkDateAndReminders();
    const interval = setInterval(checkDateAndReminders, 60000);
    return () => clearInterval(interval);
  }, [settings.enableReminders, settings.reminderTime, cards]);

  // Due Review count calculation
  const dueReviewCount = cards.filter((c) => isCardDue(c.nextReviewAt)).length;
  const totalReviewsCount = cards.reduce((sum, c) => sum + (c.reviewCount || 0), 0);

  // Helper: Reward feathers
  const addFeathers = useCallback((amount: number) => {
    setFeathers((prev) => prev + amount);
  }, []);

  // Helper: Increment heatmap activity
  const recordActivity = useCallback((type: 'learn' | 'review' | 'speech', minutes: number = 2) => {
    const todayStr = formatDate(new Date());
    setHeatmap((prev) => {
      const current = prev[todayStr] || {
        date: todayStr,
        count: 0,
        studyMinutes: 0,
        learnedCount: 0,
        reviewedCount: 0,
        spokenCount: 0,
      };
      return {
        ...prev,
        [todayStr]: {
          ...current,
          count: current.count + 1,
          studyMinutes: (current.studyMinutes || 0) + minutes,
          learnedCount: type === 'learn' ? (current.learnedCount || 0) + 1 : current.learnedCount || 0,
          reviewedCount: type === 'review' ? (current.reviewedCount || 0) + 1 : current.reviewedCount || 0,
          spokenCount: type === 'speech' ? (current.spokenCount || 0) + 1 : current.spokenCount || 0,
        },
      };
    });
  }, []);

  // ── 外部助手推送自动同步（来自 Gemini / 油猴脚本等） ──
  useEffect(() => {
    let active = true;
    const checkInbox = async () => {
      try {
        const res = await fetch('/api/inbox');
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        if (data && Array.isArray(data.items) && data.items.length > 0) {
          const allNewCards: FlashCard[] = [];
          for (const item of data.items) {
            const drafts = parsePastedMarkdown(item.text);
            if (drafts.length > 0) {
              const newCards = createCardsFromDrafts(drafts);
              allNewCards.push(...newCards);
            }
          }
          if (allNewCards.length > 0) {
            setCards((prev) => [...allNewCards, ...prev]);
            allNewCards.forEach((c) => uploadSingleCardToCloud(c));
            addFeathers(allNewCards.length * 2);
            recordActivity('learn', 5);
            setQuests((prev) =>
              prev.map((q) =>
                q.id === 'quest-learn' || q.id === 'learn_1' || q.id === 'quest-1'
                  ? { ...q, current: Math.min(q.target, q.current + allNewCards.length), completed: true }
                  : q
              )
            );
            sound.playSuccess();
          }
        }
      } catch {
        // ignore polling network errors
      }
    };

    const interval = setInterval(checkInbox, 3000);
    window.addEventListener('focus', checkInbox);
    checkInbox();
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('focus', checkInbox);
    };
  }, [addFeathers, recordActivity]);

  // ── Supabase 用户状态检测与自动多端合并 ──
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const user = await getCurrentUser();
        if (user && mounted) {
          setUserProfile((prev) => {
            const next = {
              ...prev,
              isLoggedIn: true,
              name: user.email ? user.email.split('@')[0] : prev.name,
            };
            saveUserProfile(next);
            return next;
          });
          const stats = await syncCardsWithCloud(cards);
          if (stats && mounted && stats.pulledCount > 0) {
            setCards(stats.mergedCards);
          }
        }
      } catch {
        // ignore background sync errors
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 1. Add Optimized Card
  const handleOptimizedNewCard = (newCard: FlashCard) => {
    setCards((prev) => [newCard, ...prev]);
    uploadSingleCardToCloud(newCard);
    addFeathers(5);
    recordActivity('learn', 3);

    // Update quest: learn
    setQuests((prev) =>
      prev.map((q) =>
        q.id === 'quest-learn' || q.id === 'learn_1' || q.id === 'quest-1'
          ? { ...q, current: Math.min(q.target, q.current + 1), completed: true }
          : q
      )
    );
  };

  // 2. Grade Flashcard in Review
  const handleGradeCard = (cardId: string, rating: ReviewRating) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    // Push snapshot to undo history stack
    const snapshot = createHistorySnapshot(card, rating);
    setReviewHistoryStack((prev) => [snapshot, ...prev.slice(0, 19)]);

    // Calculate next review interval with settings.targetRetention
    const { nextReviewAt, nextIntervalStage, masteryLevel } = calculateNextReview(
      card.intervalStage ?? 0,
      rating,
      settings.targetRetention || 90
    );

    const nowIso = new Date().toISOString();
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? {
              ...c,
              nextReviewAt: nextReviewAt.toISOString(),
              intervalStage: nextIntervalStage,
              masteryLevel,
              reviewCount: (c.reviewCount || 0) + 1,
              lastReviewedAt: nowIso,
              reviewHistory: [...(c.reviewHistory || []), nowIso],
            }
          : c
      )
    );

    // Reward feathers
    const featherReward = rating === 'easy' ? 4 : rating === 'good' ? 3 : rating === 'hard' ? 2 : 1;
    addFeathers(featherReward);
    recordActivity('review', 2);

    // Update quest: review
    setQuests((prev) =>
      prev.map((q) =>
        q.id === 'quest-review' || q.id === 'review_5' || q.id === 'quest-2'
          ? { ...q, current: q.current + 1, completed: q.current + 1 >= q.target }
          : q
      )
    );
  };

  // 3. Undo Last Review Grade
  const handleUndoLastGrade = (entry?: ReviewHistoryEntry) => {
    if (reviewHistoryStack.length === 0) return;
    const [latestEntry, ...rest] = reviewHistoryStack;
    const lastEntry = entry?.cardId === latestEntry.cardId && entry.timestamp === latestEntry.timestamp
      ? entry
      : latestEntry;
    setReviewHistoryStack(rest);

    setCards((prev) =>
      prev.map((c) =>
        c.id === lastEntry.cardId
          ? {
              ...c,
              nextReviewAt: lastEntry.prevNextReviewAt,
              intervalStage: lastEntry.prevIntervalStage,
              reviewCount: Math.max(0, (lastEntry.prevReviewCount || 1) - 1),
              masteryLevel: lastEntry.prevMasteryLevel,
              lastReviewedAt: lastEntry.prevLastReviewedAt,
              reviewHistory: (c.reviewHistory || []).slice(0, -1),
            }
          : c
      )
    );
    const featherReward = lastEntry.rating === 'easy' ? 4 : lastEntry.rating === 'good' ? 3 : lastEntry.rating === 'hard' ? 2 : 1;
    setFeathers((prev) => Math.max(0, prev - featherReward));
    const activityDate = formatDate(new Date(lastEntry.timestamp));
    setHeatmap((prev) => {
      const current = prev[activityDate];
      if (!current) return prev;
      return {
        ...prev,
        [activityDate]: {
          ...current,
          count: Math.max(0, (current.count || 0) - 1),
          studyMinutes: Math.max(0, (current.studyMinutes || 0) - 2),
          reviewedCount: Math.max(0, (current.reviewedCount || 0) - 1),
          reviews: Math.max(0, (current.reviews || 0) - 1),
        },
      };
    });
    setQuests((prev) =>
      prev.map((q) =>
        q.id === 'review_5' ? { ...q, current: Math.max(0, q.current - 1), completed: q.current - 1 >= q.target } : q
      )
    );
    sound.playKeyClick();
  };

  // 4. Toggle Favorite
  const handleToggleFavorite = (cardId: string) => {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, isFavorite: !c.isFavorite } : c))
    );
  };

  // 5. Delete Card
  const handleDeleteCard = (cardId: string) => {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    deleteSingleCardFromCloud(cardId);
    if (selectedCardForDetail?.id === cardId) {
      setSelectedCardForDetail(null);
    }
  };

  // Task 12: Batch Delete Cards
  const handleBatchDeleteCards = (cardIds: string[]) => {
    const idSet = new Set(cardIds);
    setCards((prev) => prev.filter((c) => !idSet.has(c.id)));
    cardIds.forEach((id) => deleteSingleCardFromCloud(id));
  };

  // Task 12: Batch Update Category
  const handleBatchUpdateCategory = (cardIds: string[], newCategory: CardCategory) => {
    const idSet = new Set(cardIds);
    setCards((prev) =>
      prev.map((c) => (idSet.has(c.id) ? { ...c, category: newCategory } : c))
    );
  };

  // Task 12: Batch Toggle Favorite
  const handleBatchToggleFavorite = (cardIds: string[], targetFavorite: boolean) => {
    const idSet = new Set(cardIds);
    setCards((prev) =>
      prev.map((c) => (idSet.has(c.id) ? { ...c, isFavorite: targetFavorite } : c))
    );
  };

  // Task 19: Start Filtered / Tagged Review
  const handleStartFilteredReview = (targetCards: FlashCard[]) => {
    if (targetCards.length === 0) return;
    setActiveReviewQueue(targetCards);
    setIsReviewModalOpen(true);
  };

  // 6. Update Card Details
  const handleUpdateCard = (updated: FlashCard) => {
    setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setSelectedCardForDetail(updated);
    uploadSingleCardToCloud(updated);
  };

  // 7. Complete Speech Evaluation
  const handleSpeechCompleted = (
    cardId: string,
    score: number,
    accuracy: string | number,
    feedback: string,
    evalResult?: any
  ) => {
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== cardId) return c;
        const currentRecords = c.speechRecords || [];
        return {
          ...c,
          spokenCount: (c.spokenCount || 0) + 1,
          speechRecords: [
            {
              score,
              accuracy,
              feedback,
              date: new Date().toISOString(),
              evalResult,
            },
            ...currentRecords.slice(0, 9),
          ],
        };
      })
    );

    addFeathers(score >= 80 ? 6 : 3);
    recordActivity('speech', 2);

    // Update quest: speak / audio
    setQuests((prev) =>
      prev.map((q) =>
        q.id === 'quest-audio' || q.id === 'speak_1' || q.id === 'quest-3'
          ? { ...q, current: q.current + 1, completed: q.current + 1 >= q.target }
          : q
      )
    );
  };

  // 8. Batch Import Complete
  const handleBatchImportComplete = (importedCards: FlashCard[], isFullRestore = false) => {
    if (isFullRestore) {
      reloadAllData();
      return;
    }
    setCards((prev) => [...importedCards, ...prev]);
    addFeathers(importedCards.length * 2);
    recordActivity('learn', 5);
  };

  // 9. Claim Daily Quest Reward
  const handleClaimQuest = (questId: string) => {
    const q = quests.find((item) => item.id === questId);
    if (!q || q.claimed) return;

    addFeathers(q.rewardFeathers);
    setQuests((prev) =>
      prev.map((item) =>
        item.id === questId ? { ...item, claimed: true, completed: true } : item
      )
    );
  };

  // 10. Makeup Heatmap Check-in
  const handleMakeupCheckin = (dateStr: string) => {
    if ((settings.makeupCards || 0) > 0) {
      setSettings((prev) => ({
        ...prev,
        makeupCards: Math.max(0, (prev.makeupCards || 0) - 1),
      }));
    } else if (feathers >= 30) {
      setFeathers((prev) => Math.max(0, prev - 30));
    } else {
      return;
    }
    setHeatmap((prev) => ({
      ...prev,
      [dateStr]: {
        date: dateStr,
        count: 5,
        studyMinutes: 15,
        isMakeup: true,
      },
    }));
    sound.playSuccess();
  };

  // 11. Buy Shop Item
  const handleBuyShopItem = (itemId: string) => {
    const item = shopItems.find((i) => i.id === itemId);
    if (!item || feathers < item.cost) return;

    if (item.category === 'guarantee' || item.category === 'consumable') {
      setFeathers((prev) => prev - item.cost);
      if (itemId === 'shop-freeze-card') {
        setSettings((prev) => ({
          ...prev,
          streakFreezes: (prev.streakFreezes || 0) + 1,
        }));
      } else if (itemId === 'shop-makeup-card') {
        setSettings((prev) => ({
          ...prev,
          makeupCards: (prev.makeupCards || 0) + 1,
        }));
      }
      setShopItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, owned: true } : i))
      );
      sound.playSuccess();
      return;
    }

    if (item.owned) return;
    setFeathers((prev) => prev - item.cost);

    if (item.category === 'chassis' || item.category === 'skin') {
      const skinKey = itemId
        .replace('shop-chassis-', '')
        .replace('shop-skin-', '') as AppSettings['typewriterSkin'];
      setSettings((prev) => ({ ...prev, typewriterSkin: skinKey }));
    } else if (item.category === 'theme') {
      const themeKey = itemId.replace('shop-theme-', '') as NonNullable<AppSettings['pageTheme']>;
      setSettings((prev) => ({ ...prev, pageTheme: themeKey }));
    }

    setShopItems((prev) =>
      prev.map((i) => {
        if (i.id === itemId) {
          return {
            ...i,
            owned: true,
            active:
              i.category === 'chassis' || i.category === 'skin' || i.category === 'theme'
                ? true
                : i.active,
          };
        }
        if (
          (item.category === 'chassis' || item.category === 'skin') &&
          (i.category === 'chassis' || i.category === 'skin')
        ) {
          return { ...i, active: false };
        }
        if (item.category === 'theme' && i.category === 'theme') {
          return { ...i, active: false };
        }
        return i;
      })
    );
    sound.playSuccess();
  };

  // 12. Toggle / Equip Shop Item
  const handleToggleShopItem = (itemId: string) => {
    const item = shopItems.find((i) => i.id === itemId);
    if (!item || !item.owned) return;

    if (item.category === 'chassis' || item.category === 'skin') {
      const skinKey = itemId
        .replace('shop-chassis-', '')
        .replace('shop-skin-', '') as AppSettings['typewriterSkin'];
      const isAlreadyActive = !!item.active;
      const newSkin = isAlreadyActive ? 'classic' : skinKey;
      setSettings((prev) => ({ ...prev, typewriterSkin: newSkin }));
      setShopItems((prev) =>
        prev.map((i) =>
          i.category === 'chassis' || i.category === 'skin'
            ? { ...i, active: i.id === itemId ? !isAlreadyActive : false }
            : i
        )
      );
      sound.playKeyClick();
    } else if (item.category === 'theme') {
      const themeKey = itemId.replace('shop-theme-', '') as NonNullable<AppSettings['pageTheme']>;
      setSettings((prev) => ({ ...prev, pageTheme: themeKey }));
      setShopItems((prev) =>
        prev.map((i) =>
          i.category === 'theme'
            ? { ...i, active: i.id === itemId }
            : i
        )
      );
      sound.playKeyClick();
    }
  };

  // 13. Release Backlog Cards
  const handleReleaseBacklog = (limit?: number) => {
    const dueCards = cards.filter((c) => isCardDue(c.nextReviewAt));
    const toReview = typeof limit === 'number' ? dueCards.slice(0, limit) : dueCards;
    setActiveReviewQueue(toReview);
    setIsReviewModalOpen(true);
  };

  // Active Tab normalizer
  const activeKey: 'learn' | 'review' | 'library' | 'progress' | 'profile' =
    currentTab === 'review'
      ? 'review'
      : currentTab === 'archive' || currentTab === 'library'
      ? 'library'
      : currentTab === 'progress' || currentTab === 'stats'
      ? 'progress'
      : currentTab === 'profile'
      ? 'profile'
      : 'learn';

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden paper-grid-bg bg-[#f3efe6] dark:bg-[#171d15] text-stone-800 dark:text-stone-100 font-sans transition-colors">
      {/* Offline Status Bar indicator */}
      <OfflineIndicator />

      {/* Storage Quota Alert Banner。
          用 fixed 而不是文档流顶端：手机用户是往下滚着看内容的，
          插在文档顶部的提示会落在视口之外，等于没提示。 */}
      {storageWarning && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[95] max-w-2xl w-[92%] p-3 bg-amber-950/95 border-2 border-amber-600/60 text-amber-100 rounded-lg shadow-xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>{storageWarning}</span>
          </div>
          <button
            onClick={() => setStorageWarning(null)}
            className="px-2 py-1 bg-amber-800 hover:bg-amber-700 text-amber-100 rounded text-xs shrink-0 cursor-pointer"
          >
            知晓
          </button>
        </div>
      )}

      {/* 朗读失败提示：手机端最需要这个，因为那里往往既没有英文音色、在线音源也可能被拦。
          必须 fixed 浮在视口顶部。放在文档流顶端时，手机用户是往下滚着看卡片的，
          提示会落在视口之外 —— 过去「点了朗读连红字都没有」就是这么来的：
          元素渲染了，但没人看得见。 */}
      {speechNotice && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] max-w-2xl w-[92%] p-3 bg-red-950/95 border-2 border-red-600/60 text-red-50 rounded-lg shadow-xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">🔇</span>
            <span>{speechNotice}</span>
          </div>
          <button
            onClick={() => setSpeechNotice(null)}
            className="px-2 py-1 bg-red-800 hover:bg-red-700 text-red-50 rounded text-xs shrink-0 cursor-pointer"
          >
            知晓
          </button>
        </div>
      )}

      {/* 1. Refined Top Header with 3 Core Tabs & Stats Drawer Trigger */}
      <TopHeader
        currentTab={currentTab}
        onTabChange={(tab) => {
          sound.playKeyClick();
          setCurrentTab(tab);
        }}
        dueCount={dueReviewCount}
        feathers={feathers}
        streakDays={streakDays}
        settings={settings}
        onUpdateSettings={(newPartial) => setSettings({ ...settings, ...newPartial })}
        onOpenSettings={() => setIsProfileDrawerOpen(true)}
        onOpenMobileDrawer={() => setIsProfileDrawerOpen(true)}
        isGenerating={isGeneratingCard}
        generationProgress={generationProgress}
        generationStatus={generationStatus}
        userProfile={userProfile}
        onOpenAuthModal={() => setIsSupabaseAuthOpen(true)}
      />

      {/* 2. Main Screen View Content (Learn / Review / Library) */}
      <main className="flex-1 w-full flex flex-col justify-start paper-grid-bg pb-16 md:pb-6">
        {activeKey === 'learn' && (
          <StudyView
            onOptimized={handleOptimizedNewCard}
            modelName={settings.modelName}
            apiKey={activeApiKey}
            provider={settings.apiProvider}
            baseUrl={settings.customBaseUrl}
            typewriterSkin={settings.typewriterSkin}
            onOpenSpeechPractice={(card) => {
              setSpeechTargetCard(card);
              setIsSpeechPracticeOpen(true);
            }}
            existingCards={cards}
            onNavigateToReview={(targetCard) => {
              sound.playKeyClick();
              if (targetCard) {
                setActiveReviewQueue([targetCard]);
                setIsReviewModalOpen(true);
              } else {
                setCurrentTab('review');
              }
            }}
            onGeneratingStateChange={(isGenerating, progress, stage) => {
              setIsGeneratingCard(isGenerating);
              setGenerationProgress(progress);
              setGenerationStatus(stage || '');
            }}
          />
        )}

        {activeKey === 'review' && (
          <ReviewView
            cards={cards}
            onStartFullReview={(selectedCards) => {
              setActiveReviewQueue(selectedCards);
              setIsReviewModalOpen(true);
            }}
            onSelectCardDetail={(card) => {
              setSelectedCardForDetail(card);
            }}
            onToggleFavorite={handleToggleFavorite}
            dailyReviewLimit={settings.dailyReviewLimit}
          />
        )}

        {activeKey === 'library' && (
          <ArchiveView
            cards={cards}
            stories={stories}
            onSelectCardDetail={(card) => {
              setSelectedCardForDetail(card);
            }}
            onToggleFavorite={handleToggleFavorite}
            onDeleteCard={handleDeleteCard}
            onBatchDeleteCards={handleBatchDeleteCards}
            onBatchUpdateCategory={handleBatchUpdateCategory}
            onBatchToggleFavorite={handleBatchToggleFavorite}
            onStartFilteredReview={handleStartFilteredReview}
            onSaveStory={(s) => setStories((prev) => [s, ...prev])}
            onOpenBatchImport={() => setIsBatchImportOpen(true)}
            modelName={settings.modelName}
            apiKey={activeApiKey}
            provider={settings.apiProvider}
            baseUrl={settings.customBaseUrl}
          />
        )}

        {activeKey === 'progress' && (
          <ErrorBoundary fallbackTitle="值机进度看板异常">
            <ProgressView
              cards={cards}
              feathers={feathers}
              streakDays={streakDays}
              quests={quests}
              onClaimQuest={handleClaimQuest}
              heatmap={heatmap}
              onMakeupCheckin={handleMakeupCheckin}
              shopItems={shopItems}
              onBuyShopItem={handleBuyShopItem}
              onToggleShopItem={handleToggleShopItem}
              streakFreezes={settings.streakFreezes || 0}
              makeupCards={settings.makeupCards || 0}
              onSelectCard={(card) => setSelectedCardForDetail(card)}
              onNavigateTab={(tab) => {
                sound.playKeyClick();
                if (tab === 'archive') setCurrentTab('library');
                else setCurrentTab(tab);
              }}
              onStartSprintReview={() => handleReleaseBacklog(10)}
              userProfile={userProfile}
              onSaveUserProfile={(newProfile) => {
                setUserProfile(newProfile);
                saveUserProfile(newProfile);
              }}
            />
          </ErrorBoundary>
        )}

        {activeKey === 'profile' && (
          <ProfileView
            userProfile={userProfile}
            onSaveUserProfile={(newProfile) => {
              setUserProfile(newProfile);
              saveUserProfile(newProfile);
            }}
            settings={settings}
            onSaveSettings={(newSettings) => setSettings(newSettings)}
            onReloadData={reloadAllData}
            cardsCount={cards.length}
            streakDays={streakDays}
            feathers={feathers}
            totalReviewCount={totalReviewsCount}
            onNavigateTab={(tab) => {
              sound.playKeyClick();
              setCurrentTab(tab);
            }}
            onOpenSyncModal={() => setIsSupabaseAuthOpen(true)}
          />
        )}
      </main>

      {/* 3. Mobile Bottom Navigation Bar (4 Core Tabs: 学习 · 复习 · 归档 · 进度) */}
      <Navbar
        currentTab={currentTab}
        onTabChange={(tab) => {
          sound.playKeyClick();
          setCurrentTab(tab);
        }}
        reviewDueCount={dueReviewCount}
        onOpenStats={() => setIsProfileDrawerOpen(true)}
        hidden={isProfileDrawerOpen}
      />

      {/* 4. Profile, Login & Settings Drawer */}
      <SideProfileDrawer
        isOpen={isProfileDrawerOpen}
        onClose={() => setIsProfileDrawerOpen(false)}
        userProfile={userProfile}
        onSaveUserProfile={(newProfile) => {
          setUserProfile(newProfile);
          saveUserProfile(newProfile);
        }}
        settings={settings}
        onSaveSettings={(newSettings) => setSettings(newSettings)}
        onReloadData={reloadAllData}
        cardsCount={cards.length}
        streakDays={streakDays}
        feathers={feathers}
        totalReviewCount={totalReviewsCount}
        onOpenSyncModal={() => setIsSupabaseAuthOpen(true)}
      />

      {/* 5. Modals */}
      {/* Card Detail Modal */}
      <CardDetailModal
        card={selectedCardForDetail}
        isOpen={!!selectedCardForDetail}
        onClose={() => {
          setSelectedCardForDetail(null);
        }}
        onToggleFavorite={handleToggleFavorite}
        onOpenSpeechPractice={(card) => {
          setSpeechTargetCard(card);
          setIsSpeechPracticeOpen(true);
        }}
        onDeleteCard={handleDeleteCard}
        onUpdateCard={handleUpdateCard}
      />

      {/* Full Spaced Flashcard Review Modal */}
      <FlashcardReviewModal
        cards={activeReviewQueue}
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onGradeCard={handleGradeCard}
        onUndoLastGrade={handleUndoLastGrade}
        historyStack={reviewHistoryStack}
      />

      {/* Batch Import Modal */}
      <BatchImportModal
        isOpen={isBatchImportOpen}
        onClose={() => setIsBatchImportOpen(false)}
        onImportComplete={handleBatchImportComplete}
        modelName={settings.modelName}
        apiKey={activeApiKey}
        provider={settings.apiProvider}
        baseUrl={settings.customBaseUrl}
      />

      {/* Speech Practice Modal */}
      <SpeechPracticeModal
        card={speechTargetCard}
        isOpen={isSpeechPracticeOpen}
        onClose={() => {
          setIsSpeechPracticeOpen(false);
          setSpeechTargetCard(null);
        }}
        onSpeechCompleted={handleSpeechCompleted}
        modelName={settings.modelName}
        apiKey={activeApiKey}
        provider={settings.apiProvider}
        baseUrl={settings.customBaseUrl}
      />

      {/* Supabase Cloud Sync & Login Modal */}
      <SupabaseAuthModal
        isOpen={isSupabaseAuthOpen}
        onClose={() => setIsSupabaseAuthOpen(false)}
        cards={cards}
        onUpdateCards={(newCards) => setCards(newCards)}
        userProfile={userProfile}
        onUpdateUserProfile={(newProfile) => {
          setUserProfile(newProfile);
          saveUserProfile(newProfile);
        }}
      />

      {/* 组件旁引导：目标控件都在学习页，所以只在学习页挂载 */}
      {currentTab === 'learn' && (
        <CoachMarkTour
          isOpen={showOnboarding}
          onClose={closeOnboarding}
          onFinish={() => {
            closeOnboarding();
            addFeathers(5);
          }}
        />
      )}
    </div>
  );
}
