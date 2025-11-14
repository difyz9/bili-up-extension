import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  outDir: 'dist',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Bili UP Extension',
    description: '保存 YouTube/Bilibili 视频 URL 和字幕的浏览器扩展',
    version: '1.0.2',
    permissions: [
      'storage',
      'activeTab',
      'webRequest',
    ],
    host_permissions: [
      '*://*.youtube.com/*',
      '*://*.bilibili.com/*',
      'http://localhost:8096/*',
      'http://127.0.0.1:8096/*',
    ],
    web_accessible_resources: [
      {
        resources: ['page-interceptor.js'],
        matches: ['*://*.youtube.com/*'],
      },
    ],
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      128: '/icon/128.png',
    },
  },
});
