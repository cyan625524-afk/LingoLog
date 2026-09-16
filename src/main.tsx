import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

/**
 * 开发环境自愈：注销遗留的 Service Worker。
 *
 * 为什么需要：把 vite-plugin-pwa 的 devOptions 关掉，只能阻止「新」的 SW 注册；
 * 浏览器里已经注册过的那个会继续活着，继续用旧缓存回答请求 —— 于是「改了代码
 * 页面还是白的」照旧复现。所以 dev 下主动清一次，让开发环境回到干净状态。
 *
 * 生产不受影响：那时 import.meta.env.DEV 为 false，SW 由 workbox 正常接管，
 * 离线与「安装到桌面」能力保持原样。
 */
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => {
      if (regs.length === 0) return;
      return Promise.all(regs.map((r) => r.unregister())).then(() =>
        console.info('[dev] 已注销遗留的 Service Worker，避免旧缓存干扰开发。')
      );
    })
    .catch(() => {
      /* 注销失败不影响开发，静默忽略 */
    });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
