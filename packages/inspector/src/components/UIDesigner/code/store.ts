export {
  bootstrapCodeMode,
  getSnapshot,
  loadAndParse,
  selectRootFile,
  subscribe,
  useCodeState,
} from './store-core';
export type { CodeRoot, CodeState, ResolvedComponent } from './store-core';
export {
  codeComponentValueForLayer,
  findCodeLayoutParent,
  findCodeNode,
  interactionLayerValue,
} from './store-nodes';
export { platformBranchesWithContent } from './store-bindings';
export type { MoveAnchor } from './store-splices';

import {
  createRootUnlocked,
  exclusive,
  redoCodeUnlocked,
  removeRootUnlocked,
  renameRootUnlocked,
  undoCodeUnlocked,
} from './store-core';
import {
  setRootScreenInsetUnlocked,
  spliceAddChildUnlocked,
  spliceAddWidgetUnlocked,
  spliceComponentPatchUnlocked,
  spliceDuplicateUnlocked,
  spliceInsertComponentUnlocked,
  spliceInstancePropUnlocked,
  spliceMoveUnlocked,
  spliceRemoveNodesUnlocked,
  spliceRenameNodeUnlocked,
  spliceSetFreeFlowUnlocked,
  spliceSetRootChildUnlocked,
  spliceUiTransformPositionsUnlocked,
  spliceUiTransformPositionUnlocked,
  spliceUiTransformResizeUnlocked,
  toggleTopLevelUnlocked,
  unsetInstancePropUnlocked,
} from './store-splices';
import {
  addBindActionUnlocked,
  addBindPropUnlocked,
  addBindVariableUnlocked,
  addInteractionLayerUnlocked,
  addInteractionStatesUnlocked,
  addPlatformBranchUnlocked,
  addPlatformVariantUnlocked,
  bindAttributeUnlocked,
  removeActionUnlocked,
  removeInteractionLayerUnlocked,
  removeInteractionStatesUnlocked,
  removePlatformVariantUnlocked,
  removePropUnlocked,
  removeStateVariableUnlocked,
  retypePropUnlocked,
  retypeStateVariableUnlocked,
  setActionBodyUnlocked,
  setInteractionActiveBindingUnlocked,
  setInteractionFieldUnlocked,
  setMixedContentAttributeUnlocked,
  setStateVariableValueUnlocked,
  unbindAttributeUnlocked,
} from './store-bindings';

export const undoCode = exclusive(undoCodeUnlocked);
export const redoCode = exclusive(redoCodeUnlocked);
export const createRoot = exclusive(createRootUnlocked);
export const removeRoot = exclusive(removeRootUnlocked);
export const renameRoot = exclusive(renameRootUnlocked);
export const toggleTopLevel = exclusive(toggleTopLevelUnlocked);
export const setRootScreenInset = exclusive(setRootScreenInsetUnlocked);
export const spliceComponentPatch = exclusive(spliceComponentPatchUnlocked);
export const spliceUiTransformPosition = exclusive(spliceUiTransformPositionUnlocked);
export const spliceUiTransformPositions = exclusive(spliceUiTransformPositionsUnlocked);
export const spliceUiTransformResize = exclusive(spliceUiTransformResizeUnlocked);
export const spliceAddChild = exclusive(spliceAddChildUnlocked);
export const spliceAddWidget = exclusive(spliceAddWidgetUnlocked);
export const spliceSetRootChild = exclusive(spliceSetRootChildUnlocked);
export const spliceSetFreeFlow = exclusive(spliceSetFreeFlowUnlocked);
export const spliceInsertComponent = exclusive(spliceInsertComponentUnlocked);
export const spliceInstanceProp = exclusive(spliceInstancePropUnlocked);
export const unsetInstanceProp = exclusive(unsetInstancePropUnlocked);
export const spliceRemoveNodes = exclusive(spliceRemoveNodesUnlocked);
export const spliceMove = exclusive(spliceMoveUnlocked);
export const spliceDuplicate = exclusive(spliceDuplicateUnlocked);
export const spliceRenameNode = exclusive(spliceRenameNodeUnlocked);
export const bindAttribute = exclusive(bindAttributeUnlocked);
export const unbindAttribute = exclusive(unbindAttributeUnlocked);
export const setMixedContentAttribute = exclusive(setMixedContentAttributeUnlocked);
export const addBindVariable = exclusive(addBindVariableUnlocked);
export const setStateVariableValue = exclusive(setStateVariableValueUnlocked);
export const addBindAction = exclusive(addBindActionUnlocked);
export const removeAction = exclusive(removeActionUnlocked);
export const setActionBody = exclusive(setActionBodyUnlocked);
export const removeStateVariable = exclusive(removeStateVariableUnlocked);
export const retypeStateVariable = exclusive(retypeStateVariableUnlocked);
export const addBindProp = exclusive(addBindPropUnlocked);
export const removeProp = exclusive(removePropUnlocked);
export const retypeProp = exclusive(retypePropUnlocked);
export const addInteractionStates = exclusive(addInteractionStatesUnlocked);
export const removeInteractionStates = exclusive(removeInteractionStatesUnlocked);
export const setInteractionField = exclusive(setInteractionFieldUnlocked);
export const addInteractionLayer = exclusive(addInteractionLayerUnlocked);
export const removeInteractionLayer = exclusive(removeInteractionLayerUnlocked);
export const setInteractionActiveBinding = exclusive(setInteractionActiveBindingUnlocked);
export const addPlatformVariant = exclusive(addPlatformVariantUnlocked);
export const addPlatformBranch = exclusive(addPlatformBranchUnlocked);
export const removePlatformVariant = exclusive(removePlatformVariantUnlocked);
