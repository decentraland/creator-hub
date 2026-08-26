import { engine, GltfContainerLoadingState } from '@dcl/sdk/ecs';
import type { Entity } from '@dcl/sdk/ecs';
import { getPlayer } from '@dcl/sdk/players';

import { bus } from './bus';
import { getBevyApi } from './bevy-api';
import {
  frameTarget,
  resetCamera,
  setCameraMode,
  setCameraSceneOffset,
  setVerticalInput,
  setupCamera,
  zoomCamera,
} from './camera';
import {
  getGroundPointAtPointer,
  setSpawnGizmo,
  setupGizmo,
  setSelectedEntity,
  setSceneOffset,
  setEditingEnabled,
} from './gizmo';
import { getDefaultSpawnWorld, setSpawnAreas } from './spawn-areas';
import { setBrokenAssets } from './broken-assets';

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

/** The pinned inspected scene's content hash (set by pinInspectedScene). Used to
 * scope `reload <hash>` for Stop/reset so only the inspected scene restarts, not
 * the editor-agent portable. */
let pinnedSceneHash: string | null = null;

/**
 * Whether the engine auto-freezes an editor scene after main() runs once
 * (bevy-explorer #1015 — `refreeze_at_tick`). When true, the agent must NOT
 * force-freeze on boot/reset: the engine owns freezing, and an agent freeze would
 * race it (Stop lands on frame 0 instead of the deterministic "main ran once").
 *
 * FALSE until #1015 is merged, republished, and the pin is bumped in
 * packages/inspector/package.json. On the current published engine there is NO
 * auto-freeze, so the agent MUST force-freeze — otherwise the inspected scene
 * just runs freely on load. Flip to `true` (or delete the gate) in the same
 * change that bumps the engine pin.
 *
 * When flipping it, keep the `else await setSceneUiVisible(false)` at both call
 * sites: the engine owns freezing, but hiding the scene's UI is still ours.
 */
const ENGINE_AUTO_FREEZES_EDITOR_SCENE = false;

