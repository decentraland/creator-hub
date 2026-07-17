import { vi } from 'vitest';

import type { EngineWindow } from './console';
import { buildEngineUrl, mountBevyEngine } from './engine-iframe';

describe('buildEngineUrl', () => {
  it('should return the bare directory URL when no realm/position given', () => {
    expect(buildEngineUrl('/bevy-engine/')).toBe('/bevy-engine/');
  });

  it('should append realm + position as query params', () => {
    const url = buildEngineUrl('/bevy-engine/', 'http://localhost:8004', '0,0');
    expect(url).toContain('/bevy-engine/?');
    const query = new URLSearchParams(url.split('?')[1]);
    expect(query.get('realm')).toBe('http://localhost:8004');
    expect(query.get('position')).toBe('0,0');
  });

  it('should include only realm when position is omitted', () => {
    const url = buildEngineUrl('/bevy-engine/', 'http://localhost:8004');
    expect(url).toContain('realm=');
    expect(url).not.toContain('position=');
  });

  it('should append systemScene + agent-boot params when given', () => {
    const url = buildEngineUrl(
      '/bevy-engine/',
      'http://localhost:8004',
      '0,0',
      'http://localhost:8005',
    );
    const query = new URLSearchParams(url.split('?')[1]);
    expect(query.get('systemScene')).toBe('http://localhost:8005');
    // portables pinned empty (skip the remote basiccontroller PX) + embed mode
    expect(query.get('portables')).toBe('');
    expect(query.get('embed')).toBe('true');
  });

  it('should NOT set portables/embed without a systemScene (unchanged plain-realm boot)', () => {
    const url = buildEngineUrl('/bevy-engine/', 'http://localhost:8004', '0,0');
    expect(url).not.toContain('portables');
    expect(url).not.toContain('embed');
  });
});

/**
 * Boot handshake for the engine iframe. The real bevy-explorer wasm can't run in
 * happy-dom, so a fake iframe (via the `createIframe` seam) stands in with a
 * controllable `contentWindow` — enough to prove the poll-until-ready and
 * boot-timeout paths, which is the whole of this slice.
 */
describe('mountBevyEngine', () => {
  let container: HTMLElement;

  // Build a fake iframe whose contentWindow we control. `installConsoleAfterMs`
  // simulates the engine installing its console function some time after mount
  // (wasm init is async), or never (to exercise the timeout).
  function fakeIframe(contentWindow: EngineWindow | null) {
    const el = document.createElement('div') as unknown as HTMLIFrameElement;
    Object.defineProperty(el, 'contentWindow', { value: contentWindow, writable: true });
    return el;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should resolve once the engine console appears, and attach the iframe', async () => {
    const engineWindow = {} as EngineWindow;
    const iframe = fakeIframe(engineWindow);

    const promise = mountBevyEngine({
      container,
      createIframe: () => iframe,
      bootTimeoutMs: 10_000,
    });

    // Iframe is attached immediately; console not yet installed.
    expect(container.contains(iframe)).toBe(true);

    // Engine installs its console after ~500ms of wasm init.
    vi.advanceTimersByTime(500);
    engineWindow.engine_console_command_args = async () => '';
    await vi.advanceTimersByTimeAsync(250); // next poll tick

    const mount = await promise;
    expect(mount.engineWindow).toBe(engineWindow);
    expect(mount.iframe).toBe(iframe);
  });

  it('should reject and remove the iframe if the engine never becomes ready', async () => {
    const iframe = fakeIframe({} as EngineWindow); // console never installed

    const promise = mountBevyEngine({
      container,
      createIframe: () => iframe,
      bootTimeoutMs: 40_000,
    });
    // Swallow the rejection to assert on it after advancing time (avoids an
    // unhandled-rejection warning between the throw and the await).
    const settled = promise.catch((e: Error) => e);

    await vi.advanceTimersByTimeAsync(40_000);

    const result = await settled;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain('did not become ready');
    expect(container.contains(iframe)).toBe(false);
  });

  it('should point the iframe at the engine directory (trailing slash, not index.html)', () => {
    const iframe = fakeIframe({} as EngineWindow);
    mountBevyEngine({ container, createIframe: () => iframe, bootTimeoutMs: 1000 }).catch(() => {});
    // Directory URL, so the engine's document-relative service-worker + asset
    // paths resolve under /bevy-engine/ rather than /bevy-engine/index.html/.
    expect(iframe.src).toContain('/bevy-engine/');
    expect(iframe.src).not.toContain('index.html');
  });

  it('should pass realm + position through to the iframe URL', () => {
    const iframe = fakeIframe({} as EngineWindow);
    mountBevyEngine({
      container,
      createIframe: () => iframe,
      bootTimeoutMs: 1000,
      realm: 'http://localhost:8004',
      position: '0,0',
    }).catch(() => {});
    expect(iframe.src).toContain('realm=');
    expect(iframe.src).toContain('position=');
  });
});
