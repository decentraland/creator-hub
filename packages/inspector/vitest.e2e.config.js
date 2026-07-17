import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/e2e/**/*.spec.ts'],
    // 120s: heavy sequences with slowMo:100 have been observed exceeding 60s on
    // contended runners, and the per-action waits (60s default, 90s cold boot)
    // must fail first so their error — not a blunt vitest timeout — names the cause.
    testTimeout: 120000,
    hookTimeout: 120000,
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
