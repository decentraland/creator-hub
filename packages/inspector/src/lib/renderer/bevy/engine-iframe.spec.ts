import { vi } from 'vitest';

import type { EngineWindow } from './console';
import { mountBevyEngine } from './engine-iframe';

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

  it('should point the iframe at the engine URL', () => {
    const iframe = fakeIframe({} as EngineWindow);
    mountBevyEngine({ container, createIframe: () => iframe, bootTimeoutMs: 1000 }).catch(() => {});
    expect(iframe.src).toContain('/bevy-engine/index.html');
  });
});
