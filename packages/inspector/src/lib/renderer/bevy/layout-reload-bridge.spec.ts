import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { BevySceneContext } from './BevySceneContext';
import { createLayoutReloadBridge } from './layout-reload-bridge';

/**
 * The layout-reload bridge reboots the Bevy engine when the parcel layout changes
 * (#1369) — a parcel edit rewrites scene.json but the already-booted engine keeps
 * its old dimensions until it re-fetches the realm at a fresh boot. It watches the
 * Scene editor component's parcels and reboots, debounced, but ONLY when the
 * parcels actually change (not on a name/description edit).
 */
describe('createLayoutReloadBridge', () => {
  let ctx: BevySceneContext;
  let reboots: number;
  let reloaded: number;
  let armed: boolean;
  let disconnect: () => void;
  const DEBOUNCE = 50;

  const setScene = async (value: unknown) => {
    ctx.editorComponents.Scene.createOrReplace(ctx.engine.RootEntity, value as never);
    await ctx.engine.update(1);
  };

  const baseScene = (parcels: Array<{ x: number; y: number }>) => ({
    name: 'My Scene',
    description: '',
    layout: { base: { x: 0, y: 0 }, parcels },
  });

  beforeEach(() => {
    vi.useFakeTimers();
    ctx = new BevySceneContext();
    reboots = 0;
    reloaded = 0;
    armed = false; // starts "loading" — the first scene set is the baseline
    disconnect = createLayoutReloadBridge({
      context: ctx,
      debounceMs: DEBOUNCE,
      shouldReload: () => armed,
      reboot: async () => {
        reboots++;
      },
      onReloaded: () => {
        reloaded++;
      },
    });
  });

  // Set the loaded scene (baseline), let the debounce settle, then arm — mirrors
  // the real boot: the initial CRDT load writes the Scene, then forwarding arms.
  const loadBaseline = async (parcels: Array<{ x: number; y: number }>) => {
    await setScene(baseScene(parcels));
    await vi.advanceTimersByTimeAsync(DEBOUNCE + 1);
    armed = true;
  };

  afterEach(() => {
    disconnect();
    ctx.dispose();
    vi.useRealTimers();
  });

  describe('when the parcel set changes', () => {
    it('should issue a single reload after the debounce', async () => {
      await loadBaseline([{ x: 0, y: 0 }]);
      await setScene(
        baseScene([
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ]),
      );
      expect(reboots).toBe(0); // debounced — nothing yet
      await vi.advanceTimersByTimeAsync(DEBOUNCE + 1);
      expect(reboots).toBe(1);
    });

    it('should call onReloaded after the reload resolves', async () => {
      await loadBaseline([{ x: 0, y: 0 }]);
      await setScene(
        baseScene([
          { x: 0, y: 0 },
          { x: 0, y: 1 },
        ]),
      );
      await vi.advanceTimersByTimeAsync(DEBOUNCE + 1);
      expect(reloaded).toBe(1);
    });

    it('should coalesce a burst of parcel edits into one reload', async () => {
      await loadBaseline([{ x: 0, y: 0 }]);
      await setScene(baseScene([{ x: 1, y: 1 }]));
      await setScene(baseScene([{ x: 2, y: 2 }]));
      await setScene(baseScene([{ x: 3, y: 3 }]));
      await vi.advanceTimersByTimeAsync(DEBOUNCE + 1);
      expect(reboots).toBe(1);
    });
  });

  describe('when only the name/description changes (same parcels)', () => {
    it('should NOT reload', async () => {
      await loadBaseline([{ x: 0, y: 0 }]);
      await setScene({ ...baseScene([{ x: 0, y: 0 }]), name: 'Renamed' });
      await setScene({ ...baseScene([{ x: 0, y: 0 }]), description: 'now with words' });
      await vi.advanceTimersByTimeAsync(DEBOUNCE + 1);
      expect(reboots).toBe(0);
    });
  });

  describe('when parcels are reordered but the set is identical', () => {
    it('should NOT reload (order-independent)', async () => {
      await loadBaseline([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]);
      await setScene(
        baseScene([
          { x: 1, y: 0 },
          { x: 0, y: 0 },
        ]),
      );
      await vi.advanceTimersByTimeAsync(DEBOUNCE + 1);
      expect(reboots).toBe(0);
    });
  });

  describe('during the initial load (before arming)', () => {
    it('should NOT reload even though parcels change', async () => {
      // Two Scene writes arrive in the load burst; neither should reload.
      await setScene(baseScene([{ x: 0, y: 0 }]));
      await setScene(
        baseScene([
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ]),
      );
      await vi.advanceTimersByTimeAsync(DEBOUNCE + 1);
      expect(reboots).toBe(0);
    });
  });
});
