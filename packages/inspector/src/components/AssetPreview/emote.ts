import type { AssetContainer } from '@babylonjs/core/assetContainer';

/**
 * Whether a loaded glTF is an emote.
 *
 * Both conditions are required, and each rules out a case the other admits. An emote is an
 * animation authored against the avatar armature: with no clip there is nothing for the emote
 * preview to seek through, and with no avatar rig an ordinary animated scene model — a door,
 * a windmill — would be renamed and previewed as an emote. `Armature_Prop` covers emotes that
 * carry a prop.
 */
export function isEmoteContainer(
  container: Pick<AssetContainer, 'animationGroups' | 'transformNodes'>,
): boolean {
  if (container.animationGroups.length === 0) return false;

  const armature = container.transformNodes.find(node => node.name === 'Armature');
  if (!armature) return false;

  return armature
    .getChildren()
    .some(child => child.name.startsWith('Avatar_') || child.name.startsWith('Armature_Prop'));
}
