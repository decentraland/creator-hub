import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '/@/': join(__dirname, 'renderer/src') + '/',
      '/shared/': join(__dirname, 'shared') + '/',
      '/assets/': join(__dirname, 'renderer/assets') + '/',
      '#store': join(__dirname, 'renderer/src/modules/store') + '/',
      '#preload': join(__dirname, 'preload/src/index'),
    },
  },
  test: {
    environment: 'node',
  },
});
