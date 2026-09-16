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

外部助手 inbox 默认关闭。只有在可信环境中明确设置 `ENABLE_INBOX=true` 和 `INBOX_TOKEN` 才会启用，并且调用方需要发送对应的 `X-LingoLog-Access-Token` 请求头。

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
