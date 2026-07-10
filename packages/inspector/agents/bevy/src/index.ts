import { bus } from './bus';
import { getBevyApi } from './bevy-api';
import {
  frameTarget,
  resetCamera,
  setCameraMode,
  setCameraSceneOffset,
  setupCamera,
} from './camera';
import { getGroundPointAtPointer, setupGizmo, setSelectedEntity, setSceneOffset } from './gizmo';

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
      setSelectedEntity(msg.entity, msg.position, msg.mode, msg.rotation, msg.alignToWorld);
      return;
    }
    // Drag-drop placement: raycast the ground under the pointer and reply with
    // the scene-local point (null if the ray misses). The inspector awaits the
    // matching `id`, falling back to a default if we can't answer.
    if (msg.kind === 'query-drop-point') {
      bus.postToPage({ kind: 'drop-point', id: msg.id, position: getGroundPointAtPointer() });
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
  });

  // setupGizmo installs the pointer-down handler (grab-or-pick) + drag system.
  setupGizmo();
  // setupCamera installs the (initially inactive) editor fly-camera.
  setupCamera();

  void boot();
}

async function boot(): Promise<void> {
  await autoLogin();
  await pinInspectedScene();
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
 */
async function pinInspectedScene(): Promise<void> {
  const api = getBevyApi();
  if (!api) return;
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
        if (ps.length > 0) {
          const baseX = Math.min(...ps.map(p => p.x));
          const baseY = Math.min(...ps.map(p => p.y));
          setSceneOffset(baseX, baseY);
          setCameraSceneOffset(baseX, baseY);
        }
        return;
      }
    } catch (e) {
      console.error('[bevy-agent] pin attempt failed:', e);
    }
    await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
  }
  console.error('[bevy-agent] no inspectable scene found to pin — picking will not work');
}
