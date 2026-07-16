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

describe('BevyRenderer editor camera', () => {
  let renderer: BevyRenderer;

  beforeEach(() => {
    renderer = new BevyRenderer();
  });

  afterEach(() => {
    renderer.dispose();
  });

  it('should default to free mode (the editor camera)', () => {
    expect(renderer.editorCamera.getMode()).toBe('free');
  });

  it('should post the mode to the agent and notify subscribers on change', () => {
    const posted: string[] = [];
    renderer.setCameraModePoster(mode => posted.push(mode));
    const seen: string[] = [];
    renderer.editorCamera.onModeChange(mode => seen.push(mode));

    renderer.editorCamera.setMode('avatar');
    expect(renderer.editorCamera.getMode()).toBe('avatar');
    expect(posted).toEqual(['avatar']);
    expect(seen).toEqual(['avatar']);
  });

  it('should ignore a no-op set to the current mode', () => {
    const posted: string[] = [];
    renderer.setCameraModePoster(mode => posted.push(mode));
    renderer.editorCamera.setMode('free'); // already free
    expect(posted).toEqual([]);
  });

  it('should stop notifying after unsubscribe', () => {
    const seen: string[] = [];
    const off = renderer.editorCamera.onModeChange(mode => seen.push(mode));
    off();
    renderer.editorCamera.setMode('avatar');
    expect(seen).toEqual([]);
  });
});

describe('BevyRenderer scene run/freeze', () => {
  let renderer: BevyRenderer;

  beforeEach(() => {
    renderer = new BevyRenderer();
  });

  afterEach(() => renderer.dispose());

  it('should default to frozen (not running)', () => {
    expect(renderer.sceneRun.isRunning()).toBe(false);
  });

  it('should post the run state to the agent and notify subscribers on change', () => {
    const posted: boolean[] = [];
    renderer.setSceneRunPoster(running => posted.push(running));
    const seen: boolean[] = [];
    renderer.sceneRun.onRunChange(running => seen.push(running));

    renderer.sceneRun.setRunning(true);
    expect(renderer.sceneRun.isRunning()).toBe(true);
    expect(posted).toEqual([true]);
    expect(seen).toEqual([true]);
  });

  it('should ignore a no-op set to the current state', () => {
    const posted: boolean[] = [];
    renderer.setSceneRunPoster(running => posted.push(running));
    renderer.sceneRun.setRunning(false); // already frozen
    expect(posted).toEqual([]);
  });

  it('should stop notifying after unsubscribe', () => {
    const seen: boolean[] = [];
    const off = renderer.sceneRun.onRunChange(running => seen.push(running));
    off();
    renderer.sceneRun.setRunning(true);
    expect(seen).toEqual([]);
  });
});

describe('BevyRenderer gizmo world alignment', () => {
  let renderer: BevyRenderer;

  beforeEach(() => {
    renderer = new BevyRenderer();
  });

  afterEach(() => {
    renderer.dispose();
  });

  it('should default to world-aligned with the toggle enabled', () => {
    expect(renderer.gizmos.isWorldAligned()).toBe(true);
    expect(renderer.gizmos.isWorldAlignmentDisabled()).toBe(false);
  });

  it('should update the alignment and notify subscribers on change', () => {
    let changes = 0;
    renderer.gizmos.onChange(() => changes++);
    renderer.gizmos.setWorldAligned(false);
    expect(renderer.gizmos.isWorldAligned()).toBe(false);
    expect(changes).toBe(1);
  });

  it('should ignore a no-op set to the current alignment', () => {
    let changes = 0;
    renderer.gizmos.onChange(() => changes++);
    renderer.gizmos.setWorldAligned(true); // already world-aligned
    expect(changes).toBe(0);
  });

  it('should stop notifying after unsubscribe', () => {
    let changes = 0;
    const off = renderer.gizmos.onChange(() => changes++);
    off();
    renderer.gizmos.setWorldAligned(false);
    expect(changes).toBe(0);
  });
});

describe('BevyRenderer focusOnEntity', () => {
  let renderer: BevyRenderer;

  beforeEach(() => {
    renderer = new BevyRenderer();
  });

  afterEach(() => {
    renderer.dispose();
  });

  const IDENTITY = { rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } };

  it("should post the entity's world position and engage the free camera", async () => {
    const focused: Array<{ x: number; y: number; z: number }> = [];
    renderer.setFocusPoster(p => focused.push({ x: p.x, y: p.y, z: p.z }));

    const ctx = renderer.context;
    const entity = ctx.engine.addEntity();
    ctx.Transform.create(entity, {
      ...IDENTITY,
      position: { x: 4, y: 1, z: 2 },
      parent: ctx.engine.RootEntity,
    });
    await ctx.engine.update(1);

    renderer.camera.focusOnEntity(entity);

    expect(focused).toEqual([{ x: 4, y: 1, z: 2 }]);
    expect(renderer.editorCamera.getMode()).toBe('free');
  });

  it('should do nothing for an entity with no tracked transform', () => {
    const focused: unknown[] = [];
    renderer.setFocusPoster(p => focused.push(p));
    // Start from avatar so a no-op focus is observably not forcing free mode.
    renderer.editorCamera.setMode('avatar');
    renderer.camera.focusOnEntity(987654 as never);
    expect(focused).toEqual([]);
    expect(renderer.editorCamera.getMode()).toBe('avatar');
  });

  it('should post a default scene-local framing and engage the free camera on reset', () => {
    const reset: Array<{ x: number; y: number; z: number }> = [];
    renderer.setResetPoster(p => reset.push({ x: p.x, y: p.y, z: p.z }));
    renderer.camera.reset();
    expect(reset).toEqual([{ x: 8, y: 0, z: 8 }]);
    expect(renderer.editorCamera.getMode()).toBe('free');
  });
});

describe('BevyRenderer getEntityAnimations', () => {
  let renderer: BevyRenderer;

  beforeEach(() => {
    renderer = new BevyRenderer();
  });

  afterEach(() => renderer.dispose());

  it('should map the agent-resolved clip names to RendererAnimations', async () => {
    renderer.setAnimationsResolver(async () => ['Idle', 'Walk']);
    const anims = await renderer.getEntityAnimations(512 as never);
    expect(anims).toEqual([{ name: 'Idle' }, { name: 'Walk' }]);
  });

  it('should pass the queried entity to the resolver', async () => {
    const asked: number[] = [];
    renderer.setAnimationsResolver(async entity => {
      asked.push(entity as number);
      return [];
    });
    await renderer.getEntityAnimations(700 as never);
    expect(asked).toEqual([700]);
  });

  it('should return none when no resolver is wired (conformance path)', async () => {
    expect(await renderer.getEntityAnimations(512 as never)).toEqual([]);
  });
});