export function main(): void {
  // Inspector → agent messages.
  bus.onSceneMessage(msg => {
    // Track the current selection + its world position so the gizmo attaches to
    // it (the agent can't read the inspected scene's Transform).
    if (msg.kind === 'set-selection') {
      setSelectedEntity(msg.entities, msg.mode, msg.alignToWorld, msg.snap);
      // Outline the selected entities in the viewport (render-only, never saved —
      // see the engine's /highlight). Empty selection clears it. Use the dedicated
      // `highlight` list (includes LOCKED entities, which have no gizmo but still
      // outline — #1444); fall back to the gizmo `entities` for older callers.
      highlightEntities(msg.highlight ?? msg.entities.map(e => e.entity));
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
    // Animation clip names of an entity's loaded GLTF — read from the engine's
    // GltfContainerLoadingState (a field the inspector's older @dcl/ecs can't
    // decode, so it asks us). Empty if the entity has no GLTF / it isn't loaded.
    if (msg.kind === 'query-animations') {
      bus.postToPage({
        kind: 'animations',
        id: msg.id,
        names: entityAnimationNames(msg.entity as Entity),
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
    // Dolly the editor fly-camera in/out (toolbar zoom buttons + scroll).
    if (msg.kind === 'zoom-camera') {
      zoomCamera(msg.delta);
      return;
    }
    // Show/hide the spawn-point move-handle at a scene-local position.
    if (msg.kind === 'set-spawn-gizmo') {
      setSpawnGizmo(msg.position);
      return;
    }
    // Draw the scene's spawn areas (translucent boxes; #1374).
    if (msg.kind === 'set-spawn-areas') {
      setSpawnAreas(msg.areas);
      return;
    }
    if (msg.kind === 'set-broken-assets') {
      setBrokenAssets(msg.assets);
      return;
    }
    // Freeze (static) or run the inspected scene (the toolbar's run/freeze toggle).
    if (msg.kind === 'set-scene-frozen') {
      void setSceneFrozen(msg.frozen);
      return;
    }
    // Stop/reset: restart the inspected scene to its initial state (toolbar Stop).
    if (msg.kind === 'reset-scene') {
      void resetScene();
      return;
    }
    // Vertical fly-camera keys forwarded by the host (E = up, Q = down): Q has no
    // SDK InputAction so the engine can't read it; the host captures E/Q on the
    // engine window and sends the held state here.
    if (msg.kind === 'set-vertical-input') {
      setVerticalInput(msg.up, msg.down);
      return;
    }
    // Enable/disable viewport editing (click-to-pick + gizmo grab). Disabled lets
    // clicks reach the running scene so the user can test mechanics (#1458).
    if (msg.kind === 'set-editing-enabled') {
      setEditingEnabled(msg.enabled);
      return;
    }
  });

  // setupGizmo installs the pointer-down handler (grab-or-pick) + drag system.
  setupGizmo();
  // setupCamera installs the (initially inactive) editor fly-camera.
  setupCamera();
  // Watch the inspected scene's logs for a runtime error (#1448). The SDK wraps
  // main() (and each system) in a try/catch that `console.error(e)`s the throw, so
  // an uncaught scene error surfaces as a SceneError log entry (prefixed "ERROR ")
  // — NOT a SystemError, which the engine only records for its own runtime failures.
  // Report each new error so the host can notify + stop the scene. Throttled — the
  // agent (a super scene) keeps ticking even while the inspected scene is frozen.
  setupSceneErrorWatch();

  void boot();
}

// --- Scene runtime-error watch (#1448) ---

/** Log-line signatures already reported, so a persisted error isn't re-toasted
 * every poll. Cleared on Stop/reset (the reloaded scene starts a fresh log). */
const reportedErrors = new Set<string>();
let sinceErrorCheck = 0;
const ERROR_CHECK_INTERVAL = 1.5; // seconds

/** Poll `/scene_logs` for NEW error entries and report them to the host. */
async function reportSceneErrors(): Promise<void> {
  const api = getBevyApi();
  if (!api) return;
  let reply: string;
  try {
    reply = await api.consoleCommand('scene_logs', ['100']);
  } catch {
    return; // no pinned scene yet / command failed — nothing to report
  }
  // Each entry is `[<ts>] <Level>: <message>`. SceneError = a scene-side throw the
  // SDK caught and console.error'd (prefixed "ERROR "); SystemError = an engine-level
  // failure. Report either — both mean the scene is broken.
  for (const line of reply.split('\n')) {
    const match = line.match(/^\[[\d.]+\]\s+(SceneError|SystemError):\s*(.*)$/);
    if (!match) continue;
    if (reportedErrors.has(line)) continue;
    reportedErrors.add(line);
    // Skip benign DEV WARNINGS: React (and react-ecs) log warnings via console.error,
    // so they arrive as SceneError entries (e.g. "ERROR Warning: Each child in a list
    // should have a unique key prop"). These aren't fatal — the scene keeps running —
    // so they must NOT trigger the "runtime error, can't run" toast + stop the scene.
    // A real error never carries the framework's "Warning:" tag.
    const stripped = match[2].replace(/^ERROR\s+/, '').trim();
    if (/^Warning:/i.test(stripped)) continue;
    bus.postToPage({ kind: 'scene-error', message: cleanErrorMessage(match[2]) });
  }
}

/** Turn a raw log message into a short, single-line summary for the toast, or '' if
 * the engine gave us nothing usable (the host then shows a generic detail). */
function cleanErrorMessage(raw: string): string {
  // `console.error(...)` prefixes every entry with "ERROR " (the engine's console
  // shim) — drop it. The value may inline a stack as escaped or real `\n`; keep the
  // first line only, and cap the length.
  const withoutPrefix = raw.replace(/^ERROR\s+/, '');
  let firstLine = withoutPrefix.split('\\n')[0].split('\n')[0].trim();
  // The web engine serializes objects with JSON.stringify, so a thrown Error (no
  // enumerable keys) collapses to "{}" — useless as a message. Treat contentless
  // blobs as empty so the host falls back to a generic detail.
  if (/^(\{\s*\}|\[\s*\]|null|""|'')$/.test(firstLine)) return '';
  // JSON.stringify also wraps a plain string arg in quotes — unwrap for readability.
  const quoted = firstLine.match(/^"(.*)"$/);
  if (quoted) firstLine = quoted[1];
  return firstLine.length > 200 ? `${firstLine.slice(0, 197)}...` : firstLine;
}

/** Install the throttled scene-error poll. */
function setupSceneErrorWatch(): void {
  engine.addSystem((dt: number) => {
    sinceErrorCheck += dt;
    if (sinceErrorCheck < ERROR_CHECK_INTERVAL) return;
    sinceErrorCheck = 0;
    void reportSceneErrors();
  });
}

async function boot(): Promise<void> {
  await autoLogin();
  const sceneLocalCenter = await pinInspectedScene();
  // Announce we're listening + the scene offset is known, so the host (re)sends
  // one-shot pushed state — the spawn areas especially. This MUST come AFTER
  // pinInspectedScene: it sets the scene→world offset the agent adds when placing
  // the spawn markers; firing before it would place them at the origin parcel
  // (invisible in the real scene) — the bug where areas only appeared after a
  // move re-posted them post-boot. Fires again after an engine reboot (which
  // restarts the agent and re-runs boot).
  bus.postToPage({ kind: 'editor-ready' });
  // Editor default: AVATAR camera (do NOT force free on boot). Forcing free here
  // (`ec468098`) disabled the player's input before it ever became the engine's
  // active movement controller, and toggling back to avatar then never restored
  // walking — the WASD-walk regression. Booting in avatar (as before `ec468098`,
  // and as bevy-editor does) keeps the avatar walkable; a free⇄avatar toggle from
  // there round-trips cleanly (verified). The user toggles to the fly camera when
  // they want it. NOTE: the inspector's editorCamera state also defaults to
  // avatar to match this without a round-trip (see register.ts / EditorPage).
  // Deliberately NOT calling resetCamera() on boot: it forces free mode (which
  // re-triggers the input-disable regression). In avatar mode the native camera
  // follows the player, so no framing is needed; resetCamera is used by the F /
  // toolbar "reset view" action once the user is in the fly camera.
  void sceneLocalCenter;
  // Editor default: the inspected scene is FROZEN (static — no SDK7 systems /
  // timers / onUpdate run), so it's a stable subject to edit. With the engine's
  // editor auto-freeze (#1015) the engine owns this and the agent must stay out
  // of its way; until that ships the agent force-freezes here, else the scene
  // just runs on load. See ENGINE_AUTO_FREEZES_EDITOR_SCENE. The toolbar toggle
  // still unfreezes to run live; the agent itself keeps ticking (super scene,
  // exempt); freeze does NOT block avatar walking (bevy-editor walks while frozen).
  // The `else` is not redundant: setSceneFrozen also hides the scene's UI, so
  // once the engine owns freezing the agent still has to issue that half itself.
  if (!ENGINE_AUTO_FREEZES_EDITOR_SCENE) await setSceneFrozen(true);
  else await setSceneUiVisible(false);
  // Freeze the day/night clock at noon so the skybox doesn't drift into night
  // while the scene sits open (the day/night clock advances with the wall clock
  // even while the scene is frozen — freezing the SCENE doesn't freeze TIME).
  await pinSkyboxTime();
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
 * The animation clip names of an entity's loaded GLTF, from the engine's
 * GltfContainerLoadingState.animationNames. The agent shares the engine's ECS, so
 * this reads the same component the engine wrote when the GLTF finished loading.
 * Empty when the entity has no GltfContainer or it hasn't loaded yet (the
 * inspector re-queries as loading state changes).
 */
function entityAnimationNames(entity: Entity): string[] {
  const state = GltfContainerLoadingState.getOrNull(entity);
  return state?.animationNames ?? [];
}

/**
 * Freeze (static) or run the pinned inspection scene, and keep its UI in step.
 *
 * Frozen ⇔ scene UI hidden is one invariant, owned here. A scene's react-ecs UI
 * is created by its first render pass, long before the agent's force-freeze
 * lands, and freezing stops the SDK7 tick — not entities that already exist. So
 * without this the authored UI sits full-screen over the editor viewport (above
 * picking) the whole time you are editing. It should only appear on Play.
 */
async function setSceneFrozen(frozen: boolean): Promise<void> {
  const api = getBevyApi();
  if (!api) return;
  await applyFreeze(frozen);
  await setSceneUiVisible(!frozen);
}

/**
 * The `/freeze_scene` / `/unfreeze_scene` half. Retries a few times when freezing
 * right after boot: the scene entity can take a moment to be resolvable even once
 * `/set_scene` has recorded it as the active inspection target.
 */
async function applyFreeze(frozen: boolean): Promise<void> {
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
      // The engine THROWS "scene is already frozen/not frozen" for a no-op — that's
      // the desired state already, so treat it as success (don't log/retry). Only a
      // real failure (scene not resolvable yet) should keep retrying.
      const msg = e instanceof Error ? e.message : String(e);
      if (/already (frozen|not frozen|running)/i.test(msg)) return;
      console.error(`[bevy-agent] ${command} attempt failed:`, e);
    }
    await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
  }
}

/**
 * Show or hide the INSPECTED scene's own UI, via the engine's `/show_ui`
 * console command (`show_ui <hash|all> <true|false>`).
 *
 * Scoped to the pinned hash rather than `all`: the engine exempts the system UI
 * scene — which is where this agent's gizmo overlay lives — but leaning on that
 * exemption costs more than passing the hash we already track.
 *
 * Best-effort. A failure must not fail the freeze it rides along with; the worst
 * case is the old behaviour (UI visible while frozen).
 */
async function setSceneUiVisible(visible: boolean): Promise<void> {
  const api = getBevyApi();
  if (!api || !pinnedSceneHash) return;
  try {
    await api.consoleCommand('show_ui', [pinnedSceneHash, visible ? 'true' : 'false']);
  } catch (e) {
    console.error('[bevy-agent] show_ui failed:', e);
  }
}

/**
 * Pin the skybox to a fixed daytime and STOP the day/night clock. The engine's
 * TimeKeeper advances the time of day with the wall clock, so a scene left open
 * for a while drifts into dusk/night — distracting while editing. The `/time`
 * console command sets the running clock (`time` in hours) and its `speed`
 * (real-seconds → in-world advance); `speed 0` freezes it. Noon (12h) gives even,
 * neutral lighting. This targets the shared global TimeKeeper, so it affects the
 * whole editor view; a scene that pins its own SkyboxTime/SceneTime still wins
 * (the engine's `has_scene_time` path), which is correct — the editor only fixes
 * the DEFAULT drift. Best-effort: a failure just leaves the clock running.
 */
async function pinSkyboxTime(): Promise<void> {
  const api = getBevyApi();
  if (!api) return;
  try {
    await api.consoleCommand('time', ['12', '0']);
  } catch (e) {
    console.error('[bevy-agent] pin skybox time failed:', e);
  }
}

/**
 * Stop/reset (#1376): restart the inspected scene to its authored initial state.
 * Uses the engine's `reload <hash>` console command scoped to the pinned scene —
 * fast (no engine/iframe reboot), leaves the editor-agent portable running, and
 * re-runs the scene's SDK7 code from scratch so anything that moved (a walking
 * NPC) returns to start.
 *
 * `reload` drops the scene by hash; the engine re-loads it as a NEW instance
 * (same content hash, new scene Entity). That INVALIDATES the ActiveInspectionScene
 * pin set by `/set_scene` — so we must re-pin the scene after it respawns, or
 * freeze/pause (which target the pinned scene) silently no-op afterwards (the bug:
 * "hit stop → play/pause dead"). And a freshly reloaded scene starts RUNNING, so
 * we must re-freeze to land paused (the editor default). Re-pin + re-freeze here,
 * with retries since the new scene entity takes a beat to resolve after reload.
 */
async function resetScene(): Promise<void> {
  const api = getBevyApi();
  if (!api || !pinnedSceneHash) return;
  const hash = pinnedSceneHash;
  // The reload starts a fresh scene instance with a fresh log — drop the reported
  // signatures so a re-thrown error surfaces again (#1448).
  reportedErrors.clear();
  try {
    await api.consoleCommand('reload', [hash]);
  } catch (e) {
    console.error('[bevy-agent] reset (reload) failed:', e);
    return;
  }
  // Return the player to the scene's spawn point (#1423). On a reload the ground/
  // colliders briefly disappear, so the avatar can fall through the floor and end
  // up stuck inside terrain — from which "play as player" is unusable. Teleport it
  // back to the default spawn (world coords) so Stop always lands the player at a
  // valid start. Best-effort: no spawn known / command fails → just skip.
  await teleportPlayerToSpawn();
  // Re-pin the reloaded scene (its ActiveInspectionScene Entity was invalidated by
  // the reload), retrying until the new instance resolves. With the engine's editor
  // auto-freeze (#1015) the reloaded instance freezes itself the same way the initial
  // load does, so the agent leaves it alone (force-freezing would win the race and
  // land Stop on frame 0 instead of the deterministic "main ran once"). Until #1015
  // ships the agent re-freezes here, else the reloaded scene runs free after Stop —
  // see ENGINE_AUTO_FREEZES_EDITOR_SCENE. Post `reset-complete` once re-pinned so the
  // host can re-enable Play (#1420) and replay the editor overrides + animation pause
  // (#1421) — not on a blind timeout.
  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
    try {
      const reply = await api.consoleCommand('set_scene', [hash]);
      if (!/could not find|not found|no longer exists/i.test(reply)) {
        // A reloaded scene is a fresh instance: it ran main() again, so its UI is
        // back and visible. Re-hide it here (the `else` for the same reason as on
        // boot — setSceneFrozen owns both halves, auto-freeze owns only one).
        if (!ENGINE_AUTO_FREEZES_EDITOR_SCENE) await setSceneFrozen(true);
        else await setSceneUiVisible(false);
        bus.postToPage({ kind: 'reset-complete', ok: true });
        return;
      }
    } catch (e) {
      console.error('[bevy-agent] reset re-pin attempt failed:', e);
    }
  }
  // Gave up re-pinning — still signal completion (ok:false) so the host doesn't
  // block Play forever. Play may not work until the next reset, but a stuck
  // disabled button is worse.
  bus.postToPage({ kind: 'reset-complete', ok: false });
}

/**
 * Teleport the player to the scene's default spawn point (#1423), so a Stop/reset
 * never leaves the avatar fallen through the floor / stuck in terrain. Uses the
 * engine's `/move_player_to <x> <y> <z>` (instant, DCL world-space) with the world
 * position the spawn-areas bridge cached (scene-local spawn center + scene offset
 * = DCL world — the same value the spawn marker is drawn at). No-op when no spawn
 * is known (a scene with no spawn points) or the command fails.
 */
async function teleportPlayerToSpawn(): Promise<void> {
  const api = getBevyApi();
  const spawn = getDefaultSpawnWorld();
  if (!api || !spawn) return;
  try {
    await api.consoleCommand('move_player_to', [String(spawn.x), String(spawn.y), String(spawn.z)]);
  } catch (e) {
    console.error('[bevy-agent] teleport to spawn failed:', e);
  }
}

/** Resolve once the player entity has actually spawned, or false after `ms`. */
async function playerWithin(ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (getPlayer() !== null) return true;
    await new Promise<void>(resolve => setTimeout(() => resolve(), 200));
  }
  return getPlayer() !== null;
}

