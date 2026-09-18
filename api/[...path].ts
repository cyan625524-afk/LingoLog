// ⚠️ 相对导入必须带 .js 后缀（原因见 api/health.ts 顶部）。
import app from '../server.js';

/**
 * 云平台 serverless 入口（catch-all：/api/*）。
 *
 * 为什么必须有这个文件：平台的函数是按文件路径路由的。
 * 只有 api/index.ts 时，请求 /api/health 会去找 api/health.ts —— 找不到就 404。
 * 用 rewrite 把 /api/(.*) 塌成 /api 是不行的：子路径会被丢掉，
 * 函数只收到 `/api`，Express 一条路由都匹配不上（这就是线上接口
 * 集体报错的原因）。catch-all 文件才是正解，平台会把原始路径交给它。
 *
 * 外面这层 try/catch 的理由与 api/index.ts 相同：函数在 express 之外抛错时，
 * 平台只回一个光秃秃的 HTTP 500，前端只能看到状态码。
 * 接住并返回 JSON，真实原因才能送到前端。
 */
export default function handler(req: any, res: any) {
  // Ensure req.url starts with /api for Express routing
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }

  try {
    return app(req, res);
  } catch (err: any) {
    console.error('[api] handler crashed before express could respond:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          error: 'handler_crashed',
          message: String(err?.message || err).slice(0, 500),
        })
      );
    }
    return undefined;
  }
}
