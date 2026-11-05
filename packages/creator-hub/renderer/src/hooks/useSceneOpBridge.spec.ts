import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AiSceneOpRequest } from '/shared/types/ipc';

const { ai } = await import('#preload');
const { useSceneOpBridge } = await import('./useSceneOpBridge');

type Listener = (req: AiSceneOpRequest) => void;

describe('useSceneOpBridge', () => {
  let listener: Listener | undefined;
  let cleanup: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listener = undefined;
    cleanup = vi.fn();
    vi.mocked(ai.onSceneOpRequest).mockImplementation(cb => {
      listener = cb;
      return { cleanup };
    });
  });

  describe('when the editor has a scene loaded', () => {
    let createEntity: ReturnType<typeof vi.fn>;
    let ref: { current: any };

    beforeEach(() => {
      createEntity = vi.fn().mockResolvedValue({ entity: 512 });
      ref = { current: { scene: { createEntity } } };
    });

    // No AI-assistant flag reaches this hook: an outside agent's write must be answered with
    // the in-app assistant switched off (the bridge used to listen only while it was on).
    it('should answer a write op with the inspector result', async () => {
      renderHook(() => useSceneOpBridge(ref));

      listener!({ id: 'op-1', op: 'create_entity', params: { name: 'Cube' } });

      await waitFor(() =>
        expect(ai.sceneOpResult).toHaveBeenCalledWith('op-1', true, { entity: 512 }),
      );
      expect(createEntity).toHaveBeenCalledWith('Cube', undefined);
    });

    it('should report an inspector error as a failed op', async () => {
      createEntity.mockRejectedValue(new Error('Scene RPC "create_entity" timed out'));
      renderHook(() => useSceneOpBridge(ref));

      listener!({ id: 'op-2', op: 'create_entity', params: {} });

      await waitFor(() =>
        expect(ai.sceneOpResult).toHaveBeenCalledWith(
          'op-2',
          false,
          'Scene RPC "create_entity" timed out',
        ),
      );
    });

    it('should reject an unknown op', async () => {
      renderHook(() => useSceneOpBridge(ref));

      listener!({ id: 'op-3', op: 'explode', params: {} });

      await waitFor(() =>
        expect(ai.sceneOpResult).toHaveBeenCalledWith('op-3', false, 'Unknown scene op "explode".'),
      );
    });

    it('should stop listening on unmount', () => {
      const { unmount } = renderHook(() => useSceneOpBridge(ref));

      unmount();

      expect(cleanup).toHaveBeenCalled();
    });
  });

  describe('when no scene is loaded', () => {
    it('should answer that no scene is open', async () => {
      renderHook(() => useSceneOpBridge({ current: undefined }));

      listener!({ id: 'op-4', op: 'create_entity', params: {} });

      await waitFor(() =>
        expect(ai.sceneOpResult).toHaveBeenCalledWith('op-4', false, 'No scene is open.'),
      );
    });
  });
});
