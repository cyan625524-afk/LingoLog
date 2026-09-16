import app from '../server';

/**
 * 云平台 serverless 入口：/api/health
 *
 * 这个文件一开始只返回 { status, time, runtime } —— 而平台是**按文件路径优先匹配**的，
 * /api/health 会命中这个文件而不是 catch-all api/[...path].ts。
 * 结果是 server.ts 里那个真正的诊断端点被盖掉，用户再也看不到
 * 「函数是不是在被反复重启、环境变量到底配了没有」这些排查 500 唯一有用的信息。
 *
 * 所以这里转发给 express，让诊断逻辑只有一份。
 */
export default function handler(req: any, res: any) {
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  try {
    return app(req, res);
  } catch (err: any) {
    console.error('[api/health] crashed:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'handler_crashed', message: String(err?.message || err).slice(0, 500) }));
    }
    return undefined;
  }
}
