import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENS_RECORD_TIMEOUT_MS, requestENSRecord, withENSRecordClient } from './ccipRead';

describe('when requesting an ENS gateway record', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let controller: AbortController;
  beforeEach(() => {
    controller = new AbortController();
    fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: '0x1234' }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it('should send POST data without credentials or redirects', async () => {
    await expect(
      requestENSRecord(
        {
          sender: '0x1111111111111111111111111111111111111111',
          data: '0xabcd',
          urls: ['https://gateway.example'],
        },
        controller.signal,
      ),
    ).resolves.toBe('0x1234');
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://gateway.example'),
      expect.objectContaining({
        method: 'POST',
        redirect: 'error',
        credentials: 'omit',
        signal: controller.signal,
      }),
    );
  });
  it('should substitute GET placeholders', async () => {
    await requestENSRecord(
      {
        sender: '0x1111111111111111111111111111111111111111',
        data: '0xabcd',
        urls: ['https://gateway.example/{data}'],
      },
      controller.signal,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://gateway.example/0xabcd'),
      expect.objectContaining({ method: 'GET', body: undefined }),
    );
  });
  describe.each([
    'http://gateway.example',
    'https://127.0.0.1',
    'https://10.0.0.1',
    'https://[::1]',
    'https://localhost',
    'https://localhost.',
    'https://router.local',
    'https://user:pass@gateway.example',
    'https://2130706433',
  ])('and the URL is %s', url => {
    it('should reject before sending a request', async () => {
      await expect(
        requestENSRecord(
          { sender: '0x1111111111111111111111111111111111111111', data: '0xabcd', urls: [url] },
          controller.signal,
        ),
      ).rejects.toThrow('Unsupported ENS gateway URL');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
  describe('and the first gateway fails', () => {
    beforeEach(() => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));
    });
    it('should try the next gateway', async () => {
      await expect(
        requestENSRecord(
          {
            sender: '0x1111111111111111111111111111111111111111',
            data: '0xabcd',
            urls: ['https://first.example', 'https://second.example'],
          },
          controller.signal,
        ),
      ).resolves.toBe('0x1234');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});

describe('when an ENS gateway never responds', () => {
  let signal: AbortSignal;
  let lookup: Promise<unknown>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, options) => {
        signal = options.signal;
        return new Promise(() => {});
      }),
    );
    lookup = withENSRecordClient('https://rpc.example', client => {
      if (!client.ccipRead) throw new Error('Missing CCIP transport');
      return client.ccipRead.request!({
        sender: '0x1111111111111111111111111111111111111111',
        data: '0xabcd',
        urls: ['https://gateway.example'],
      });
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it('should reject at the record deadline and abort the gateway request', async () => {
    const rejection = expect(lookup).rejects.toThrow('ENS record lookup timed out');
    await vi.advanceTimersByTimeAsync(ENS_RECORD_TIMEOUT_MS);
    await rejection;
    expect(signal.aborted).toBe(true);
  });
});
