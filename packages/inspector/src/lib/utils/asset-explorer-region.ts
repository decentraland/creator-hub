/**
 * Tracks whether the pointer is over the Local Assets explorer. Its keyboard shortcuts
 * (Delete, Ctrl/Cmd+C, Ctrl/Cmd+V) overlap with the scene's entity shortcuts, so the scene
 * hotkeys step aside while this is true.
 */
let pointerOverAssetExplorer = false;

export function setPointerOverAssetExplorer(value: boolean) {
  pointerOverAssetExplorer = value;
}

export function isPointerOverAssetExplorer() {
  return pointerOverAssetExplorer;
}
