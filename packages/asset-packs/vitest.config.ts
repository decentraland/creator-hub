import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.test.ts'],
    passWithNoTests: true,
  },
  ssr: {
    // Prevent vite from bundling @dcl/ecs protobuf generated files
    // in a way that breaks the test environment
    noExternal: [],
    external: ['protobufjs', 'protobufjs/minimal'],
  },
});
