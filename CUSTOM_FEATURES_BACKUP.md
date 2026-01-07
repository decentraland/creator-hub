# Custom Features Backup

This document lists all custom features that need to be preserved during updates.

## Blender Sync Feature

### New Files (Untracked)
1. `BLENDER_SYNC_FEATURE.md` - Documentation
2. `BLENDER_SYNC_SUMMARY.md` - Summary documentation
3. `packages/creator-hub/main/resources/blender_export.py` - Python export script
4. `packages/creator-hub/main/src/modules/blender-detector.ts` - Blender detection
5. `packages/creator-hub/main/src/modules/blender-sync.ts` - Blender sync logic
6. `packages/creator-hub/preload/src/modules/blender.ts` - Preload API
7. `packages/creator-hub/renderer/src/components/Modals/BlenderWorkflow/` - UI components
   - `component.tsx`
   - `BlenderSyncPreview.tsx`
   - `types.ts`
   - `styles.css`
   - `index.ts`
8. `packages/inspector/src/components/BlenderEntityCreator/BlenderEntityCreator.tsx`
9. `packages/inspector/src/components/EntityCollector/EntityCollector.tsx`

### Modified Files
1. `packages/creator-hub/main/src/modules/ipc.ts` - Added blender handlers
2. `packages/creator-hub/shared/types/ipc.ts` - Added blender types
3. `packages/creator-hub/shared/types/config.ts` - Added blenderPath field
4. `packages/creator-hub/preload/src/index.ts` - Exported blender module
5. `packages/creator-hub/preload/src/modules/misc.ts` - Possible changes
6. `packages/creator-hub/preload/src/modules/scene.ts` - Possible changes
7. `packages/creator-hub/renderer/src/components/EditorPage/component.tsx` - Added sync button
8. `packages/creator-hub/renderer/src/components/EditorPage/types.ts` - Added modal type
9. `packages/creator-hub/renderer/src/modules/rpc/scene/server.ts` - Added RPC methods
10. `packages/creator-hub/renderer/src/modules/rpc/scene/client.ts` - Added RPC methods
11. `packages/inspector/src/lib/rpc/scene/server.ts` - Added handler
12. `packages/inspector/src/lib/rpc/scene/client.ts` - Added method
13. `packages/inspector/src/components/Toolbar/Toolbar.tsx` - Added button

## GLTF Export Feature

### New Files (Untracked)
1. `GLTF_EXPORT_FEATURE.md` - Documentation
2. `EXPORT_BUTTON_LOCATION.md` - Button location docs
3. `packages/creator-hub/main/src/modules/gltf-exporter.ts` - Export logic
4. `packages/inspector/src/components/Toolbar/ExportGltf/` - Export button
   - `ExportGltf.tsx`
   - `index.ts`

### Modified Files
1. `packages/creator-hub/main/src/modules/ipc.ts` - Added export handler
2. `packages/creator-hub/shared/types/ipc.ts` - Added export types
3. `packages/creator-hub/preload/src/modules/scene.ts` - Added export function
4. `packages/creator-hub/renderer/src/modules/rpc/scene/server.ts` - Added RPC method
5. `packages/inspector/src/lib/rpc/scene/client.ts` - Added RPC method
6. `packages/inspector/src/components/Toolbar/Toolbar.tsx` - Added export button

## Dependencies

Check if these are in package.json:
- `@gltf-transform/core: ^4.1.1`
- `@gltf-transform/extensions: ^4.1.1`
- `@gltf-transform/functions: ^4.1.1`

## Update Strategy

When updating:
1. Commit or stash all custom changes
2. Fetch latest from origin
3. Merge or rebase
4. Reapply custom changes if needed
5. Test blender sync and gltf export features

