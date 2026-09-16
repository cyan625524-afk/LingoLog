import app from '../server';

/**
 * 云平台 serverless 入口（/api 与 /api/）。
 *
 * ⚠️ 这里有一条踩过的坑，改 vercel.json 前务必先读：
 * 不要为了「让 /api/* 都进这个函数」而加 rewrite `"/api/(.*)" -> "/api"`。
 * 那条 rewrite 会把子路径整个丢掉 —— 函数最终只收到 `/api`，
 * Express 里没有任何路由能匹配它，所有接口一起 404。
 * 正确做法是让 api/[...path].ts 这个 catch-all 接管 /api/*（见该文件），
 * 云平台会把**原始路径**交给 catch-all，/api/health 收到的就是 /api/health。
 *
 * 外面这层 try/catch 不是装饰：函数一旦在 express 之外抛错，
 * 平台只会回一个光秃秃的 HTTP 500，body 里没有任何线索。
 * 接住并返回 JSON，至少让真实原因能送到前端。
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
