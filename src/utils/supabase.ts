import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { FlashCard } from '../types';
import { sanitizeFlashCard } from './storage';

const K_SUPABASE_URL = 'lingolog_supabase_url';
const K_SUPABASE_ANON_KEY = 'lingolog_supabase_anon_key';
const K_LAST_SYNC_TIME = 'lingolog_last_cloud_sync';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

export function sanitizeSupabaseUrl(rawUrl: string): string {
  let url = (rawUrl || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return url.replace(/\/+$/, '');
  }
}

const BUILTIN_SUPABASE_URL = 'https://dhuyngljrmxgssxpsdys.supabase.co';
const BUILTIN_SUPABASE_ANON_KEY = 'sb_publishable_-mRNfbDODN-0cZOeFsEKmA_pq9Xo4yT';

export function getSupabaseConfig(): SupabaseConfig {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  const storedUrl = typeof localStorage !== 'undefined' ? localStorage.getItem(K_SUPABASE_URL) || '' : '';
  const storedKey = typeof localStorage !== 'undefined' ? localStorage.getItem(K_SUPABASE_ANON_KEY) || '' : '';

  const rawUrl = (envUrl || storedUrl || BUILTIN_SUPABASE_URL || '').trim();
  const url = sanitizeSupabaseUrl(rawUrl);
  const anonKey = (envKey || storedKey || BUILTIN_SUPABASE_ANON_KEY || '').trim();

  // If stored URL had extra paths like /rest/v1, fix it silently in localStorage
  if (storedUrl && storedUrl !== url && typeof localStorage !== 'undefined') {
    localStorage.setItem(K_SUPABASE_URL, url);
  }

  return {
    url,
    anonKey,
    isConfigured: Boolean(url && anonKey && url.startsWith('https://')),
  };
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  const cleanUrl = sanitizeSupabaseUrl(url);
  const cleanKey = (anonKey || '').trim();
  if (cleanUrl) localStorage.setItem(K_SUPABASE_URL, cleanUrl);
  else localStorage.removeItem(K_SUPABASE_URL);

  if (cleanKey) localStorage.setItem(K_SUPABASE_ANON_KEY, cleanKey);
  else localStorage.removeItem(K_SUPABASE_ANON_KEY);

  // Re-create client
  _supabaseInstance = null;
}

let _supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (_supabaseInstance) return _supabaseInstance;
  const cfg = getSupabaseConfig();
  if (!cfg.isConfigured) return null;

  try {
    _supabaseInstance = createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    return _supabaseInstance;
  } catch (err) {
    console.warn('[LingoLog Supabase] Failed to initialize client:', err);
    return null;
  }
}

/* ──────────────────────────────────────────────────────────
 * 认证操作：注册、登录、登出、监听状态
 * ────────────────────────────────────────────────────────── */

export async function signUpWithEmail(email: string, pass: string): Promise<{ user: User | null; error: string | null; needsEmailConfirmation?: boolean }> {
  const sb = getSupabase();
  if (!sb) return { user: null, error: '请先配置 Supabase 云端地址与密钥' };

  const { data, error } = await sb.auth.signUp({
    email: email.trim(),
    password: pass,
  });

  if (error) {
    return { user: null, error: error.message };
  }

  const needsEmailConfirmation = Boolean(data.user && !data.session);
  return { user: data.user, error: null, needsEmailConfirmation };
}

export async function signInWithEmail(email: string, pass: string): Promise<{ user: User | null; error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { user: null, error: '请先配置 Supabase 云端地址与密钥' };

  const { data, error } = await sb.auth.signInWithPassword({
    email: email.trim(),
    password: pass,
  });

  if (error) {
    return { user: null, error: error.message };
  }

  return { user: data.user, error: null };
}

export async function signOutCloud(): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: null };

  const { error } = await sb.auth.signOut();
  return { error: error ? error.message : null };
}

export async function getCurrentUser(): Promise<User | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getUser();
    return data?.user || null;
  } catch {
    return null;
  }
}

export function getLastCloudSyncTime(): string {
  return typeof localStorage !== 'undefined' ? localStorage.getItem(K_LAST_SYNC_TIME) || '' : '';
}

export function setLastCloudSyncTime(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(K_LAST_SYNC_TIME, new Date().toISOString());
  }
}

/* ──────────────────────────────────────────────────────────
 * 云端卡片双向智能合并同步
 * ────────────────────────────────────────────────────────── */

