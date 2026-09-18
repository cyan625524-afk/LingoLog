# LingoLog

LingoLog 是一款复古电报局风格的地道英语表达学习工具：输入中文或英文想法，生成自然表达，保存为学习卡片，并通过间隔复习、语音练习和学习统计持续巩固。

## Features

- 地道英语表达生成，支持 Gemini 与 OpenAI 兼容服务商
- 艾宾浩斯间隔复习与每日复习队列
- 语音跟读、浏览器语音识别和本地评测降级
- Markdown / JSON 导入导出与 Anki CSV 导出
- localStorage 本地优先存储，离线翻译和 PWA 安装支持
- 深色模式、音效、学习任务、热力图和卡片收藏

## Run Locally

Prerequisite: Node.js 20 or newer.

```bash
npm install
cp .env.example .env
npm run dev
```

打开 `http://localhost:3000`。不配置 API Key 也可以使用离线降级流程；如需使用服务端 Gemini 密钥，在 `.env` 中填写 `GEMINI_API_KEY`。

## Production

```bash
npm run build
# macOS / Linux
NODE_ENV=production npm start
# Windows PowerShell
$env:NODE_ENV='production'; npm start
```

`NODE_ENV=production` 很重要：服务端会据此提供 `dist` 中的静态文件；未设置时会启动 Vite 开发中间件。

部署到公网时，优先让每位用户在应用内填写自己的 API Key，不要配置共享服务端密钥。若必须配置服务端密钥，请同时设置 `SERVER_API_ACCESS_TOKEN`，并在部署平台增加更上层的访问控制。服务端不会把浏览器密钥写入日志或备份。

外部助手 inbox（`/api/inbox`）用于让运行在 `gemini.google.com` 上的浏览器脚本把内容推进本应用。

访问控制**不需要任何配置**就有真实防护：只有来源白名单内的请求会被放行，默认允许 `https://gemini.google.com` 和本应用自己的域名；白名单外的来源连 CORS 响应头都拿不到（浏览器会拦掉响应，preflight 也过不去）。需要放行别的域名时，把它加进环境变量 `INBOX_ALLOWED_ORIGINS`（逗号分隔）。

想再加一道口令就设 `INBOX_TOKEN`，调用方请求时带上 `X-LingoLog-Access-Token` 头；不设则不要求。

⚠️ inbox 队列是**进程内存**。在 serverless 环境下每个实例内存独立、冷启动即清空，推送和拉取如果落在不同实例上就会「推成功了但读不到」。要真正可靠，需要换成云数据库。

## 部署到 Vercel（ESM 导入规则）

`package.json` 里是 `"type": "module"`，所以平台上的 `api/*` 函数**以原生 ESM 运行**。
ESM 不做扩展名补全，因此**跨文件相对导入必须带 `.js` 后缀**：

```ts
import app from '../server.js';                    // ✅
import { serveEdgeTts } from '../src/server/edgeTts.js'; // ✅
import app from '../server';                       // ❌ 线上 500
```

漏掉后缀的后果是 `FUNCTION_INVOCATION_FAILED (500)`：崩点在**模块加载阶段**，
`api/*.ts` 里那层 `try/catch` 一行都执行不到，返回体是平台吐的纯文本，
不是本项目的 JSON 错误。整条链（`api/*` → `server.ts` → `src/**`）每一段都要带后缀，
只补第一跳是不够的。

这个错误有三层伪装，构建和类型检查都发现不了：

- `tsconfig` 是 `moduleResolution: "bundler"`，无后缀写法一路绿灯；
- 本地跑（`npx tsx` / `vite build` / `esbuild`）都会自动补后缀，怎么测都正常；
- 所以「本地跑通了」「构建通过了」都不构成「线上接口能跑」的证据。

防线：`npm run check:esm`（已并入 `npm run lint`）会扫描 `api/*` 与 `server.ts`
的整条导入链，发现无后缀的相对导入就报错并退出码 1。改动 `api/` 或 `server.ts`
的导入后请跑一次。

上线后的验证方式**只能是真的打一次线上接口**：
`curl -i https://<你的域名>/api/health` 应返回 200 + JSON（含 `runtime` 字段）。
响应头里出现 `X-Vercel-Error: FUNCTION_INVOCATION_FAILED` 就是这条规则被破坏了。

## Tech Stack

React 19, TypeScript, Vite, Tailwind CSS, Express, PWA, `@google/genai`, `react-markdown`。

## Project Structure

- `src/App.tsx`: 应用状态与主要业务流程
- `src/components/views`: 学习、复习、归档、进度和个人中心
- `src/utils/storage.ts`: 本地数据、备份和迁移
- `src/utils/ebbinghaus.ts`: 间隔复习算法
- `server.ts`: API 代理、离线降级和语音评测接口
- `cloudflare-sync/`: 可选的 Cloudflare Worker + D1 同步后端

默认数据只保存在当前浏览器。浏览器 API Key 只会在用户主动开启引擎后发送到本应用服务端，再转发到所选服务商；导出的备份和多端同步会刻意移除 API Key。

## License

MIT License. See [LICENSE](LICENSE) for details.
