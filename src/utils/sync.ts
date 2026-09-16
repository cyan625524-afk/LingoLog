/**
 * LingoLog 多端同步（客户端）
 *
 * 这个文件是纯增量的：不配置就什么都不做，不依赖后端存在。
 * 后端没上线时同步开关是灰的，App 行为与现在完全一致。
 *
 * 三条设计原则：
 *
 * 1) 只读写 localStorage，不碰 React state。
 *    App 的每个数据切片都是 useState(() => loadXxx())，启动时从 storage 读一次。
 *    所以"渲染前拉取"天然生效 —— 不需要 reload 页面，也不需要改 App.tsx 的数据流。
 *
 * 2) customApiKey 永不上传，也永不被远端覆盖。
 *    每台设备自己填一次密钥。密钥不该躺在第三方服务器上。
 *
 * 3) 乐观锁，不是"后写覆盖"。
 *    每次提交带 baseRev；对不上就回 409，进入 conflict 状态等用户决定。
 *    这是防"手机上刚复习完、电脑拿旧数据覆盖回去"的唯一防线。
 */

import {
  loadCards,
  saveCards,
  loadFeathers,
  saveFeathers,
  loadStreak,
  saveStreak,
  loadSettings,
  saveSettings,
  loadShopItems,
  saveShopItems,
  loadHeatmap,
  saveHeatmap,
  loadQuests,
  saveQuests,
  loadStories,
  saveStories,
  getUserProfile,
  saveUserProfile,
  sanitizeFlashCard,
  sanitizeStory,
} from './storage';
import type { AppSettings } from '../types';

/* ------------------------------------------------------------------ *
 * 配置
 * ------------------------------------------------------------------ */

const K_ENDPOINT = 'lingolog_sync_endpoint_v1';
const K_CODE = 'lingolog_sync_code_v1';
const K_REV = 'lingolog_sync_rev_v1';
const K_LAST = 'lingolog_sync_last_v1';
const K_DIRTY = 'lingolog_sync_dirty_v1';

/** Crockford Base32：去掉 I / L / O / U，避免手抄时认错 */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 26; // 26 × 5bit = 130 bit 熵，不可枚举

export type SyncState =
  | 'disabled' // 没配置
  | 'unchanged' // 已是最新
  | 'pulled' // 拉取了云端数据
  | 'pushed' // 推送成功
  | 'conflict' // 双方都有改动
  | 'offline'
  | 'error';

export interface SyncResult {
  state: SyncState;
  rev?: number;
  remoteRev?: number;
  message?: string;
}

export interface SyncConfig {
  endpoint: string;
  code: string;
  lastRev: number;
  lastSyncAt: string;
}

/* ------------------------------------------------------------------ *
 * 同步码
 * ------------------------------------------------------------------ */

export function generateSyncCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  // 按 5 位一组加连字符，方便抄写到另一台设备
  return out.replace(/(.{5})/g, '$1-').replace(/-$/, '');
}

export function normalizeSyncCode(raw: string): string {
  return (raw || '').trim().toUpperCase().replace(/[\s-]/g, '');
}

export function isValidSyncCode(raw: string): boolean {
  const code = normalizeSyncCode(raw);
  return code.length >= 20 && code.length <= 64 && /^[0-9A-Z]+$/.test(code);
}

/* ------------------------------------------------------------------ *
 * 配置读写
 * ------------------------------------------------------------------ */

export function getSyncConfig(): SyncConfig {
  try {
    return {
      endpoint: localStorage.getItem(K_ENDPOINT) || '',
      code: localStorage.getItem(K_CODE) || '',
      lastRev: Number(localStorage.getItem(K_REV) || '0') || 0,
      lastSyncAt: localStorage.getItem(K_LAST) || '',
    };
  } catch {
    return { endpoint: '', code: '', lastRev: 0, lastSyncAt: '' };
  }
}

