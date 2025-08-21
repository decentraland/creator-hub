import { vi } from 'vitest';

// Ensure TextDecoder and TextEncoder are available globally in happy-dom
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder;
}
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
}

// Mock DynamicTexture to prevent canvas context errors in tests
vi.mock('@babylonjs/core', async importOriginal => {
  const originalModule = (await importOriginal()) as any;
  return {
    ...originalModule,
    DynamicTexture: vi.fn().mockImplementation(() => ({
      getContext: vi.fn().mockReturnValue({
        fillStyle: '#000000',
        fillRect: vi.fn(),
      }),
      update: vi.fn(),
    })),
  };
});
