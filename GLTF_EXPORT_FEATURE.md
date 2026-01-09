# GLTF Scene Export Feature - Implementation Summary

## Overview

Successfully implemented a feature that exports an entire Decentraland scene as a single merged GLTF file for use in Blender or other 3D applications.

## What Was Implemented

### 1. **Core Export Module** (`packages/creator-hub/main/src/modules/gltf-exporter.ts`)
- Merges all GLTF models from the scene into a single file
- Applies correct transforms (position, rotation, scale) from Decentraland entities
- Handles textures and materials properly
- Optimizes the merged model (deduplication, pruning, welding)
- Supports both GLB (binary) and GLTF (JSON) export formats
- Includes comprehensive error handling

### 2. **IPC Communication Layer**
- **Type Definitions** (`packages/creator-hub/shared/types/ipc.ts`):
  - Added `scene.exportAsGltf` IPC method
  - Defined `EntityData`, `SceneExportData`, and `ExportResult` interfaces

- **Main Process Handler** (`packages/creator-hub/main/src/modules/ipc.ts`):
  - Registered `scene.exportAsGltf` handler
  - Integrated with gltf-exporter module

- **Preload Script** (`packages/creator-hub/preload/src/modules/scene.ts`):
  - Exposed `exportSceneAsGltf` function to renderer

### 3. **RPC Communication (Inspector ↔ Creator Hub)**
- **Server Side** (`packages/creator-hub/renderer/src/modules/rpc/scene/server.ts`):
  - Added `EXPORT_SCENE_GLTF` RPC method
  - Handles entity data from inspector
  - Provides user feedback via snackbar notifications

- **Client Side** (`packages/inspector/src/lib/rpc/scene/client.ts`):
  - Added `exportSceneAsGltf` method to SceneClient
  - Defined EntityData interface

### 4. **User Interface**
- **Export Button** (`packages/inspector/src/components/Toolbar/ExportGltf/ExportGltf.tsx`):
  - New toolbar button with export icon (BiExport)
  - Collects all entities with GLTF models and their transforms
  - Shows loading state while exporting
  - Validates scene has models before export
  - Sends data to Creator Hub via RPC

- **Toolbar Integration** (`packages/inspector/src/components/Toolbar/Toolbar.tsx`):
  - Added ExportGltf button between Preferences and Inspector buttons

### 5. **Dependencies**
Added to `packages/creator-hub/package.json`:
- `@gltf-transform/core: ^4.1.1` - Core GLTF manipulation library
- `@gltf-transform/extensions: ^4.1.1` - GLTF extensions support
- `@gltf-transform/functions: ^4.1.1` - Optimization functions

## How It Works

1. **User clicks Export button** in the Inspector toolbar
2. **Inspector collects entity data**:
   - Iterates through all entities with Transform components
   - Filters entities that have GltfContainer components
   - Extracts: entity ID, GLTF file path, transform data, and name
3. **Data sent via RPC** to Creator Hub renderer
4. **Creator Hub calls IPC** to main process with project path and entities
5. **Main process exports**:
   - Loads each GLTF model referenced by entities
   - Creates a new merged GLTF document
   - Applies transforms from Decentraland to each model
   - Optimizes the merged model
   - Shows save dialog to user
   - Writes GLB or GLTF file to disk
6. **User feedback** via snackbar notifications (success/error)

## File Structure

```
packages/
├── creator-hub/
│   ├── package.json (+ dependencies)
│   ├── main/src/modules/
│   │   ├── gltf-exporter.ts (NEW - core export logic)
│   │   └── ipc.ts (modified - added handler)
│   ├── preload/src/modules/
│   │   └── scene.ts (modified - added export function)
│   ├── renderer/src/modules/rpc/scene/
│   │   └── server.ts (modified - added RPC handler)
│   └── shared/types/
│       └── ipc.ts (modified - added types)
└── inspector/
    ├── src/components/Toolbar/
    │   ├── ExportGltf/ (NEW)
    │   │   ├── ExportGltf.tsx (NEW - button component)
    │   │   └── index.ts (NEW - exports)
    │   └── Toolbar.tsx (modified - added button)
    └── src/lib/rpc/scene/
        └── client.ts (modified - added RPC method)
```

## Testing Instructions

