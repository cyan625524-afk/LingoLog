import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'manifest.json'],
        manifest: {
          id: '/',
          name: 'Remix LingoLog',
          short_name: 'LingoLog',
          description: '基于艾宾浩斯记忆曲线与 Gemini AI 赋能的复古打字机风地道英语表达练习与复习笔记应用',
          theme_color: '#364330',
          background_color: '#f3efe6',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/icon.svg',
              sizes: '192x192 512x512',
              type: 'image/svg+xml',
              purpose: 'any',
            },
            {
              src: '/icon.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        },
        // devOptions 关掉的理由：dev 下注册 Service Worker 会让「旧缓存」参与
        // 开发环境的请求，表现是改了代码页面还是白的、HMR 像没生效 —— 排查成本
        // 远高于它带来的好处。生产构建完全不受影响，workbox 照常生成并注册 SW，
        // 离线与「安装到桌面」能力一样都在。
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
