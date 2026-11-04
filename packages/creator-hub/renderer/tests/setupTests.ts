import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Mock preload modules
vi.mock('#preload', async () => {
  const actual = await import('../../preload/src/index.ts');

  const deepMockObject = (obj: Record<string, any>) => {
    const result: Record<string, any> = {};

    for (const key in obj) {
      const value = obj[key];
      if (typeof value === 'function') {
        result[key] = vi.fn(); // mock functions
      } else if (value && typeof value === 'object') {
        result[key] = deepMockObject(value); // recurse for nested modules
      } else {
        result[key] = value; // passthrough for constants if needed
      }
    }

    return result;
  };

  return deepMockObject(actual);
});

afterEach(() => {
  // Vitest runs without globals, so testing-library never registers its own
  // auto-cleanup and rendered trees would pile up across tests. Unmount BEFORE
  // clearing mocks: unmount effects call mocks (e.g. usePreviewCleanup kills the
  // preview), and clearing first would leak those calls into the next test.
  cleanup();
  vi.clearAllMocks();
});
