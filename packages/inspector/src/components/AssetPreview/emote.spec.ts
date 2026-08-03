import { describe, expect, it } from 'vitest';

import { isEmoteContainer } from './emote';

type Container = Parameters<typeof isEmoteContainer>[0];

/**
 * Minimal stand-in for a loaded `AssetContainer`. Only the node names, their parent and the
 * animation count matter here, so building the real thing would need a WebGL context for
 * nothing.
 */
function container({ animations = 1, nodes = {} as Record<string, string[]> }): Container {
  const transformNodes = Object.entries(nodes).map(([name, children]) => ({
    name,
    getChildren: () => children.map(child => ({ name: child })),
  }));

  return {
    animationGroups: Array.from({ length: animations }),
    transformNodes,
  } as unknown as Container;
}

describe('isEmoteContainer', () => {
  describe('when the model has an animation and the avatar armature', () => {
    it('should be an emote', () => {
      expect(
        isEmoteContainer(container({ nodes: { Armature: ['Avatar_Head', 'Avatar_Hair'] } })),
      ).toBe(true);
    });

    it('should be an emote when the armature carries a prop instead', () => {
      expect(isEmoteContainer(container({ nodes: { Armature: ['Armature_Prop_Sword'] } }))).toBe(
        true,
      );
    });
  });

  describe('when the model has the avatar armature but no animation', () => {
    it('should not be an emote, since there is no clip to play', () => {
      expect(
        isEmoteContainer(container({ animations: 0, nodes: { Armature: ['Avatar_Head'] } })),
      ).toBe(false);
    });
  });

  describe('when the model is animated but is not rigged to an avatar', () => {
    // An ordinary animated scene model. Classifying these as emotes would rename the file and
    // preview it on an avatar.
    it('should not be an emote when there is no armature at all', () => {
      expect(isEmoteContainer(container({ nodes: { Door: [], Hinge: [] } }))).toBe(false);
    });

    it('should not be an emote when an armature has no avatar children', () => {
      expect(isEmoteContainer(container({ nodes: { Armature: ['Bone_01', 'Blade'] } }))).toBe(
        false,
      );
    });
  });

  describe('when the model is neither animated nor rigged', () => {
    it('should not be an emote', () => {
      expect(isEmoteContainer(container({ animations: 0, nodes: { Mesh: [] } }))).toBe(false);
    });
  });
});
