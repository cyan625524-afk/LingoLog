// ⚠️ 相对导入必须带 .js 后缀（云平台 ESM 运行要求）。
import app from '../server.js';

/**
 * 云平台 serverless 入口：/api/cron-remind
 * 用于 Vercel Cron、Cloudflare Worker 或第三方定时器定时轮询未学状态并向微信发送提醒。
 */
export default function handler(req: any, res: any) {
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  try {
    return app(req, res);
  } catch (err: any) {
    console.error('[api/cron-remind] crashed:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'handler_crashed', message: String(err?.message || err).slice(0, 500) }));
    }
    return undefined;
  }
}
