import app from '../server.js';

export default function handler(req: any, res: any) {
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  try {
    return app(req, res);
  } catch (err: any) {
    console.error('[api/wxpusher-check-scan] crashed:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'handler_crashed', message: String(err?.message || err).slice(0, 500) }));
    }
    return undefined;
  }
}
