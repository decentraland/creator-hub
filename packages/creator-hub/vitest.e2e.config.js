import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['e2e/**/*.spec.ts'],
    // The beforeAll cold-launches Electron — the slowest, most run-to-run-variable
    // step — on a contended macos-latest CI runner. Vitest's ~10s default hookTimeout
    // is not enough headroom and trips intermittently; 60s lets a genuinely hung
    // launch still fail in reasonable time. (The launch beforeAll sets its own 120s.)
    testTimeout: 60000,
    hookTimeout: 60000,
    pool: 'forks', // use forks instead of threads for better isolation
    poolOptions: {
      forks: {
        // Each spec file runs in its own fresh forked process so one Electron
        // instance's native memory can't accumulate across files.
        singleFork: false,
      },
    },
    // Run spec files one at a time so only one Electron app is alive at once.
    fileParallelism: false,
  },
});
