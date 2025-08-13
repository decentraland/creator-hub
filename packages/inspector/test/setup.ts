import { TextEncoder, TextDecoder } from 'util';
import { vi } from 'vitest';

Object.assign(global, { TextDecoder, TextEncoder });

// Mock DynamicTexture to prevent canvas context errors in tests
vi.mock('@babylonjs/core', () => {
  const originalModule = vi.importActual('@babylonjs/core');
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
