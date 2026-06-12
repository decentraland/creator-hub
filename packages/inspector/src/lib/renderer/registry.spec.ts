import mitt from 'mitt';
import type { Emitter } from 'mitt';

import type { IRenderer, RendererEvents } from './types';
import { RendererRegistry } from './registry';

/** A throwaway IRenderer that records its own disposal. */
function createStubRenderer(disposed: { value: boolean }): IRenderer {
  const events: Emitter<RendererEvents> = mitt<RendererEvents>();
  const noop = () => {};
  return {
    events,
    camera: {
      getSpeed: () => 0,
      reset: noop,
      focusOnEntity: noop,
      setInvertRotation: noop,
      zoom: noop,
      getPose: () => ({ position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 }, fov: 0 }),
      setPose: noop,
      setControlEnabled: noop,
    },
    gizmos: {
      isEnabled: () => false,
      setEnabled: noop,
      setMode: noop,
      isWorldAligned: () => true,
      setWorldAligned: noop,
      isWorldAlignmentDisabled: () => false,
      onChange: () => noop,
    },
    metrics: {
      getSceneMetrics: () => ({ triangles: 0, bodies: 0, materials: 0, textures: 0 }),
      getEntitiesOutsideLayout: () => [],
      onChange: () => noop,
    },
    viewport: {
      onFrame: () => noop,
      getGroundPlanes: () => [],
      getEntityWorldPositions: () => new Map(),
    },
    spawnPoints: {
      getSelectedIndex: () => null,
      getSelectedTarget: () => null,
      isHidden: () => false,
      select: noop,
      selectCameraTarget: noop,
      setVisible: noop,
      onSelectionChange: () => noop,
      onVisibilityChange: () => noop,
    },
    setSelection: noop,
    getPointerWorldPoint: async () => null,
    setGridVisible: noop,
    dispose: () => {
      disposed.value = true;
    },
  };
}

describe('RendererRegistry', () => {
  let registry: RendererRegistry;

  beforeEach(() => {
    registry = new RendererRegistry();
  });

  describe('when nothing is mounted', () => {
    it('should report not mounted and throw on current', () => {
      expect(registry.isMounted).toBe(false);
      expect(registry.currentId).toBeNull();
      expect(() => registry.current).toThrow();
    });
  });

  describe('when mounting an in-process renderer', () => {
    it('should expose it as the current renderer', async () => {
      const disposed = { value: false };
      const renderer = createStubRenderer(disposed);

      const mounted = await registry.mount({
        id: 'babylon',
        kind: 'in-process',
        create: () => renderer,
      });

      expect(mounted).toBe(renderer);
      expect(registry.current).toBe(renderer);
      expect(registry.currentId).toBe('babylon');
      expect(registry.isMounted).toBe(true);
    });
  });

  describe('when swapping renderers at runtime', () => {
    it('should dispose the previous renderer before mounting the next', async () => {
      const firstDisposed = { value: false };
      const secondDisposed = { value: false };
      const first = createStubRenderer(firstDisposed);
      const second = createStubRenderer(secondDisposed);

      await registry.mount({ id: 'a', kind: 'in-process', create: () => first });
      expect(firstDisposed.value).toBe(false);

      await registry.mount({ id: 'b', kind: 'in-process', create: () => second });

      expect(firstDisposed.value).toBe(true);
      expect(secondDisposed.value).toBe(false);
      expect(registry.current).toBe(second);
      expect(registry.currentId).toBe('b');
    });
  });

  describe('when unmounting', () => {
    it('should dispose the current renderer and clear state', async () => {
      const disposed = { value: false };
      await registry.mount({
        id: 'a',
        kind: 'in-process',
        create: () => createStubRenderer(disposed),
      });

      registry.unmount();

      expect(disposed.value).toBe(true);
      expect(registry.isMounted).toBe(false);
      expect(registry.currentId).toBeNull();
    });

    it('should be a no-op when nothing is mounted', () => {
      expect(() => registry.unmount()).not.toThrow();
    });
  });
});
