import { join } from 'node:path';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { node } from '../.electron-vendors.cache.json';

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
    },
  },
  ssr: {
    noExternal: ['@sentry/electron'],
  },
  build: {
    ssr: true,
    sourcemap: 'inline',
    target: `node${node}`,
    outDir: 'dist',
    assetsDir: '.',
    minify: process.env.MODE !== 'development',
    lib: {
      entry: 'src/index.ts',
      formats: ['cjs'],
    },
    rollupOptions: {
      output: {
        entryFileNames: '[name].cjs',
      },
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },
  plugins: [
    {
      name: 'patch-sentry-electron-normalize',
      transform(code, id) {
        if (id.includes('@sentry') && id.includes('normalize.js')) {
          // electron.app is not yet initialized at module load time in Electron 40.
          // Defer the call until getModuleFromFilename is first used.
          return code.replace(
            /const getModuleFromFilename = .*?createGetModuleFromFilename\(electron\.app\.getAppPath\(\)\);/,
            'let _getModuleFromFilename;\nconst getModuleFromFilename = (...args) => {\n  if (!_getModuleFromFilename) _getModuleFromFilename = node.createGetModuleFromFilename(electron.app.getAppPath());\n  return _getModuleFromFilename(...args);\n};',
          );
        }
      },
    },
    sentryVitePlugin({
      org: 'decentraland',
      project: 'creator-hub',
      disable: process.env.MODE === 'development' || process.env.DRY_RUN,
    }),
  ],
};

export default config;
