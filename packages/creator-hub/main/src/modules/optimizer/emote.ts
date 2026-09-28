// Emotes are the one model kind the optimizer must not touch.
//
// An emote is an animation clip authored against the AVATAR's armature: it declares that rig as
// a `skin` whose joints are the avatar bones, and carries no skinned mesh of its own — the
// avatar supplies the mesh at runtime. `prune` tree-shakes every skin nothing references, so it
// drops that skin (and its inverseBindMatrices accessor) and the file stops being an emote.
// Reproduced on asset-packs' sword_attack_emote.glb, where the mesh pass logs
// `prune: Removed types... Skin (1), Accessor (1)` and the written GLB has no `skins` at all.
//
// Skipping costs almost nothing: a plain emote carries no mesh, material or texture at all, so
// every other pass is already a no-op on it. One that carries a prop does have a small texture
// set, and that saving is given up on purpose — its avatar bones still drive no mesh, so `prune`
// drops its skin exactly the same way.

const EMOTE_NAME_SUFFIX = '_emote';
const ARMATURE_NODE = 'Armature';
// `Armature_Prop` covers an emote that carries a prop (a sword, a cup) alongside the avatar bones.
const AVATAR_CHILD_PREFIXES = ['Avatar_', 'Armature_Prop'];

// The name the Creator Hub's own importer gives an emote on import (inspector's
// `useSliderAssets`), so a creator's file carries the convention by the time it reaches a scene.
function hasEmoteFileName(relPath: string): boolean {
  const name = relPath.slice(relPath.lastIndexOf('/') + 1);
  return name.toLowerCase().endsWith(`${EMOTE_NAME_SUFFIX}.glb`);
}

// Same rule the inspector's `isEmoteContainer` applies to a loaded Babylon container, read off
// the raw glTF JSON instead: an `Armature` node whose children are avatar bones. Both halves are
// required — without a clip there is no emote, and without the avatar rig an ordinary animated
// model (a door, a windmill) would be mistaken for one.
function hasAvatarRig(json: any): boolean {
  const nodes = json?.nodes;
  if (!Array.isArray(nodes)) return false;
  const armature = nodes.find((node: any) => node?.name === ARMATURE_NODE);
  if (!armature || !Array.isArray(armature.children)) return false;
  return armature.children.some((index: number) => {
    const name = nodes[index]?.name;
    return typeof name === 'string' && AVATAR_CHILD_PREFIXES.some(p => name.startsWith(p));
  });
}

export function isEmoteGlb(relPath: string, json: any): boolean {
  if (hasEmoteFileName(relPath)) return true;
  if (!Array.isArray(json?.animations) || json.animations.length === 0) return false;
  return hasAvatarRig(json);
}
