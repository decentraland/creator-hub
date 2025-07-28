/* eslint-env node */

import { join } from 'node:path';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react';
import { renderer } from 'unplugin-auto-expose';
import { chrome } from '../.electron-vendors.cache.json';

const PACKAGE_ROOT = __dirname;
const PACKAGE_DIR = join(PACKAGE_ROOT, '..');

/**
 * @type {import('vite').UserConfig}
 * @see https://vitejs.dev/config/
 */
const config = {
  mode: process.env.MODE,
  root: PACKAGE_ROOT,
  envDir: PACKAGE_DIR,
  resolve: {
    alias: {
      '/@/': join(PACKAGE_ROOT, 'src') + '/',
      '/shared/': join(PACKAGE_ROOT, '../shared') + '/',
      '/assets/': join(PACKAGE_ROOT, 'assets') + '/',
      '#store': join(PACKAGE_ROOT, 'src', 'modules', 'store') + '/',
    },
  },
  define: {
    'process.env.E2E': JSON.stringify(!!process.env.E2E),
    'process.env.E2E_WALLET': JSON.stringify(process.env.E2E_WALLET?.toLowerCase()),
  },
  base: '',
  server: {
    fs: {
      strict: true,
    },
  },
  build: {
    sourcemap: true,
    target: `chrome${chrome}`,
    outDir: 'dist',
    assetsDir: '.',
    rollupOptions: {
      input: [join(PACKAGE_ROOT, 'index.html'), join(PACKAGE_ROOT, 'debugger.html')],
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setupTests.ts'],
    include: ['./src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  },
  plugins: [
    react(),
    renderer.vite({
      preloadEntry: join(PACKAGE_ROOT, '../preload/src/index.ts'),
    }),
    sentryVitePlugin({
      org: 'decentraland',
      project: 'creator-hub',
      disable: process.env.MODE === 'development' || process.env.DRY_RUN,
    }),
  ],
};

export default config;