/**
 * Log in as a fresh GUEST and wait for the player to actually spawn.
 *
 * We deliberately do NOT reuse the previous login (the user's real wallet). The
 * Unity/Bevy PREVIEW logs in with that same stored wallet, so if the editor did
 * too, both clients would share one address — and comms treats same-address
 * clients as a single player, so neither renders the other's avatar (#1424:
 * "Bevy avatar not visible in preview"). A fresh guest gives the editor a
 * DISTINCT address, so editor + preview see each other as separate players. The
 * tradeoff is the editor avatar is a generic guest, not the user's real avatar —
 * acceptable, since the editor mostly uses the fly camera and the win is that
 * multiplayer testing across the two clients now works.
 *
 * The player-spawn wait is load-bearing, not just anti-hang: the engine only
 * takes the player OUT of its `OutOfWorld` state (which disables avatar WALKING
 * while leaving the camera working) once the player exists AND settles into the
 * loaded scene. If boot proceeds (pin scene, freeze) before the player spawns,
 * the player can stay OutOfWorld and WASD does nothing. So block here until the
 * player is present. Bounded — worst case we continue anyway (the fly camera
 * doesn't need the avatar).
 */
async function autoLogin(): Promise<void> {
  const api = getBevyApi();
  if (!api) {
    console.error('[bevy-agent] BevyExplorerApi not found — cannot log in');
    return;
  }
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        api.loginGuest();
      } catch (e) {
        console.error('[bevy-agent] loginGuest threw:', e);
      }
      if (await playerWithin(8000)) return;
      console.log(`[bevy-agent] guest login attempt ${attempt + 1}: no player yet, retrying…`);
    }
    console.error('[bevy-agent] autoLogin: player never appeared after retries — continuing');
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
        pinnedSceneHash = target.hash;
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
