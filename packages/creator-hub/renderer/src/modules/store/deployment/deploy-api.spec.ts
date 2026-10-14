import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChainId } from '@dcl/schemas';
import type * as SharedFetch from '/shared/fetch';
import type { DeployState } from '/@/lib/deploy';

const fetchMock = vi.fn();

vi.mock('/@/config', () => ({ config: { get: () => 'https://registry.example.org' } }));

vi.mock('/shared/fetch', async importOriginal => ({
  ...(await importOriginal<typeof SharedFetch>()),
  fetch: (...args: unknown[]) => fetchMock(...args),
}));

vi.mock('@sentry/electron/renderer', () => ({ captureException: vi.fn() }));

const {
  deployWithProgress,
  fetchDeployState,
  parseServerSentEvents,
  requestDeploymentCancel,
  MAX_POLL_FAILURES,
} = await import('./deploy-api');
const { isDeploymentError } = await import('/@/lib/deploy');

const URL = 'http://localhost:4000/api';
const PAYLOAD = { address: '0xabc', authChain: [], chainId: ChainId.ETHEREUM_MAINNET };

const state = (phase: DeployState['phase'], extra: Partial<DeployState> = {}): DeployState => ({
  phase,
  upload: null,
  result: null,
  error: null,
  ...extra,
});

const uploading = (sentBytes: number): DeployState =>
  state('uploading', {
    upload: {
      stage: 'uploading',
      sentBytes,
      totalBytes: 100,
      completedBatches: null,
      totalBatches: null,
    },
  });

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const sseResponse = (chunks: string[]) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  );

const sseEvent = (deployState: DeployState) =>
  `event: state\ndata: ${JSON.stringify(deployState)}\n\n`;

type Route = (init?: RequestInit) => Response | Promise<Response>;

/** Routes the mocked fetch by method and Accept header, one queued answer per call. */
const mockServer = (routes: Record<string, Route[]>) => {
  fetchMock.mockImplementation(async (_input: string, init?: RequestInit) => {
    const method = (init?.method ?? 'get').toUpperCase();
    const accept = (init?.headers as Record<string, string> | undefined)?.Accept;
    const key = method === 'GET' ? `GET ${accept}` : method;
    const queue = routes[key];
    const route = queue?.length > 1 ? queue.shift() : queue?.[0];
    if (!route) throw new Error(`Unexpected request ${key}`);
    return route(init);
  });
};

describe('parseServerSentEvents', () => {
  let result: ReturnType<typeof parseServerSentEvents>;

  describe('when the buffer holds complete events, a comment and a partial event', () => {
    beforeEach(() => {
      result = parseServerSentEvents(
        ': ping\n\nevent: state\ndata: {"a":1}\n\r\ndata: one\ndata: two\n\nevent: state\ndata: {"b"',
      );
    });

    it('should return the complete events with their names and joined data', () => {
      expect(result.events).toEqual([
        { event: 'state', data: '{"a":1}' },
        { event: 'message', data: 'one\ntwo' },
      ]);
    });

    it('should keep the partial event as the rest', () => {
      expect(result.rest).toBe('event: state\ndata: {"b"');
    });
  });
});

describe('fetchDeployState', () => {
  let result: DeployState | null;

  afterEach(() => {
    fetchMock.mockReset();
  });

  describe('when the CLI predates the deploy resource', () => {
    beforeEach(async () => {
      mockServer({ 'GET application/json': [() => new Response('Not found', { status: 404 })] });
      result = await fetchDeployState(URL);
    });

    it('should return null', () => {
      expect(result).toBeNull();
    });
  });

  describe('when the CLI serves the deploy resource', () => {
    beforeEach(async () => {
      mockServer({
        'GET application/json': [() => jsonResponse(200, state('awaiting-signature'))],
      });
      result = await fetchDeployState(URL);
    });

    it('should return the state', () => {
      expect(result).toEqual(state('awaiting-signature'));
    });
  });
});

