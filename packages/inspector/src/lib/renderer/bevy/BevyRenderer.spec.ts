import { createRendererConformanceSuite } from '../conformance';
import { BevyRenderer } from './BevyRenderer';
import type { EngineWindow } from './console';

/**
 * Runs the Bevy renderer spike through the public conformance kit — the whole
 * point of this first slice. A green run proves the Bevy {@link IRenderer}
 * surface satisfies the boundary contract (shape, sync-read coherence,
 * subscribe/unsubscribe, graceful degradation, idempotent teardown) *before* the
 * bevy-explorer wasm is wired in.
 *
 * Editing capabilities (gizmos, metrics) are honest no-op stubs at this stage,
 * but the kit's gizmo/metric checks only assert graceful behavior — a boolean
 * alignment state, numeric zeroed metrics, no throw — which the stubs satisfy.
 * So nothing is skipped: the spike is fully conformant, just empty. Real
 * gizmo/metric *behavior* gets its own assertions as the wasm-backed slices land.
 */
createRendererConformanceSuite({
  harness: { describe, it, beforeEach, afterEach, expect },
  setup: () => {
    const renderer = new BevyRenderer();
    return { renderer, engine: renderer.context.engine, dispose: () => renderer.dispose() };
  },
});

describe('BevyRenderer engine attach', () => {
  let renderer: BevyRenderer;

  beforeEach(() => {
    renderer = new BevyRenderer();
  });

  afterEach(() => {
    renderer.dispose();
  });

  it('should not be ready and expose no engine window before attach', () => {
    let ready = false;
    renderer.events.on('ready', () => {
      ready = true;
    });
    expect(renderer.engineWindow).toBe(null);
    expect(ready).toBe(false);
  });

  it('should emit ready and expose the engine window on attachEngine', () => {
    let ready = 0;
    renderer.events.on('ready', () => {
      ready++;
    });
    const engineWindow = { engine_console_command_args: async () => '' } as unknown as EngineWindow;
    renderer.attachEngine(engineWindow);
    expect(ready).toBe(1);
    expect(renderer.engineWindow).toBe(engineWindow);
  });

  it('should not attach or emit ready after dispose', () => {
    let ready = 0;
    renderer.events.on('ready', () => {
      ready++;
    });
    renderer.dispose();
    renderer.attachEngine({} as EngineWindow);
    expect(ready).toBe(0);
    expect(renderer.engineWindow).toBe(null);
  });
});
