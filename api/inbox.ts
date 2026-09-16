import app from '../server';

/**
 * 云平台 serverless 入口：/api/inbox
 *
 * 这个文件最初是一份**独立实现** —— 自带一份 inboxQueue、自带 CORS 头、
 * 自己处理 GET/POST、自己复制了一份内容长度校验。三个问题：
 *
 * 1. 它和 server.ts 里那份 inboxQueue 是**两套内存**。同一路径两个处理器，
 *    平台按文件路径优先命中这里，server.ts 的收件箱逻辑实际上永远走不到；
 *    而本地开发（直接跑 express）走 server.ts、线上走这里，两边必然漂移。
 * 2. 它的访问控制漏了：requireInboxAccess 写好了却没被调用，接口对全网开放。
 * 3. CORS 写死通配 * —— 配合「GET 读取后清空」，等于任何网页都能把队列搬走。
 *
 * 所以改成薄转发：收件箱逻辑与 CORS 都只有一份，在 server.ts。
 * （编辑 /api/inbox 的行为请改 server.ts，不要在本文件里再加业务逻辑。）
 */
export default function handler(req: any, res: any) {
  // 与 api/[...path].ts 一致：保证进 Express 时路径带 /api 前缀。
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }

  try {
    return app(req, res);
  } catch (err: any) {
    console.error('[api/inbox] crashed:', err);
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
