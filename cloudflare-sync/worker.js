/**
 * LingoLog 多端同步后端 —— Cloudflare Worker + D1
 *
 * 设计要点：
 *  1) 没有账号体系。同步码（26 位 Crockford Base32 ≈ 130 bit）就是唯一凭证，
 *     服务端只存它的 SHA-256，不存明文。这是刻意的：账号体系（注册/登录/找回）
 *     比"上线"大一个量级，而一个人多端不需要它。
 *  2) 乐观锁。POST 必须带 baseRev，命中才 rev+1，否则回 409。
 *     这是"手机上刚复习完、电脑拿旧数据覆盖回去"的唯一防线。
 *  3) 服务端兜底剥离 settings.customApiKey。老客户端即使发上来也不落库。
 *  4) D1 绑定缺失时 /health 返回 ok:false，客户端据此静默禁用同步，不报错。
 *
 * 接口：
 *   GET  /health                        → { ok, hasDb, tableOk }
 *   GET  /sync      X-Sync-Code: <码>   → { rev, updatedAt, size, payload }
 *                     X-Sync-Meta: 1    → 只回 { rev, updatedAt, size }（省流量）
 *   POST /sync      X-Sync-Code: <码>   → body { baseRev, payload }  → { ok, rev }
 *   DELETE /sync    X-Sync-Code: <码>   → 抹掉云端这份数据
 */

const MAX_PAYLOAD_BYTES = 1024 * 1024; // 1 MB。个人数据量级绰绰有余。
const MIN_CODE_LEN = 20;
const MAX_CODE_LEN = 64;

// 同步码走请求头，不走 URL —— URL 会进各级日志，头不会。
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Code, X-Sync-Meta',
  'Access-Control-Max-Age': '86400',
};

function reply(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign(
      {
        'Content-Type': 'application/json; charset=utf-8',
        // 同步数据必须每次拿最新，任何一层缓存都不能留
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
      CORS_HEADERS,
    ),
  });
}

async function hashCode(code) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

