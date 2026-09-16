let inboxQueue: Array<{ id: string; text: string; createdAt: string }> = [];

export default function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-LingoLog-Access-Token");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {}
    }
    const { text } = body || {};
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "内容不能为空" });
    }
    const newItem = {
      id: Math.random().toString(36).substring(2, 9),
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    inboxQueue.push(newItem);
    return res.status(200).json({ ok: true, count: inboxQueue.length });
  }

  if (req.method === "GET") {
    const items = [...inboxQueue];
    inboxQueue = [];
    return res.status(200).json({ items });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
