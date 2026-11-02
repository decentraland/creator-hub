import { createSpawnPointController } from './spawn-point-controller';
import type { BevySpawnPointController } from './spawn-point-controller';

/**
 * The Bevy spawn-point controller owns selection/visibility state (drives the
 * tree) and brokers a position-only move-handle: attach records the callback,
 * setPosition shows the handle for the attached index, and an agent-reported
 * commit routes back to the callback.
 */
describe('createSpawnPointController', () => {
  let shown: Array<{ x: number; y: number; z: number } | null>;
  let resolved: { x: number; y: number; z: number } | null;
  let controller: BevySpawnPointController;

  beforeEach(() => {
    shown = [];
    // The controller reads the attached spawn point's position via this resolver.
    resolved = { x: 2, y: 0, z: 2 };
    controller = createSpawnPointController({ show: p => shown.push(p) }, () => resolved);
  });

  describe('selection state', () => {
    it('should track the selected index + target and emit on change', () => {
      const events: Array<{ index: number | null; target: string | null }> = [];
      controller.onSelectionChange(e => events.push(e));

      controller.select(2);
      expect(controller.getSelectedIndex()).toBe(2);
      expect(controller.getSelectedTarget()).toBe('position');

      controller.selectCameraTarget(2);
      expect(controller.getSelectedTarget()).toBe('cameraTarget');

      controller.select(null);
      expect(controller.getSelectedIndex()).toBeNull();
      expect(controller.getSelectedTarget()).toBeNull();

      expect(events).toEqual([
        { index: 2, target: 'position' },
        { index: 2, target: 'cameraTarget' },
        { index: null, target: null },
      ]);
    });
  });

  describe('visibility state', () => {
    it('should track hidden names and emit on change', () => {
      const events: Array<{ name: string; visible: boolean }> = [];
      controller.onVisibilityChange(e => events.push(e));

      controller.setVisible(0, 'spawn1', false);
      expect(controller.isHidden('spawn1')).toBe(true);
      controller.setVisible(0, 'spawn1', true);
      expect(controller.isHidden('spawn1')).toBe(false);

      expect(events).toEqual([
        { name: 'spawn1', visible: false },
        { name: 'spawn1', visible: true },
      ]);
    });
  });

  describe('the move-handle', () => {
    it('should show the resolved position when a gizmo attaches', () => {
      resolved = { x: 2, y: 0, z: 2 };
      controller.attachGizmo(1, 'position', () => {});
      expect(shown).toEqual([{ x: 2, y: 0, z: 2 }]);
    });

    it('should re-show the handle for the attached index on setPosition', () => {
      controller.attachGizmo(1, 'position', () => {}); // shows resolved (2,0,2)
      controller.setPosition(1, 'position', { x: 5, y: 0, z: 7 } as never);
      expect(shown).toEqual([
        { x: 2, y: 0, z: 2 },
        { x: 5, y: 0, z: 7 },
      ]);
    });

    it('should NOT re-show the handle for a different index on setPosition', () => {
      controller.attachGizmo(1, 'position', () => {}); // shows resolved
      shown.length = 0;
      controller.setPosition(3, 'position', { x: 1, y: 0, z: 1 } as never);
      expect(shown).toEqual([]);
    });

    it('should route a committed drag to the attached callback', () => {
      const moves: Array<{ index: number; pos: { x: number; y: number; z: number } }> = [];
      controller.attachGizmo(1, 'position', (index, p) =>
        moves.push({ index, pos: { x: p.x, y: p.y, z: p.z } }),
      );
      controller.handleGizmoCommit({ x: 9, y: 0, z: 4 });
      expect(moves).toEqual([{ index: 1, pos: { x: 9, y: 0, z: 4 } }]);
    });

    it('should re-resolve and re-show the attached handle on refreshHandle', () => {
      controller.attachGizmo(1, 'position', () => {}); // shows resolved (2,0,2)
      resolved = { x: 8, y: 0, z: 9 }; // Scene metadata changed (e.g. a form edit)
      controller.refreshHandle();
      expect(shown).toEqual([
        { x: 2, y: 0, z: 2 },
        { x: 8, y: 0, z: 9 },
      ]);
    });

    it('should no-op refreshHandle when nothing is attached', () => {
      controller.refreshHandle();
      expect(shown).toEqual([]);
    });

    it('should hide the handle and ignore commits after detach', () => {
      const moves: unknown[] = [];
      controller.attachGizmo(1, 'position', (i, p) => moves.push([i, p]));
      shown.length = 0;
      controller.detachGizmo();
      expect(shown).toEqual([null]);
      controller.handleGizmoCommit({ x: 1, y: 0, z: 1 });
      expect(moves).toEqual([]);
    });
  });
});