function normalizeCode(raw) {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase().replace(/[\s-]/g, '');
  if (code.length < MIN_CODE_LEN || code.length > MAX_CODE_LEN) return null;
  if (!/^[0-9A-Z]+$/.test(code)) return null;
  return code;
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * 服务端兜底：把 settings.customApiKey 摘掉。
 * 注意是 delete 而不是置空 —— 置空会在拉取的设备上把本地密钥一起抹掉。
 */
function stripSecrets(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  if (!payload.settings || typeof payload.settings !== 'object' || Array.isArray(payload.settings)) {
    return payload;
  }
  const settings = Object.assign({}, payload.settings);
  delete settings.customApiKey;
  delete settings.apiKey;
  return Object.assign({}, payload, { settings: settings });
}

export default {
  async fetch(request, env) {
    let url;
    try {
      url = new URL(request.url);
    } catch (e) {
      return reply({ error: 'bad_request' }, 400);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // ---------- 健康检查 ----------
    if (url.pathname === '/health') {
      const hasDb = Boolean(env && env.DB);
      let tableOk = false;
      let error = null;
      if (hasDb) {
        try {
          await env.DB.prepare('SELECT 1 FROM sync_blobs LIMIT 1').all();
          tableOk = true;
        } catch (e) {
          error = String((e && e.message) || e);
        }
      }
      return reply(
        {
          ok: hasDb && tableOk,
          hasDb: hasDb,
          tableOk: tableOk,
          error: error,
          time: nowIso(),
        },
        200,
      );
    }

    if (url.pathname !== '/sync') {
      return reply({ error: 'not_found' }, 404);
    }

    // 绑定没配好就明确告诉客户端，让它自己静默关掉同步，而不是抛异常
    if (!env || !env.DB) {
      return reply({ error: 'db_not_configured', message: '未绑定 D1 数据库（变量名必须是 DB）' }, 503);
    }

    const code = normalizeCode(request.headers.get('X-Sync-Code'));
    if (!code) {
      return reply(
        { error: 'bad_code', message: '同步码格式不合法：20–64 位 A–Z / 0–9' },
        400,
      );
    }
    const codeHash = await hashCode(code);

    // ---------- 读取 ----------
    if (request.method === 'GET') {
      let row = null;
      try {
        row = await env.DB.prepare(
          'SELECT rev, updated_at, size, payload FROM sync_blobs WHERE code_hash = ?',
        )
          .bind(codeHash)
          .first();
      } catch (e) {
        return reply({ error: 'db_error', message: String((e && e.message) || e) }, 500);
      }

      if (!row) {
        // 云端还没有这份数据 —— 不是错误，是"第一次同步"的正常前置状态
        return reply({ error: 'empty', rev: 0, message: '云端暂无数据' }, 404);
      }

      const metaOnly = request.headers.get('X-Sync-Meta') === '1';
      if (metaOnly) {
        return reply({ rev: row.rev, updatedAt: row.updated_at, size: row.size }, 200);
      }

      let payload;
      try {
        payload = JSON.parse(row.payload);
      } catch (e) {
        return reply({ error: 'corrupt', message: '云端数据解析失败，未覆盖本地' }, 500);
      }

      return reply(
        { rev: row.rev, updatedAt: row.updated_at, size: row.size, payload: payload },
        200,
      );
    }

    // ---------- 写入 ----------
    if (request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return reply({ error: 'bad_json' }, 400);
      }

      const baseRev = Number.isInteger(body && body.baseRev) ? body.baseRev : -1;
      if (baseRev < 0) {
        return reply({ error: 'missing_base_rev', message: '必须带整数 baseRev' }, 400);
      }

      const payload = stripSecrets(body && body.payload);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return reply({ error: 'bad_payload', message: 'payload 必须是对象' }, 400);
      }

      let serialized;
      try {
        serialized = JSON.stringify(payload);
      } catch (e) {
        return reply({ error: 'unserializable' }, 400);
      }

      const size = new TextEncoder().encode(serialized).length;
      if (size > MAX_PAYLOAD_BYTES) {
        return reply({ error: 'payload_too_large', size: size, limit: MAX_PAYLOAD_BYTES }, 413);
      }

      let current = null;
      try {
        current = await env.DB.prepare('SELECT rev FROM sync_blobs WHERE code_hash = ?')
          .bind(codeHash)
          .first();
      } catch (e) {
        return reply({ error: 'db_error', message: String((e && e.message) || e) }, 500);
      }

      const stamp = nowIso();

      if (!current) {
        if (baseRev !== 0) {
          return reply({ error: 'rev_conflict', rev: 0, message: '云端尚无数据，baseRev 应为 0' }, 409);
        }
        try {
          await env.DB.prepare(
            'INSERT INTO sync_blobs (code_hash, rev, updated_at, size, payload) VALUES (?, 1, ?, ?, ?)',
          )
            .bind(codeHash, stamp, size, serialized)
            .run();
        } catch (e) {
          // 两台设备同时首次写入的竞态。谁先谁赢，输的一方拿到真实 rev 去决定下一步。
          const after = await env.DB.prepare('SELECT rev FROM sync_blobs WHERE code_hash = ?')
            .bind(codeHash)
            .first();
          return reply({ error: 'rev_conflict', rev: after ? after.rev : 1 }, 409);
        }
        return reply({ ok: true, rev: 1 }, 200);
      }

      if (current.rev !== baseRev) {
        return reply(
          { error: 'rev_conflict', rev: current.rev, message: '云端已更新，先拉取再决定是否覆盖' },
          409,
        );
      }

      let result;
      try {
        result = await env.DB.prepare(
          'UPDATE sync_blobs SET rev = rev + 1, updated_at = ?, size = ?, payload = ? WHERE code_hash = ? AND rev = ?',
        )
          .bind(stamp, size, serialized, codeHash, baseRev)
          .run();
      } catch (e) {
        return reply({ error: 'db_error', message: String((e && e.message) || e) }, 500);
      }

      const changed = result && result.meta ? Number(result.meta.changes) : 0;
      if (changed !== 1) {
        const after = await env.DB.prepare('SELECT rev FROM sync_blobs WHERE code_hash = ?')
          .bind(codeHash)
          .first();
        return reply(
          { error: 'rev_conflict', rev: after ? after.rev : baseRev + 1 },
          409,
        );
      }

      return reply({ ok: true, rev: baseRev + 1 }, 200);
    }

    // ---------- 重置 ----------
    if (request.method === 'DELETE') {
      try {
        await env.DB.prepare('DELETE FROM sync_blobs WHERE code_hash = ?').bind(codeHash).run();
      } catch (e) {
        return reply({ error: 'db_error', message: String((e && e.message) || e) }, 500);
      }
      return reply({ ok: true }, 200);
    }

    return reply({ error: 'method_not_allowed' }, 405);
  },
};