export function isSyncConfigured(): boolean {
  const cfg = getSyncConfig();
  return Boolean(cfg.endpoint) && isValidSyncCode(cfg.code);
}

export function saveSyncConfig(endpoint: string, code: string): { ok: boolean; message?: string } {
  const url = (endpoint || '').trim().replace(/\/+$/, '');
  const normalized = normalizeSyncCode(code);

  if (!url) return { ok: false, message: '请填写同步服务地址' };
  if (!/^https?:\/\//i.test(url)) return { ok: false, message: '地址需要以 https:// 开头' };
  if (!/^https:/i.test(url) && !/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(url)) {
    return { ok: false, message: '必须是 https —— 同步码是明文凭证，不能走 http' };
  }
  if (!isValidSyncCode(normalized)) {
    return { ok: false, message: '同步码格式不对（20–64 位 A–Z / 0–9）' };
  }

  try {
    localStorage.setItem(K_ENDPOINT, url);
    localStorage.setItem(K_CODE, normalized);
    return { ok: true };
  } catch {
    return { ok: false, message: '本地存储写入失败' };
  }
}

export function clearSyncConfig(): void {
  try {
    localStorage.removeItem(K_ENDPOINT);
    localStorage.removeItem(K_CODE);
    localStorage.removeItem(K_REV);
    localStorage.removeItem(K_LAST);
    localStorage.removeItem(K_DIRTY);
  } catch {
    /* ignore */
  }
}

function setRev(rev: number): void {
  try {
    localStorage.setItem(K_REV, String(rev));
    localStorage.setItem(K_LAST, new Date().toISOString());
  } catch {
    /* ignore */
  }
}

function setDirty(dirty: boolean): void {
  try {
    if (dirty) localStorage.setItem(K_DIRTY, '1');
    else localStorage.removeItem(K_DIRTY);
  } catch {
    /* ignore */
  }
}

export function isDirty(): boolean {
  try {
    return localStorage.getItem(K_DIRTY) === '1';
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * 快照
 * ------------------------------------------------------------------ */

export interface SyncSnapshot {
  app: 'lingolog';
  version: 2;
  exportedAt: string;
  items: unknown;
  cards: unknown;
  stories: unknown;
  storyDialogues: unknown;
  feathers: number;
  streak: number;
  heatmap: unknown;
  quests: unknown;
  shop: unknown;
  settings: Partial<AppSettings>;
  userProfile: unknown;
}

/** 从 localStorage 组装整包快照。刻意摘掉 customApiKey 与引擎开关。 */
export function buildSnapshot(): SyncSnapshot {
  const settings: Partial<AppSettings> = { ...loadSettings() };
  delete settings.customApiKey;
  // 引擎开关是每台设备自己的选择：密钥不上传，另一台设备开了也没密钥可用。
  delete settings.apiEnabled;
  delete settings.apiVerifiedAt;

  const cards = loadCards();
  const stories = loadStories();

  return {
    app: 'lingolog',
    version: 2,
    exportedAt: new Date().toISOString(),
    items: cards,
    cards: cards,
    stories: stories,
    storyDialogues: stories,
    feathers: loadFeathers(),
    streak: loadStreak(),
    heatmap: loadHeatmap(),
    quests: loadQuests(),
    shop: loadShopItems(),
    settings: settings,
    userProfile: getUserProfile(),
  };
}

/**
 * 把远端快照写回 localStorage。
 * 只写 storage —— App 在挂载时读 storage，所以调用时机是"渲染之前"。
 */
export function applySnapshot(payload: any): void {
  if (!payload || typeof payload !== 'object') return;

  const rawCards = Array.isArray(payload.cards)
    ? payload.cards
    : Array.isArray(payload.items)
    ? payload.items
    : null;
  if (rawCards) saveCards(rawCards.map((c: any, i: number) => sanitizeFlashCard(c, i)));

  const rawStories = Array.isArray(payload.stories)
    ? payload.stories
    : Array.isArray(payload.storyDialogues)
    ? payload.storyDialogues
    : null;
  if (rawStories) saveStories(rawStories.map((s: any, i: number) => sanitizeStory(s, i)));

  const feathers = typeof payload.feathers === 'number' ? payload.feathers : undefined;
  if (typeof feathers === 'number') saveFeathers(feathers);

  if (typeof payload.streak === 'number') saveStreak(payload.streak);

  if (payload.heatmap && typeof payload.heatmap === 'object') saveHeatmap(payload.heatmap);

  if (Array.isArray(payload.quests)) saveQuests(payload.quests);
  if (Array.isArray(payload.shop)) saveShopItems(payload.shop);
  if (payload.userProfile && typeof payload.userProfile === 'object') {
    saveUserProfile(payload.userProfile);
  }

  if (payload.settings && typeof payload.settings === 'object') {
    // 本地密钥保留，远端设置其余字段照收
    const localKey = loadSettings().customApiKey;
    const merged: AppSettings = { ...loadSettings(), ...payload.settings, customApiKey: localKey };
    saveSettings(merged);
  }
}

/* ------------------------------------------------------------------ *
 * 网络
 * ------------------------------------------------------------------ */

async function call(
  cfg: SyncConfig,
  init: { method: string; body?: unknown; metaOnly?: boolean; timeoutMs?: number },
): Promise<{ status: number; data: any; timedOut: boolean }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? 12000);

  const headers: Record<string, string> = {
    'X-Sync-Code': normalizeSyncCode(cfg.code),
  };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.metaOnly) headers['X-Sync-Meta'] = '1';

  try {
    const res = await fetch(cfg.endpoint + '/sync', {
      method: init.method,
      headers: headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data: data, timedOut: false };
  } catch (e: any) {
    return { status: 0, data: { error: e?.name === 'AbortError' ? 'timeout' : 'network' }, timedOut: true };
  } finally {
    clearTimeout(timeout);
  }
}

/* ------------------------------------------------------------------ *
 * 拉取 / 推送
 * ------------------------------------------------------------------ */

let busy = false;

/**
 * 拉取。仅在云端更新时应用。
 * 本地有未推送改动且云端也变了 → 回 conflict，不自动覆盖任何一边。
 */
export async function pullSync(timeoutMs = 12000): Promise<SyncResult> {
  if (!isSyncConfigured()) return { state: 'disabled' };

  const cfg = getSyncConfig();
  const res = await call(cfg, { method: 'GET', timeoutMs });

  if (res.status === 0) {
    return { state: 'offline', message: res.timedOut ? '请求超时' : '网络不可达' };
  }
  if (res.status === 404) {
    // 云端还没数据。本地若为 0 则等首次推送。
    return { state: 'unchanged', rev: 0, message: '云端暂无数据' };
  }
  if (res.status === 503) {
    return { state: 'error', message: '后端未绑定数据库' };
  }
  if (res.status !== 200 || !res.data) {
    return { state: 'error', message: res.data?.message || res.data?.error || `HTTP ${res.status}` };
  }

  const remoteRev = Number(res.data.rev) || 0;
  const localRev = cfg.lastRev;

  if (remoteRev <= localRev) {
    return { state: 'unchanged', rev: remoteRev };
  }

  if (isDirty() && localRev > 0) {
    // 两边都动过，谁覆盖谁都是猜。交给用户。
    return {
      state: 'conflict',
      rev: localRev,
      remoteRev: remoteRev,
      message: `本地有未上传的改动，云端也有更新（云端 v${remoteRev} / 本地 v${localRev}）`,
    };
  }

  applySnapshot(res.data.payload);
  setRev(remoteRev);
  setDirty(false);
  return { state: 'pulled', rev: remoteRev };
}

/** 推送本地整包快照。baseRev 对不上时回 conflict。 */
export async function pushSync(): Promise<SyncResult> {
  if (!isSyncConfigured()) return { state: 'disabled' };

  const cfg = getSyncConfig();
  const snapshot = buildSnapshot();
  const res = await call(cfg, {
    method: 'POST',
    body: { baseRev: cfg.lastRev, payload: snapshot },
    timeoutMs: 15000,
  });

  if (res.status === 0) {
    setDirty(true);
    return { state: 'offline', message: res.timedOut ? '请求超时，改动已留在本地' : '网络不可达' };
  }
  if (res.status === 409) {
    setDirty(true);
    return {
      state: 'conflict',
      rev: cfg.lastRev,
      remoteRev: Number(res.data?.rev) || 0,
      message: '云端已被另一台设备更新，未覆盖。可以改为拉取云端。',
    };
  }
  if (res.status === 413) {
    setDirty(true);
    return { state: 'error', message: '数据超过 1MB 上限，未上传' };
  }
  if (res.status !== 200 || !res.data?.ok) {
    setDirty(true);
    return { state: 'error', message: res.data?.message || res.data?.error || `HTTP ${res.status}` };
  }

  setRev(Number(res.data.rev) || cfg.lastRev + 1);
  setDirty(false);
  return { state: 'pushed', rev: Number(res.data.rev) };
}

/** 用户主动选择"用云端覆盖本地"。 */
export async function forcePull(): Promise<SyncResult> {
  if (!isSyncConfigured()) return { state: 'disabled' };
  const cfg = getSyncConfig();
  const res = await call(cfg, { method: 'GET', timeoutMs: 15000 });
  if (res.status !== 200 || !res.data?.payload) {
    return { state: 'error', message: res.data?.message || `HTTP ${res.status}` };
  }
  applySnapshot(res.data.payload);
  setRev(Number(res.data.rev) || 0);
  setDirty(false);
  return { state: 'pulled', rev: Number(res.data.rev) };
}

/** 用户主动选择"用本地覆盖云端"（跳过 rev 校验，服务端会先回 409，故直接拉最新 rev 再写）。 */
export async function forcePush(): Promise<SyncResult> {
  if (!isSyncConfigured()) return { state: 'disabled' };
  const cfg = getSyncConfig();
  const meta = await call(cfg, { method: 'GET', metaOnly: true, timeoutMs: 12000 });
  const remoteRev = meta.status === 200 && meta.data ? Number(meta.data.rev) || 0 : cfg.lastRev;
  setRev(remoteRev);
  return pushSync();
}

/** 启动时拉一次。永不抛异常。 */
export async function syncOnBoot(timeoutMs = 3000): Promise<SyncResult> {
  if (!isSyncConfigured()) return { state: 'disabled' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { state: 'offline' };
  }
  try {
    return await pullSync(timeoutMs);
  } catch (e: any) {
    return { state: 'error', message: String(e?.message || e) };
  }
}

/* ------------------------------------------------------------------ *
 * 自动推送（防抖）
 * ------------------------------------------------------------------ */

let pushTimer: ReturnType<typeof setTimeout> | null = null;

export function schedulePush(delayMs = 4000): void {
  if (!isSyncConfigured()) return;
  setDirty(true);
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    if (busy) return;
    busy = true;
    pushSync()
      .catch(() => {
        /* 失败已记在 dirty 标记里，下次再来 */
      })
      .finally(() => {
        busy = false;
      });
  }, delayMs);
}

/* ------------------------------------------------------------------ *
 * 状态描述（给 UI 用）
 * ------------------------------------------------------------------ */

export function describeSyncResult(result: SyncResult): string {
  switch (result.state) {
    case 'disabled':
      return '未启用';
    case 'unchanged':
      return result.message || '已是最新';
    case 'pulled':
      return `已从云端拉取（v${result.rev}）`;
    case 'pushed':
      return `已上传到云端（v${result.rev}）`;
    case 'conflict':
      return result.message || '云端与本地都有改动，需你选择保留哪一份';
    case 'offline':
      return result.message || '离线，改动留在本地';
    case 'error':
      return result.message || '同步失败';
    default:
      return '';
  }
}
