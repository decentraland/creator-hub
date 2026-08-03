import { beforeEach, describe, expect, it, vi } from 'vitest';

// `security-restrictions` registers its handlers as a side effect of being imported, so the
// electron surface it touches has to exist before the module body runs.
const mocks = vi.hoisted(() => ({
  appOn: vi.fn(),
  onBeforeSendHeaders: vi.fn(),
  onHeadersReceived: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { on: mocks.appOn },
  shell: { openExternal: vi.fn() },
  session: {
    defaultSession: {
      webRequest: {
        onBeforeSendHeaders: mocks.onBeforeSendHeaders,
        onHeadersReceived: mocks.onHeadersReceived,
      },
    },
  },
}));

type Headers = Record<string, string[]>;

async function loadModule() {
  vi.resetModules();
  vi.clearAllMocks();
  await import('../src/security-restrictions');

  const ready = mocks.appOn.mock.calls.find(([event]) => event === 'ready');
  (ready![1] as () => void)();

  const [filter, handler] = mocks.onHeadersReceived.mock.calls[0] as [
    { urls: string[] },
    (details: { url: string; responseHeaders: Headers }, cb: (r: any) => void) => void,
  ];
  return {
    urls: filter.urls,
    headersFor(url: string, responseHeaders: Headers = {}) {
      let result: { responseHeaders: Headers } | undefined;
      handler({ url, responseHeaders }, r => (result = r));
      return result!.responseHeaders;
    },
  };
}

describe('response header rules', () => {
  let subject: Awaited<ReturnType<typeof loadModule>>;

  beforeEach(async () => {
    subject = await loadModule();
  });

  describe('when the request is for the wearable preview used by asset previews', () => {
    const urls = [
      'https://wearable-preview.decentraland.org/?profile=default',
      'https://wearable-preview.decentraland.today/',
      'https://wearable-preview.decentraland.zone/',
    ];

    it('should be covered by the registered filter', () => {
      for (const url of urls) {
        expect(
          subject.urls.some(pattern => url.startsWith(pattern.replace(/\*$/, ''))),
          `${url} is not covered by the filter, so the handler never runs for it`,
        ).toBe(true);
      }
    });

    it('should get an embedder policy so an isolated document can embed it', () => {
      for (const url of urls) {
        expect(subject.headersFor(url)['Cross-Origin-Embedder-Policy']).toEqual(['credentialless']);
      }
    });

    it('should keep the resource policy the response already sent', () => {
      const headers = subject.headersFor(urls[0], {
        'Cross-Origin-Resource-Policy': ['cross-origin'],
      });

      expect(headers['Cross-Origin-Resource-Policy']).toEqual(['cross-origin']);
    });

    it('should not be opener-isolated, which only the app documents need', () => {
      expect(subject.headersFor(urls[0])['Cross-Origin-Opener-Policy']).toBeUndefined();
    });
  });

  describe("when the request is for one of the app's own documents", () => {
    it.each(['file:///Applications/app.asar/index.html', 'http://localhost:5173/index.html'])(
      'should isolate %s',
      url => {
        const headers = subject.headersFor(url);

        expect(headers['Cross-Origin-Opener-Policy']).toEqual(['same-origin']);
        expect(headers['Cross-Origin-Embedder-Policy']).toEqual(['credentialless']);
        expect(headers['Cross-Origin-Resource-Policy']).toEqual(['cross-origin']);
      },
    );

    it('should force isolation over whatever the response sent', () => {
      const headers = subject.headersFor('http://localhost:5173/index.html', {
        'Cross-Origin-Embedder-Policy': ['unsafe-none'],
      });

      expect(headers['Cross-Origin-Embedder-Policy']).toEqual(['credentialless']);
    });
  });

  describe('when the request is for an unrelated external origin', () => {
    it('should add no cross-origin headers', () => {
      const headers = subject.headersFor('https://www.youtube.com/embed/abc');

      expect(headers['Cross-Origin-Embedder-Policy']).toBeUndefined();
      expect(headers['Cross-Origin-Opener-Policy']).toBeUndefined();
    });
  });
});
