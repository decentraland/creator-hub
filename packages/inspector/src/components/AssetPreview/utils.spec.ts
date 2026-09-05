import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isEmote } from './utils';

const babylon = vi.hoisted(() => ({ loadAssetContainer: vi.fn() }));

vi.mock('@babylonjs/core/Engines/engine', () => ({
  Engine: class {
    dispose() {}
  },
}));

vi.mock('@babylonjs/core/scene', () => ({
  Scene: class {
    dispose() {}
  },
}));

vi.mock('@babylonjs/core/Loading/sceneLoader', () => ({
  SceneLoader: { LoadAssetContainerAsync: babylon.loadAssetContainer },
}));

vi.mock('@babylonjs/loaders/glTF', () => ({}));

/** A loaded container rigged to the avatar armature, which is what makes a model an emote. */
const emoteContainer = {
  animationGroups: [{}],
  transformNodes: [{ name: 'Armature', getChildren: () => [{ name: 'Avatar_Head' }] }],
};

describe('isEmote', () => {
  let model: File;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:model');
    globalThis.URL.revokeObjectURL = vi.fn();
    babylon.loadAssetContainer.mockReset();
    model = new File([], 'model.glb');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('when the model loads and is rigged to the avatar armature', () => {
    it('should be an emote', async () => {
      babylon.loadAssetContainer.mockResolvedValue(emoteContainer);

      await expect(isEmote(model)).resolves.toBe(true);
    });
  });

  describe('when the loader rejects', () => {
    it('should not be an emote, rather than propagate', async () => {
      babylon.loadAssetContainer.mockRejectedValue(new Error('corrupt glb'));

      await expect(isEmote(model)).resolves.toBe(false);
    });
  });

  // The import dialog awaits one of these per selected file before it renders anything, so a load
  // that never settles leaves the modal permanently empty with nothing logged.
  describe('when the loader never settles', () => {
    it('should give up and report not an emote so the dialog can still open', async () => {
      babylon.loadAssetContainer.mockReturnValue(new Promise(() => {}));

      const detecting = isEmote(model);
      await vi.advanceTimersByTimeAsync(30_000);

      await expect(detecting).resolves.toBe(false);
      expect(console.error).toHaveBeenCalled();
    });
  });
});
