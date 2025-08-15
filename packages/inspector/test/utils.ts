import { vi } from 'vitest';

const xhrMock = vi.fn().mockImplementation(() => ({
  open: vi.fn(),
  send: vi.fn(),
  setRequestHeader: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  abort: vi.fn(),
}));

export function mockXMLHttpRequest() {
  const global = globalThis as any;
  if (global.XMLHttpRequest !== xhrMock) {
    const prev = global.XMLHttpRequest;
    global.XMLHttpRequest = xhrMock;
    return () => {
      global.XMLHttpRequest = prev;
    };
  }
  return () => {};
}
