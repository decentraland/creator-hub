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
    // once. Running two concurrently was tried and reverted: the CI runner is
    // CPU-bound (macos-latest: 3 vCPU), so two browsers just contend — each
    // action ran ~40% slower and the drag/drop-heavy Hierarchy specs raced
    // (entities not settled → "Could not find entity"), for almost no
    // wall-clock win. Speed comes from the lower per-action slowMo instead
    // (test/e2e/setup.ts), which is safe precisely because runs stay serial.
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
