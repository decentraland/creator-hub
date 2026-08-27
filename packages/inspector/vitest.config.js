import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  assetsInclude: ['**/*.glb', '**/*.gltf'],
  // Specs parse with oxc directly, never through the browser wasm fallback.
  define: { INSPECTOR_DEV_PARSER: 'false' },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    exclude: ['e2e/**/*.spec.ts'],
    testTimeout: 10000,
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
  ssr: {
    noExternal: ['@dcl/gltf-validator-ts'],
  },
});
