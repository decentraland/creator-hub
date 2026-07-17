import type { Entity } from '@dcl/ecs';

import type { BevySceneContext } from './BevySceneContext';

/**
 * Reboot the Bevy engine when the parcel layout changes (#1369).
 *
 * The engine reads the scene's parcel bounds from the realm's `/about` at BOOT.
 * Editing the layout (adding/removing parcels) rewrites `scene.json` in the
 * data-layer the realm serves, but the ALREADY-BOOTED engine keeps the old
 * dimensions — and the runtime `reload` console command only re-runs the scene
 * CODE, not the realm-level bounds. The change only showed up after closing and
 * reopening the project (a fresh boot re-fetches /about). So this does the same,
 * live: it reboots the engine iframe (`reboot`), which re-fetches the realm with
 * the new parcels.
 *
 * Only the parcel set matters here — the Scene editor component also carries the
 * name/description/thumbnail, which change far more often (every keystroke in the
 * settings form) and must NOT trigger a reboot. So we snapshot the parcel coords
 * and reboot only when THAT changes.
 */

/** Match the forward-edit bridge's load-burst window so both arm together. */
const ARM_DELAY_MS = 3000;

interface LayoutSceneComponent {
  getOrNull(entity: Entity): { layout?: { parcels?: Array<{ x: number; y: number }> } } | null;
}

export interface LayoutReloadBridgeOptions {
  context: Pick<BevySceneContext, 'onChange' | 'editorComponents' | 'engine'>;
  /**
   * Reboot the engine iframe from scratch (re-fetching the realm's /about, hence
   * the new parcels) and re-wire the engine-window bindings. Resolves once the
   * rebooted engine is ready.
   */
  reboot: () => Promise<void>;
  /** Test seam: how long to coalesce a burst of parcel edits before rebooting. */
  debounceMs?: number;
  /**
   * Test seam: gate that turns true once the initial CRDT load burst is over.
   * Scene changes before this are treated as the loaded baseline (no reboot — the
   * engine already loaded those parcels); only later parcel changes reboot.
   * Defaults to a timer, like the forward-edit bridge's arm.
   */
  shouldReload?: () => boolean;
  /**
   * Called after a reboot completes. The reboot re-runs the scene from the realm,
   * which drops the editor state the agent/host applied to the previous instance
   * — the caller re-asserts it here (re-freeze the scene, etc).
   */
  onReloaded?: () => void;
}

/** A stable, order-independent key for a parcel set (so [0,0][1,0] == [1,0][0,0]). */
function parcelsKey(parcels: Array<{ x: number; y: number }> | undefined): string {
  if (!parcels || parcels.length === 0) return '';
  return parcels
    .map(p => `${p.x},${p.y}`)
    .sort()
    .join(' ');
}

export function createLayoutReloadBridge(options: LayoutReloadBridgeOptions): () => void {
  const { context, reboot } = options;
  const debounceMs = options.debounceMs ?? 400;

  const Scene = context.editorComponents.Scene as unknown as LayoutSceneComponent & {
    componentId: number;
  };
  const RootEntity = context.engine.RootEntity;

  const readParcelsKey = () => parcelsKey(Scene.getOrNull(RootEntity)?.layout?.parcels);

  // Baseline = the layout the engine already loaded. A reload fires only when the
  // parcels differ from this, and the baseline advances on each reload — so a
  // Scene PUT that only touched name/description (same parcels) is a no-op.
  let lastParcels = readParcelsKey();
  let timer: ReturnType<typeof setTimeout> | null = null;

  // The engine loads the scene (and its parcels) from the realm at boot, and that
  // same load arrives as a CRDT burst that writes the Scene component here. Those
  // initial writes must NOT reload — the engine already has those parcels. Arm
  // after a delay (like the forward-edit bridge); until armed, Scene changes just
  // advance the baseline. Overridable for tests.
  let armed = false;
  const armTimer = options.shouldReload
    ? null
    : setTimeout(() => {
        armed = true;
        lastParcels = readParcelsKey(); // snapshot the loaded layout as baseline
      }, ARM_DELAY_MS);
  const shouldReload = options.shouldReload ?? (() => armed);

  const maybeReboot = () => {
    timer = null;
    if (!shouldReload()) {
      // Still loading — treat as baseline, don't reboot.
      lastParcels = readParcelsKey();
      return;
    }
    const current = readParcelsKey();
    if (current === lastParcels) return; // parcels unchanged — nothing to reboot
    lastParcels = current;
    void reboot()
      .then(() => options.onReloaded?.())
      .catch(error => {
        // eslint-disable-next-line no-console
        console.warn('[bevy] engine reboot after layout change failed:', error);
      });
  };

  const off = context.onChange((_entity, _op, component) => {
    if (!component || component.componentId !== Scene.componentId) return;
    // Coalesce a burst (the settings form can rewrite Scene several times as the
    // parcel grid is edited) into a single reboot once it settles.
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(maybeReboot, debounceMs);
  });

  return () => {
    if (timer !== null) clearTimeout(timer);
    if (armTimer !== null) clearTimeout(armTimer);
    off();
  };
}