describe('deployWithProgress', () => {
  let onState: ReturnType<typeof vi.fn>;
  let error: unknown;

  beforeEach(() => {
    onState = vi.fn();
    error = undefined;
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.useRealTimers();
  });

  const run = async () => {
    try {
      await deployWithProgress(URL, PAYLOAD, onState);
    } catch (e) {
      error = e;
    }
  };

  describe('when the deployment is accepted and the stream reaches deployed', () => {
    beforeEach(async () => {
      mockServer({
        POST: [() => jsonResponse(202, uploading(0))],
        'GET text/event-stream': [
          () =>
            sseResponse([
              sseEvent(uploading(40)),
              ': ping\n\n',
              sseEvent(state('deployed', { result: { entityId: 'bafy' } })),
            ]),
        ],
      });
      await run();
    });

    it('should ask the CLI to deploy asynchronously', () => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${URL}/deploy`,
        expect.objectContaining({
          method: 'post',
          headers: expect.objectContaining({ Prefer: 'respond-async' }),
          body: JSON.stringify(PAYLOAD),
        }),
        expect.any(Number),
      );
    });

    it('should report every state, from the accepted one to the final one', () => {
      expect(onState.mock.calls.map(([s]) => s.phase)).toEqual([
        'uploading',
        'uploading',
        'deployed',
      ]);
    });

    it('should resolve', () => {
      expect(error).toBeUndefined();
    });
  });

  describe('when an event is split across chunks', () => {
    beforeEach(async () => {
      const event = sseEvent(state('deployed'));
      mockServer({
        POST: [() => jsonResponse(202, uploading(0))],
        'GET text/event-stream': [() => sseResponse([event.slice(0, 20), event.slice(20)])],
      });
      await run();
    });

    it('should report the reassembled state', () => {
      expect(onState).toHaveBeenLastCalledWith(state('deployed'));
    });
  });

  describe('when the deployment fails', () => {
    beforeEach(async () => {
      mockServer({
        POST: [() => jsonResponse(202, uploading(0))],
        'GET text/event-stream': [
          () =>
            sseResponse([
              sseEvent(
                state('failed', {
                  error: {
                    code: 'DEPLOY_FAILED',
                    message: 'Response was ["The deployment is too big"]',
                  },
                }),
              ),
            ]),
        ],
      });
      await run();
    });

    it("should throw the catalyst's own message", () => {
      expect((error as Error).message).toBe('The deployment is too big');
    });
  });

  describe('when the deployment is cancelled', () => {
    beforeEach(async () => {
      mockServer({
        POST: [() => jsonResponse(202, uploading(0))],
        'GET text/event-stream': [() => sseResponse([sseEvent(state('cancelled'))])],
      });
      await run();
    });

    it('should throw a cancelled deployment error', () => {
      expect(isDeploymentError(error, 'DEPLOYMENT_CANCELLED')).toBe(true);
    });
  });

  describe('when the stream drops before a final state', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
      mockServer({
        POST: [() => jsonResponse(202, uploading(0))],
        'GET text/event-stream': [() => sseResponse([sseEvent(uploading(30))])],
        'GET application/json': [
          () => jsonResponse(200, uploading(60)),
          () => jsonResponse(200, state('deployed')),
        ],
      });
      const running = run();
      await vi.advanceTimersByTimeAsync(5000);
      await running;
    });

    it('should poll the state until it is final', () => {
      expect(onState.mock.calls.map(([s]) => s.upload?.sentBytes ?? s.phase)).toEqual([
        0,
        30,
        60,
        'deployed',
      ]);
    });

    it('should resolve', () => {
      expect(error).toBeUndefined();
    });
  });

  describe('when the CLI stops answering while polling', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
      mockServer({
        POST: [() => jsonResponse(202, uploading(0))],
        'GET text/event-stream': [() => new Response('', { status: 500 })],
        'GET application/json': [
          () => {
            throw new TypeError('Failed to fetch');
          },
        ],
      });
      const running = run();
      await vi.advanceTimersByTimeAsync(MAX_POLL_FAILURES * 1000);
      await running;
    });

    it('should give up with the network error', () => {
      expect((error as Error).message).toBe('Failed to fetch');
    });
  });

  describe('when the CLI ignores the preference and finishes synchronously', () => {
    beforeEach(async () => {
      mockServer({ POST: [() => jsonResponse(200, {})] });
      await run();
    });

    it('should resolve without following the deployment', () => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should resolve', () => {
      expect(error).toBeUndefined();
    });
  });

  describe('when this CLI run already started its deployment', () => {
    beforeEach(async () => {
      mockServer({ POST: [() => jsonResponse(409, state('deployed'))] });
      await run();
    });

    it('should take the outcome of that deployment', () => {
      expect(onState).toHaveBeenCalledWith(state('deployed'));
    });

    it('should resolve', () => {
      expect(error).toBeUndefined();
    });
  });

  describe('when the CLI rejects the payload', () => {
    beforeEach(async () => {
      mockServer({ POST: [() => jsonResponse(400, { message: 'Invalid payload: address' })] });
      await run();
    });

    it('should throw the message of the CLI', () => {
      expect((error as Error).message).toBe('Invalid payload: address');
    });
  });
});

describe('requestDeploymentCancel', () => {
  let error: unknown;

  beforeEach(() => {
    error = undefined;
  });

  afterEach(() => {
    fetchMock.mockReset();
  });

  const run = async () => {
    try {
      await requestDeploymentCancel(URL);
    } catch (e) {
      error = e;
    }
  };

  describe('when the CLI accepts the cancellation', () => {
    beforeEach(async () => {
      mockServer({ DELETE: [() => jsonResponse(202, uploading(10))] });
      await run();
    });

    it('should send DELETE to the deployment', () => {
      expect(fetchMock).toHaveBeenCalledWith(`${URL}/deploy`, { method: 'delete' });
    });

    it('should resolve', () => {
      expect(error).toBeUndefined();
    });
  });

  describe('when the deployment already ended', () => {
    beforeEach(async () => {
      mockServer({ DELETE: [() => jsonResponse(409, state('deployed'))] });
      await run();
    });

    it('should resolve', () => {
      expect(error).toBeUndefined();
    });
  });

  describe('when the CLI fails the request', () => {
    beforeEach(async () => {
      mockServer({ DELETE: [() => jsonResponse(500, {})] });
      await run();
    });

    it('should throw', () => {
      expect((error as Error).message).toBe('Failed to cancel the deployment: HTTP 500');
    });
  });
});
