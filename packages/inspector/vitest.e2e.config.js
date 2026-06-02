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
    // Absorb slow-machine variance (stale reads, worker crashes) that only shows
    // up on heavily-loaded CI runners and never reproduces locally. This is for
    // environmental noise, not deterministic races — those are fixed in the test
    // logic (see Hierarchy.openContextMenuItem).
    retry: 2,
    setupFiles: ['./test/e2e/setup.ts'],
    setupFilesAfterEnv: ['./test/e2e/types.d.ts'],
    pool: 'forks', // use forks instead of threads for better isolation
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
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
