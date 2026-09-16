export default function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    status: "ok",
    time: new Date().toISOString(),
    runtime: "vercel-serverless",
  });
}
