/**
 * Tracks whether the Local Assets explorer owns the keyboard: the pointer is over it, or the
 * last click landed inside it. Its shortcuts (Delete, Ctrl/Cmd+C/X/V, arrows) overlap with the
 * scene's entity shortcuts, so the scene hotkeys step aside while this is true.
 */
let pointerOverAssetExplorer = false;
let assetExplorerFocused = false;

export function setPointerOverAssetExplorer(value: boolean) {
  pointerOverAssetExplorer = value;
}

export function setAssetExplorerFocused(value: boolean) {
  assetExplorerFocused = value;
}

export function isPointerOverAssetExplorer() {
  return pointerOverAssetExplorer;
}

export function isAssetExplorerActive() {
  return pointerOverAssetExplorer || assetExplorerFocused;
}
