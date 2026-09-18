// ⚠️ 相对导入必须带 .js 后缀（原因见 api/health.ts 顶部）。
import { serveEdgeTts } from '../src/server/edgeTts.js';

/**
 * 云平台 serverless 入口：/api/tts
 *
 * 这个文件刻意**不导入 server.ts**（不像 api/inbox.ts 那样薄转发整个 Express 应用）。
 * 原因有两个：
 *
 * 1. 冷启动。合成一次要 1 秒出头，如果再花时间把一个装着 @google/genai、
 *    express 的完整应用初始化一遍，第一句朗读就得等好几秒 —— 而这是手机端
 *    唯一的声音来源，等待直接等于「点了没反应」。
 * 2. 不带 Express 那层中间件，也就顺带避开了 server.ts 里对 /api 一视同仁的
 *    `Cache-Control: no-store`。音频必须可缓存（同句不重复合成全靠它）。
 *
 * 业务逻辑一行都不在这里：全在 src/server/edgeTts.ts，本地 express 路由调的是
 * 同一个函数。改行为请改那个文件。
 *
 * 这里传给合成的只有两样东西：查询串 + 一个限流用的键。**不用 req.query**，
 * 因为那层解析是平台给的便利，不是 Node 原生契约 —— 上一课（api/inbox.ts）
 * 正是踩在「以为平台给的 req/res 就是 Express 那套」上，结果线上 500。
 */
export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Allow', 'GET, OPTIONS');
    res.end();
    return;
  }

  // 刻意不回 CORS 头：这个音频只给本站前端用（同源 <audio> 不需要 CORS）。
  // 不放开跨域读取，别的站点就没法把这台服务器当免费的发音接口用。
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Allow', 'GET, OPTIONS');
    res.end(JSON.stringify({ error: 'method_not_allowed' }));
    return;
  }

  const url = String(req.url || '');
  const queryString = url.includes('?') ? url.slice(url.indexOf('?')) : '';

  const forwarded = req.headers?.['x-forwarded-for'];
  const clientKey =
    (Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '').split(',')[0]).trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  try {
    await serveEdgeTts(queryString, clientKey, res);
  } catch (err: any) {
    console.error('[api/tts] crashed:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          error: 'tts_handler_crashed',
          message: String(err?.message || err).slice(0, 300),
        })
      );
    }
  }
}
