import { join } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react';
import { preload } from 'unplugin-auto-expose';
import { renderer } from 'unplugin-auto-expose';
import { node, chrome } from './.electron-vendors.cache.json';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  const devServerUrl = isDev ? 'http://localhost:5173' : undefined;

  return {
    main: {
      mode: mode,
      plugins: [
        sentryVitePlugin({
          org: 'decentraland',
          project: 'creator-hub',
          disable: isDev,
        }),
        externalizeDepsPlugin(),
      ],
      define: {
        'import.meta.env.VITE_DEV_SERVER_URL': JSON.stringify(devServerUrl),
      },
      resolve: {
        alias: {
          '/@/': join(__dirname, 'main/src') + '/',
          '/shared/': join(__dirname, 'shared') + '/',
        },
      },
      build: {
        ssr: true,
        sourcemap: 'inline',
        target: `node${node}`,
        outDir: 'main/dist',
        assetsDir: '.',
        minify: !isDev,
        lib: {
          entry: 'main/src/index.ts',
          formats: ['es'],
        },
        rollupOptions: {
          output: {
            entryFileNames: '[name].js',
          },
        },
        emptyOutDir: true,
        reportCompressedSize: false,
      },
    },
    preload: {
      mode: mode,
      plugins: [
        sentryVitePlugin({
          org: 'decentraland',
          project: 'creator-hub',
          disable: isDev,
        }),
        externalizeDepsPlugin(),
        preload.vite(),
      ],
      resolve: {
        alias: {
          '/shared/': join(__dirname, 'shared') + '/',
        },
      },
      build: {
        ssr: true,
        sourcemap: 'inline',
        target: `node${node}`,
        outDir: 'preload/dist',
        minify: !isDev,
        lib: {
          entry: 'preload/src/index.ts',
          formats: ['es'],
        },
        rollupOptions: {
          output: {
            // ESM preload scripts must have the .mjs extension
            // https://www.electronjs.org/docs/latest/tutorial/esm#esm-preload-scripts-must-have-the-mjs-extension
            entryFileNames: '[name].mjs',
          },
        },
        emptyOutDir: true,
        reportCompressedSize: false,
      },
    },
    renderer: {
      mode: mode,
      root: 'renderer',
      resolve: {
        alias: {
          '/@/': join(__dirname, 'renderer/src') + '/',
          '/shared/': join(__dirname, 'shared') + '/',
          '/assets/': join(__dirname, 'renderer/assets') + '/',
          '#store': join(__dirname, 'renderer/src/modules/store') + '/',
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
        outDir: 'renderer/dist',
        assetsDir: '.',
        rollupOptions: {
          input: {
            index: join(__dirname, 'renderer/index.html'),
            debugger: join(__dirname, 'renderer/debugger.html'),
          },
        },
        emptyOutDir: true,
        reportCompressedSize: false,
      },
      plugins: [
        react(),
        renderer.vite({
          preloadEntry: join(__dirname, 'preload/src/index.ts'),
        }),
        sentryVitePlugin({
          org: 'decentraland',
          project: 'creator-hub',
          disable: isDev,
        }),
      ],
    },
  };
});
