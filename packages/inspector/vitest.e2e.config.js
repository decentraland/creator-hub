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
        // Bound how many spec files (each a fresh fork with its own Chromium +
        // Babylon) run at once. The old fully-serial design existed to avoid N
        // concurrent browsers OOM-ing the runner; capping the pool gets most of
        // the wall-clock win while keeping peak memory bounded — unlike
        // singleFork, memory is still reclaimed as each file's fork exits. CI
        // runners are memory-constrained (macos-latest: 3 vCPU / ~7GB), so cap
        // at 2 there; locally use more.
        maxForks: process.env.CI ? 2 : 4,
        minForks: 1,
      },
    },
    // Run spec files concurrently, bounded by maxForks above. Was fully serial
    // (fileParallelism: false); maxForks now caps the concurrent-browser count
    // that the serial design was guarding against.
    fileParallelism: true,
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
