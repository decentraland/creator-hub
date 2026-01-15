# Update Plan - Preserve Blender Sync & GLTF Export

## Current Status
- **Commits behind**: 6 commits
- **Latest commits on upstream**:
  1. 08fce533 Scripted items (#1008)
  2. ad93a171 Feat/republish scene (#1003)
  3. c8748b85 feat: Edit States component with multiples entities (#975)
  4. 380b589a New actions 2 (#997)
  5. 113738cd fix: undo creates undeletable duplicated template (#998)
  6. 9be073a8 feat: clean unused assets select all, intermediate state, undo clean … (#993)

## Strategy
We'll use git stash to preserve all changes, then merge, then reapply custom features.

## Steps

1. **Stash all changes** (including untracked files)
2. **Merge origin/main**
3. **Create a feature branch** for custom features (optional but recommended)
4. **Reapply blender sync changes**
5. **Reapply gltf export changes**
6. **Resolve any conflicts**
7. **Test both features**

## Files to Preserve

### New Files (will be preserved via stash --include-untracked)
- All BlenderWorkflow components
- All blender-sync modules
- All gltf-exporter modules
- All documentation files
- Python script: `packages/creator-hub/main/resources/blender_export.py`

### Modified Files (will need careful merge)
- `packages/creator-hub/renderer/src/components/EditorPage/component.tsx` - Has refactored modals + blender button
- `packages/creator-hub/renderer/src/components/EditorPage/types.ts` - Has 'blender-workflow' type
- `packages/creator-hub/main/src/modules/ipc.ts` - Has blender handlers
- `packages/creator-hub/shared/types/ipc.ts` - Has blender types
- `packages/creator-hub/shared/types/config.ts` - Has blenderPath
- All RPC files that have blender/export methods

## Expected Conflicts
- `component.tsx` - Upstream may have different modal structure
- `types.ts` - Modal types may differ
- Various RPC files - May have new upstream changes

## Testing Checklist
After update:
- [ ] Blender sync button appears in header
- [ ] GLTF export button works
- [ ] Blender detection works
- [ ] Blender export works
- [ ] Sync preview modal works
- [ ] Scene export as GLTF works

