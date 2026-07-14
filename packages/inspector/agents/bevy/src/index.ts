import { bus } from './bus';
import { getBevyApi } from './bevy-api';
import {
  frameTarget,
  resetCamera,
  setCameraMode,
  setCameraSceneOffset,
  setupCamera,
} from './camera';
import {
  getGroundPointAtPointer,
  setSpawnGizmo,
  setupGizmo,
  setSelectedEntity,
  setSceneOffset,
} from './gizmo';

/**
 * Super-user editor agent for the inspector's Bevy renderer.
 *
 * The stock engine exposes no console command to learn what's under a viewport
 * click, so — like bevy-editor — picking + gizmo dragging are done scene-side
 * from a privileged (portableExperiences: enabled) scene that can Raycast
 * against and edit the inspected scene. Results are posted to the inspector host
 * over a same-origin BroadcastChannel; the inspector turns them into
 * `events.emit('pick' | 'gizmoCommit' | 'gizmoCommitEnd', …)`.
 *
 * Loaded into the engine via `?systemScene=` (a portable experience). Boot order
 * matters: log in first (identity, else the engine hangs), then pin the
 * inspected scene (so the super-user raycast is routed to it). Selection comes
 * from the inspector over the bus (`set-selection`).
 *
 * Scope: pick (click → select) + minimal translate gizmo. No rotate/scale, no
 * TextureCamera composite. The gizmo module owns pointer-down (one raycast for
 * both grab and pick), so index.ts only wires selection + boot.
 */

export function main(): void {
  // Inspector → agent messages.
  bus.onSceneMessage(msg => {
    // Track the current selection + its world position so the gizmo attaches to
    // it (the agent can't read the inspected scene's Transform).
    if (msg.kind === 'set-selection') {
      setSelectedEntity(msg.entities, msg.mode, msg.alignToWorld, msg.snap);
      // Outline the selected entities in the viewport (render-only, never saved —
      // see the engine's /highlight). Empty selection clears it. These are the
      // inspected scene's entity ids, which /highlight resolves on the pinned
      // scene — the same ids the gizmo/pick use.
      highlightEntities(msg.entities.map(e => e.entity));
      return;
    }
    // Drag-drop placement: raycast the ground under the pointer and reply with
    // the scene-local point (null if the ray misses). The inspector awaits the
    // matching `id`, falling back to a default if we can't answer.
    if (msg.kind === 'query-drop-point') {
      bus.postToPage({
        kind: 'drop-point',
        id: msg.id,
        position: getGroundPointAtPointer(msg.ndc),
      });
      return;
    }
    // Toggle the editor camera (native avatar ⇄ editor fly-camera).
    if (msg.kind === 'set-camera') {
      setCameraMode(msg.mode);
      return;
    }
    // Frame an entity with the editor camera (world position supplied by the
    // inspector, which owns the Transform).
    if (msg.kind === 'focus-camera') {
      frameTarget(msg.position);
      return;
    }
    // Reset the editor camera to a default framing of the scene.
    if (msg.kind === 'reset-camera') {
      resetCamera(msg.position);
      return;
    }
    // Show/hide the spawn-point move-handle at a scene-local position.
    if (msg.kind === 'set-spawn-gizmo') {
      setSpawnGizmo(msg.position);
      return;
    }
    // Freeze (static) or run the inspected scene (the toolbar's run/freeze toggle).
    if (msg.kind === 'set-scene-frozen') {
      void setSceneFrozen(msg.frozen);
      return;
    }
  });

  // setupGizmo installs the pointer-down handler (grab-or-pick) + drag system.
  setupGizmo();
  // setupCamera installs the (initially inactive) editor fly-camera.
  setupCamera();

  void boot();
}

async function boot(): Promise<void> {
  await autoLogin();
  const sceneLocalCenter = await pinInspectedScene();
  // Editor default: the free-fly camera, not the avatar camera. A scene editor
  // wants an overview it can fly around, not a walking avatar. Enacted here
  // (after the scene is pinned and the native camera exists) so the takeover
  // seeds its pose from the live camera; the inspector's editorCamera state also
  // defaults to 'free' so the toolbar toggle matches without a round-trip.
  setCameraMode('free');
  // Frame the scene at a sensible default standoff rather than leaving the camera
  // wherever the avatar happened to spawn (which is far off for a large parcel
  // and looks "lost" on load). resetCamera adds the scene offset back internally.
  if (sceneLocalCenter !== null) resetCamera(sceneLocalCenter);
  // Editor default: the inspected scene is FROZEN (static — no SDK7 systems /
  // timers / onUpdate run), so it's a stable subject to edit. The editor agent
  // itself keeps ticking (it's a super scene, exempt from the freeze). The
  // toolbar toggle can unfreeze to run the scene live.
  await setSceneFrozen(true);
}

