import { join } from 'node:path';
import { node } from '../.electron-vendors.cache.json';

const PACKAGE_ROOT = __dirname;
const PACKAGE_DIR = join(PACKAGE_ROOT, '..');

// Second main-process bundle: the workers that run on the bundled real Node, not in Electron —
// the optimizer (src/optimizer-worker.ts) and the session recorder's transcription
// (src/transcribe-worker.ts) — so they get their own entries instead of chunks of index.js.
// Their toolchains are external on purpose: downloaded on first use into userData
// (modules/optimizer/tools.ts, modules/recording/tools.ts) and resolved from there at runtime,
// never inlined here.

/**
 * @type {import('vite').UserConfig}
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
  build: {
    ssr: true,
    sourcemap: 'inline',
    target: `node${node}`,
    outDir: 'dist',
    assetsDir: '.',
    minify: process.env.MODE !== 'development',
    lib: {
      entry: {
        'optimizer-worker': 'src/optimizer-worker.ts',
        'transcribe-worker': 'src/transcribe-worker.ts',
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['sharp', 'meshoptimizer', /^@gltf-transform\//, '@fugood/whisper.node'],
      output: {
        entryFileNames: '[name].js',
      },
    },
    emptyOutDir: false,
    reportCompressedSize: false,
  },
};

export default config;
