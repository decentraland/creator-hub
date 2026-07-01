import { createRendererConformanceSuite } from '../conformance';
import { BevyRenderer } from './BevyRenderer';

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
