/* eslint-env node */

import { chrome } from '../../.electron-vendors.cache.json';
import react from '@vitejs/plugin-react';
import { renderer } from 'unplugin-auto-expose';
import { join } from 'node:path';

const PACKAGE_ROOT = __dirname;
const PROJECT_ROOT = join(PACKAGE_ROOT, '../..');

/**
 * @type {import('vite').UserConfig}
 * @see https://vitejs.dev/config/
 */
const config = {
  mode: process.env.MODE,
  root: PACKAGE_ROOT,
  envDir: PROJECT_ROOT,
  resolve: {
    alias: {
      '/@/': join(PACKAGE_ROOT, 'src') + '/',
      '/shared/': join(PROJECT_ROOT, 'packages', 'shared') + '/',
      '/assets/': join(PACKAGE_ROOT, 'assets') + '/',
      '#store': join(PACKAGE_ROOT, 'src', 'modules', 'store') + '/',
    },
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
      input: {
        index: join(PACKAGE_ROOT, 'index.html'),
        debugger: join(PACKAGE_ROOT, 'debugger.html'),
      },
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },
  test: {
    environment: 'happy-dom',
  },
  plugins: [
    react(),
    renderer.vite({
      preloadEntry: join(PACKAGE_ROOT, '../preload/src/index.ts'),
    }),
  ],
};

export default config;
