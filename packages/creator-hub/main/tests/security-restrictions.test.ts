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
    /**
     * Every value the response ends up carrying for `name`, across all casings.
     *
     * Electron writes one header line per key of the object the handler returns, so two keys
     * differing only in case become two header lines — which Chromium joins into a single
     * unparseable value. Reading case-insensitively is what makes that visible: a duplicate
     * shows up here as two entries rather than hiding behind a same-case lookup.
     */
    valuesFor(url: string, name: string, responseHeaders: Headers = {}) {
      let result: { responseHeaders: Headers } | undefined;
      handler({ url, responseHeaders }, r => (result = r));
      return Object.entries(result!.responseHeaders)
        .filter(([key]) => key.toLowerCase() === name.toLowerCase())
        .flatMap(([, values]) => values);
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
        expect(subject.valuesFor(url, 'Cross-Origin-Embedder-Policy')).toEqual(['credentialless']);
      }
    });

    it('should not add a second embedder policy when the response already sent a lowercase one, which Chromium would read as no policy at all and block the frame (#1485)', () => {
      const values = subject.valuesFor(urls[0], 'Cross-Origin-Embedder-Policy', {
        'cross-origin-embedder-policy': ['credentialless'],
      });

      expect(values).toEqual(['credentialless']);
    });

    it('should keep the resource policy the response already sent', () => {
      expect(
        subject.valuesFor(urls[0], 'Cross-Origin-Resource-Policy', {
          'cross-origin-resource-policy': ['cross-origin'],
        }),
      ).toEqual(['cross-origin']);
    });

    it('should not be opener-isolated, which only the app documents need', () => {
      expect(subject.valuesFor(urls[0], 'Cross-Origin-Opener-Policy')).toEqual([]);
    });
  });

  describe("when the request is for one of the app's own documents", () => {
    it.each(['file:///Applications/app.asar/index.html', 'http://localhost:5173/index.html'])(
      'should isolate %s',
      url => {
        expect(subject.valuesFor(url, 'Cross-Origin-Opener-Policy')).toEqual(['same-origin']);
        expect(subject.valuesFor(url, 'Cross-Origin-Embedder-Policy')).toEqual(['credentialless']);
        expect(subject.valuesFor(url, 'Cross-Origin-Resource-Policy')).toEqual(['cross-origin']);
      },
    );

    it('should force isolation over whatever the response sent', () => {
      expect(
        subject.valuesFor('http://localhost:5173/index.html', 'Cross-Origin-Embedder-Policy', {
          'Cross-Origin-Embedder-Policy': ['unsafe-none'],
        }),
      ).toEqual(['credentialless']);
    });

    it('should replace the response policy whatever casing it arrived in', () => {
      expect(
        subject.valuesFor('http://localhost:5173/index.html', 'Cross-Origin-Embedder-Policy', {
          'cross-origin-embedder-policy': ['unsafe-none'],
        }),
      ).toEqual(['credentialless']);
    });
  });

  describe('when the request is for the studios admin API', () => {
    const url = 'https://studios.decentraland.org/api/scenes';

    it('should allow the app to read it when the response sent no origin of its own', () => {
      expect(subject.valuesFor(url, 'Access-Control-Allow-Origin')).toEqual(['*']);
    });

    it('should not add a second allowed origin when the response already sent one, since two are rejected outright and would block the request this is meant to allow', () => {
      expect(
        subject.valuesFor(url, 'Access-Control-Allow-Origin', {
          'access-control-allow-origin': ['*'],
        }),
      ).toEqual(['*']);
    });
  });

  describe('when the request is for the asset-packs content CDN', () => {
    const url =
      'https://builder-items.decentraland.org/contents/bafkreic73ieebx4cins2vy26rbyksh3nutvn4ynrit2sfwhzv6qz64zfti';

    it('should inject an allowed origin so the inspector iframe can fetch Smart Item files when CloudFront served a cached response without one', () => {
      expect(subject.valuesFor(url, 'Access-Control-Allow-Origin')).toEqual(['*']);
    });

    it('should not add a second allowed origin when the CDN already sent one', () => {
      expect(
        subject.valuesFor(url, 'Access-Control-Allow-Origin', {
          'access-control-allow-origin': ['*'],
        }),
      ).toEqual(['*']);
    });
  });

  describe('when the request is for an unrelated external origin', () => {
    it('should add no cross-origin headers', () => {
      const url = 'https://www.youtube.com/embed/abc';

      expect(subject.valuesFor(url, 'Cross-Origin-Embedder-Policy')).toEqual([]);
      expect(subject.valuesFor(url, 'Cross-Origin-Opener-Policy')).toEqual([]);
    });
  });
});