/**
 * Outline the selected entities in the engine viewport via the `/highlight`
 * console command — a render-only editor selection outline (never written to the
 * scene's components / snapshot / save). Called on every selection change; an
 * empty list clears the outline. The ROOT entity (0) isn't a real target, so
 * it's dropped (matching the gizmo's selection filter).
 */
function highlightEntities(entities: number[]): void {
  const api = getBevyApi();
  if (!api) return;
  const ids = entities.filter(e => e !== 0).map(String);
  // `/highlight` with no ids clears; otherwise replaces the previous set.
  void api.consoleCommand('highlight', ids).catch(e => {
    console.error('[bevy-agent] highlight failed:', e);
  });
}

/**
 * Freeze (static) or run the pinned inspection scene via the engine's
 * `/freeze_scene` / `/unfreeze_scene` console commands. Retries a few times when
 * freezing right after boot: the scene entity can take a moment to be resolvable
 * even once `/set_scene` has recorded it as the active inspection target.
 */
async function setSceneFrozen(frozen: boolean): Promise<void> {
  const api = getBevyApi();
  if (!api) return;
  const command = frozen ? 'freeze_scene' : 'unfreeze_scene';
  const attempts = frozen ? 6 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const reply = await api.consoleCommand(command, []);
      // The engine replies "frozen at tick N" / "unfrozen …" on success, and
      // "scene is already frozen/not frozen" if it's a no-op — both are fine.
      if (!/could not find|player is not in any scene/i.test(reply)) return;
    } catch (e) {
      console.error(`[bevy-agent] ${command} attempt failed:`, e);
    }
    await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
  }
}

/**
 * Log in so the engine gets an identity + spawns a player: reuse a previous
 * profile if present, else a guest session. Mirrors bevy-editor's autoLogin.
 * WITHOUT this the engine logs "disconnecting comms, no identity" and the
 * loading screen hangs. Fire-and-forget; failures logged, never thrown.
 */
async function autoLogin(): Promise<void> {
  const api = getBevyApi();
  if (!api) {
    console.error('[bevy-agent] BevyExplorerApi not found — cannot log in');
    return;
  }
  try {
    const previous = await api.getPreviousLogin().catch(() => null);
    if (previous?.userId) {
      const result = await api.loginPrevious().catch(e => ({ success: false, error: String(e) }));
      if (result.success) return;
    }
    api.loginGuest();
  } catch (e) {
    console.error('[bevy-agent] login failed:', e);
  }
}

/**
 * Pin the inspected scene as the engine's active inspection target
 * (`set_scene`). A super-user scene's plain raycast is routed by the engine to
 * whatever scene is pinned — WITHOUT this the ray hits nothing. Picks the
 * non-portable, non-super scene (the project scene; the agent itself is the
 * super/portable one). Retries: liveSceneInfo can be empty right after boot.
 *
 * Returns the scene's SCENE-LOCAL center (parcel span midpoint, in the origin
 * frame the inspector uses) so boot can frame it, or null if no scene was found.
 */
async function pinInspectedScene(): Promise<{ x: number; y: number; z: number } | null> {
  const api = getBevyApi();
  if (!api) return null;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const scenes = (await api.liveSceneInfo()) ?? [];
      const target = scenes.find(s => !s.isPortable && !s.isSuper);
      if (target) {
        await api.consoleCommand('set_scene', [target.hash]);
        // Base parcel = min corner of the scene's parcels; drives the
        // scene-local → engine-world offset that BOTH the gizmo and the focus
        // camera need to place things where the scene actually is.
        const ps = target.parcels ?? [];
        if (ps.length === 0) return null;
        const xs = ps.map(p => p.x);
        const ys = ps.map(p => p.y);
        const baseX = Math.min(...xs);
        const baseY = Math.min(...ys);
        setSceneOffset(baseX, baseY);
        setCameraSceneOffset(baseX, baseY);
        // Scene-LOCAL center: the parcel span's midpoint relative to the base,
        // in metres (16m/parcel), centred within the parcel (+8). The offset is
        // re-added by resetCamera, so this stays in the inspector's origin frame.
        const spanX = (Math.max(...xs) - baseX) * 16 + 16;
        const spanY = (Math.max(...ys) - baseY) * 16 + 16;
        return { x: spanX / 2, y: 0, z: spanY / 2 };
      }
    } catch (e) {
      console.error('[bevy-agent] pin attempt failed:', e);
    }
    await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
  }
  console.error('[bevy-agent] no inspectable scene found to pin — picking will not work');
  return null;
}