### Prerequisites
1. Ensure Node.js 22.x is active:
   ```bash
   source ~/.nvm/nvm.sh && nvm use 22
   ```

2. Install new dependencies:
   ```bash
   cd packages/creator-hub
   npm install
   ```

### Build and Run

1. **Build all packages**:
   ```bash
   cd /Users/toxsam/Desktop/Web/DCL\ Creator\ Hub\ scene\ exporter
   make build
   ```

2. **Start Creator Hub**:
   ```bash
   cd packages/creator-hub
   npm run start
   ```

3. **In Creator Hub**:
   - Open or create a scene
   - Add some 3D models (GLTF/GLB files) to the scene
   - Position/rotate/scale them as desired

4. **Export the scene**:
   - Look for the Export button (📤 icon) in the Inspector toolbar
   - Click the Export button
   - Choose save location and format (GLB or GLTF)
   - Check for success/error notification

### Test Cases

#### ✅ Happy Path
- Scene with multiple GLTF models
- Models with transforms applied
- Should create merged file with all models in correct positions

#### ⚠️ Edge Cases
- **Empty scene**: Should show warning "No 3D models found"
- **Scene with only primitives** (cubes, spheres): Should show warning
- **Large scene**: Should handle multiple models (test with 10+ models)
- **Missing files**: Should handle missing GLTF files gracefully

#### 🎯 Expected Output
- **GLB format**: Single binary file
- **GLTF format**: JSON file + bin file + texture files
- All models should be:
  - In correct positions relative to each other
  - With proper rotations applied
  - Scaled correctly
  - Materials and textures intact

### Validation in Blender

1. Open Blender
2. File → Import → glTF 2.0 (.glb/.gltf)
3. Select exported file
4. Verify:
   - All models are present
   - Positions match the Decentraland scene
   - Materials look correct
   - No missing textures

## Known Limitations

1. **Animations**: Animations are resampled but may not play identically
2. **Skins/Armatures**: Skinned meshes may have issues (logged as warning)
3. **Large Scenes**: Memory intensive for scenes with many high-poly models
4. **External Assets**: Only includes models referenced in the scene JSON

## Future Enhancements

Potential improvements:
- Progress indicator for large exports
- Preview before export
- Export options (optimize level, texture resolution, etc.)
- Batch export multiple scenes
- Export selection only
- Include environment/lighting settings

## Technical Notes

### Coordinate System
- Decentraland uses Y-up coordinate system
- GLTF also uses Y-up, so no conversion needed
- Transforms are applied as-is

### Transform Hierarchy
- Each entity becomes a parent node in GLTF
- Original model nodes are children of entity nodes
- This preserves the scene hierarchy

### Optimization
The exporter automatically applies:
- `dedup()` - Removes duplicate textures and materials
- `prune()` - Removes unused nodes, meshes, accessors
- `weld()` - Merges duplicate vertices (tolerance: 0.0001)
- `resample()` - Optimizes animations if present

### Error Handling
- File read errors: Logged and skipped, other models still exported
- Invalid transforms: Uses default transform values
- Export failures: User-friendly error messages via notifications
- Missing RPC: Graceful degradation with console warnings

## Troubleshooting

### "No RPC server available"
- Ensure Creator Hub is running
- Check that scene is opened in editor (not just preview)

### "Export failed: Cannot resolve file"
- GLTF file referenced in scene doesn't exist
- Check scene's asset paths are correct

### Empty export file
- Ensure scene has GLTF models (not just primitives)
- Check console logs for entity collection issues

### Dependencies not found
Run from project root:
```bash
cd packages/creator-hub
npm install
make build
```

## Implementation Checklist

- [x] Research scene data structure
- [x] Research IPC patterns
- [x] Find existing export patterns
- [x] Add gltf-transform dependencies
- [x] Create gltf-exporter module
- [x] Add IPC handlers
- [x] Add RPC methods
- [x] Create Export button UI
- [x] Implement entity collection logic
- [x] Add error handling
- [x] Add user feedback (notifications)
- [ ] Manual testing with real scenes (USER TO DO)

## Summary

The GLTF export feature is fully implemented and ready for testing. It provides a seamless way to export Decentraland scenes to standard GLTF format for refinement in external tools like Blender. The implementation follows the existing architectural patterns in the codebase and includes comprehensive error handling and user feedback.

