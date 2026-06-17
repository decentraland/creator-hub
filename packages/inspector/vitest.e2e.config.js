import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/e2e/**/*.spec.ts'],
    // 60s (was 30s): on a heavily-loaded CI runner with slowMo:100, legitimately
    // long sequences (e.g. the multi-select drag test does 4 addChilds + a drag)
    // can exceed 30s. A genuinely hung/broken test still fails at 60s.
    testTimeout: 60000,
    hookTimeout: 60000,
    setupFiles: ['./test/e2e/setup.ts'],
    setupFilesAfterEnv: ['./test/e2e/types.d.ts'],
    pool: 'forks', // use forks instead of threads for better isolation
    poolOptions: {
      forks: {
        // Each spec file runs in its own fresh forked process. A single shared
        // worker (singleFork: true) accumulated Chromium/Babylon native memory
        // across files until the OS killed it mid-run in CI ("Worker exited
        // unexpectedly"); a fresh process per file reclaims that memory.
        singleFork: false,
      },
    },
    // Run spec files one at a time so only one headless Chromium is alive at
    // once (avoids N concurrent browsers, which would be worse than the bug).
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: [
      '@babylonjs/core',
      '@babylonjs/gui',
      '@babylonjs/inspector',
      '@babylonjs/loaders',
      '@babylonjs/materials',
    ],
  },
});