export interface SyncStats {
  mergedCards: FlashCard[];
  pushedCount: number;
  pulledCount: number;
  cloudTotal: number;
}

export async function syncCardsWithCloud(localCards: FlashCard[]): Promise<SyncStats | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  try {
    // 1. 从云端拉取该用户的所有卡片
    const { data: cloudRows, error: fetchErr } = await sb
      .from('lingolog_cards')
      .select('id, card, updated_at')
      .eq('user_id', user.id);

    if (fetchErr) {
      console.error('[LingoLog Supabase] 拉取云端卡片失败:', fetchErr.message);
      return null;
    }

    const cloudMap = new Map<string, { card: FlashCard; updatedAt: string }>();
    if (Array.isArray(cloudRows)) {
      for (const row of cloudRows) {
        if (row && row.card && row.id) {
          const sanitized = sanitizeFlashCard(row.card, 0);
          cloudMap.set(row.id, { card: sanitized, updatedAt: row.updated_at });
        }
      }
    }

    const localMap = new Map<string, FlashCard>();
    for (const c of localCards) {
      localMap.set(c.id, c);
    }

    const toPushToCloud: Array<{ id: string; user_id: string; card: FlashCard; updated_at: string }> = [];
    const mergedList: FlashCard[] = [];
    let pushedCount = 0;
    let pulledCount = 0;

    // 2. 遍历本地卡片：检查是否需要推送到云端或与云端合并
    for (const [id, localCard] of localMap.entries()) {
      const cloudItem = cloudMap.get(id);
      if (!cloudItem) {
        // 本地有，云端没有 → 上传至云端
        const updatedAt = localCard.lastReviewedAt || localCard.createdAt || new Date().toISOString();
        toPushToCloud.push({
          id,
          user_id: user.id,
          card: localCard,
          updated_at: updatedAt,
        });
        mergedList.push(localCard);
        pushedCount++;
      } else {
        // 两端都有：比较时间戳，较新的一方获胜
        const localTime = new Date(localCard.lastReviewedAt || localCard.createdAt || 0).getTime();
        const cloudTime = new Date(cloudItem.updatedAt || cloudItem.card.lastReviewedAt || 0).getTime();

        if (localTime >= cloudTime) {
          if (localTime > cloudTime) {
            toPushToCloud.push({
              id,
              user_id: user.id,
              card: localCard,
              updated_at: new Date(localTime).toISOString(),
            });
            pushedCount++;
          }
          mergedList.push(localCard);
        } else {
          mergedList.push(cloudItem.card);
          pulledCount++;
        }
      }
    }

    // 3. 遍历云端卡片：检查哪些是本地没有的（如其他设备新录入的）
    for (const [id, cloudItem] of cloudMap.entries()) {
      if (!localMap.has(id)) {
        mergedList.push(cloudItem.card);
        pulledCount++;
      }
    }

    // 4. 批量 upsert 需要推送到云端的卡片
    if (toPushToCloud.length > 0) {
      const { error: upsertErr } = await sb
        .from('lingolog_cards')
        .upsert(toPushToCloud, { onConflict: 'id' });

      if (upsertErr) {
        console.warn('[LingoLog Supabase] 批量推送云端失败:', upsertErr.message);
      }
    }

    // 按创建时间倒序排布
    mergedList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setLastCloudSyncTime();

    return {
      mergedCards: mergedList,
      pushedCount,
      pulledCount,
      cloudTotal: cloudMap.size + pushedCount,
    };
  } catch (err) {
    console.error('[LingoLog Supabase] 同步异常:', err);
    return null;
  }
}

/** 单卡快速异步上传（增量操作） */
export async function uploadSingleCardToCloud(card: FlashCard): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  try {
    const updatedAt = card.lastReviewedAt || card.createdAt || new Date().toISOString();
    await sb.from('lingolog_cards').upsert({
      id: card.id,
      user_id: user.id,
      card,
      updated_at: updatedAt,
    }, { onConflict: 'id' });
  } catch (e) {
    console.warn('[LingoLog Supabase] 单卡更新失败:', e);
  }
}

/** 单卡快速异步删除 */
export async function deleteSingleCardFromCloud(cardId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  try {
    await sb.from('lingolog_cards').delete().eq('id', cardId).eq('user_id', user.id);
  } catch (e) {
    console.warn('[LingoLog Supabase] 单卡删除失败:', e);
  }
}
