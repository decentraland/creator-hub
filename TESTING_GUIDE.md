# Blender Sync Feature - Testing Guide

## Quick Start

### Prerequisites
1. **Blender installed** (3.0 or higher recommended)
   - Download from https://www.blender.org/download/
2. **Creator Hub running** with a scene open
3. **Sample .blend file** with 3D objects

### Basic Testing Steps

#### 1. Test Blender Detection
```bash
# Start Creator Hub
npm run watch
```

1. Open a scene in Creator Hub
2. Click the **"Sync from Blender"** button (next to Export button in header)
3. Verify one of:
   - ✅ "Blender X.X.X detected" appears
   - ⚠️ Warning shown if Blender not found

#### 2. Test Manual Path Selection (if Blender not detected)
1. Click the settings icon next to Blender status
2. Navigate to Blender executable:
   - **macOS**: `/Applications/Blender.app/Contents/MacOS/Blender`
   - **Windows**: `C:\Program Files\Blender Foundation\Blender X.X\blender.exe`
   - **Linux**: `/usr/bin/blender`
3. Verify version detected after selection

#### 3. Test Blend File Selection
1. Click "Browse" button
2. Select a `.blend` file
3. Verify file path shown in text field

#### 4. Test Export and Sync
1. Ensure you have objects in your Blender file
2. Click **"Sync from Blender"**
3. Wait for export (watch console for progress)
4. Verify:
   - Preview dialog appears
   - Changes are listed
   - Object names shown correctly

#### 5. Test Change Preview
The preview should show:
- **New Objects**: Objects from Blender not in scene
- **Updated Objects**: Objects with changed transforms
- Transform values (position, rotation, scale)

#### 6. Test Apply Changes
1. Review changes in preview
2. Click **"Apply Changes"**
3. Verify entities updated in scene (to be implemented in Inspector)

## Sample Test Scenario

### Scenario: Sync a Simple Scene

1. **Create a test Blender file**:
   ```
   - Open Blender
   - Add a Cube at position (0, 0, 0)
   - Add a Sphere at position (3, 0, 0)
   - Name them "TestCube" and "TestSphere"
   - Save as "test_scene.blend"
   ```

2. **In Creator Hub**:
   - Open/create a scene
   - Click "Sync from Blender"
   - Select "test_scene.blend"
   - Click "Sync from Blender"

3. **Expected Result**:
   - Preview shows 2 new objects
   - TestCube at (0, 0, 0)
   - TestSphere at (3, 0, 0)

4. **Modify in Blender**:
   - Move TestCube to (5, 2, 0)
   - Save
   - Sync again

5. **Expected Result**:
   - Preview shows 1 updated object (TestCube)
   - Old position: (0, 0, 0)
   - New position: (5, 2, 0)

## Console Debugging

Check the console for detailed logs:
```javascript
[Blender Detector] Starting Blender detection...
[Blender Detector] Found Blender at: /Applications/Blender.app/Contents/MacOS/Blender
[Blender Detector] Valid Blender installation: { path: '...', version: '4.2.5', isValid: true }

[Blender Sync] Starting Blender export...
[Blender Sync] Using Blender: /Applications/Blender.app/Contents/MacOS/Blender
[Blender Sync] Output directory: /tmp/blender-export-1234567890
[Blender Sync] Running command: ...

[Blender Export] Starting export to: /tmp/blender-export-1234567890
[Blender Export] GLTF exported successfully
[Blender Export] Metadata exported successfully
[Blender Export] Exported 2 mesh objects

[Blender Sync] Export successful!
[Blender Sync] Detecting changes...
[Blender Sync] Found 2 changes
```

## Known Limitations (Current Implementation)

1. **Entity Collection**: The Inspector-side entity collection is not yet fully implemented
   - Currently returns empty array
   - All Blender objects will show as "new"
   
2. **Apply Changes**: The "Apply Changes" functionality needs Inspector integration
   - Preview works
   - Actual scene updates to be implemented

3. **RPC Communication**: Full RPC flow between Inspector and Creator Hub needs testing

## Next Steps for Complete Implementation

### Inspector Integration
To complete the feature, implement in Inspector:

1. **Entity Collection Handler** (packages/inspector/src/components/EntityCollector.tsx):
   ```typescript
   // Listen for 'collect-scene-entities' event
   // Collect all entities with GLTF containers
   // Dispatch 'scene-entities-collected' with data
   ```

2. **Change Application Handler**:
   ```typescript
   // Listen for 'apply-blender-changes' event
   // Update entity transforms
   // Notify user of success
   ```

3. **Add to Inspector initialization**:
   - Mount EntityCollector component
   - Connect to Redux store for entity data

## Troubleshooting

### Blender Not Found
**Problem**: "Blender not found" message

**Solutions**:
1. Install Blender from https://www.blender.org/download/
2. Manually select Blender path
3. Check console for detailed error

### Export Timeout
**Problem**: Sync hangs or times out

**Solutions**:
1. Check if Blender is actually running (Task Manager/Activity Monitor)
2. Verify .blend file is not corrupted
3. Try with simpler scene (fewer objects)
4. Increase timeout in `blender-sync.ts` (line 176)

### No Changes Detected
**Problem**: Preview shows no changes

**Possible Causes**:
1. Object names don't match
2. Transforms haven't actually changed
3. .blend file not saved after changes
4. Entity collection not working (expected in current implementation)

### Permission Denied
**Problem**: Cannot execute Blender

**Solutions**:
1. macOS: Right-click Blender.app > Open (to allow)
2. Linux: `chmod +x /path/to/blender`
3. Windows: Run as Administrator

## Performance Testing

Test with different scene sizes:
- ✅ Small: 1-10 objects (~5 seconds)
- ✅ Medium: 10-50 objects (~10 seconds)
- ✅ Large: 50-100 objects (~20 seconds)
- ⚠️ Very Large: 100+ objects (may exceed 60s timeout)

## Automated Testing (Future)

### Unit Tests
```typescript
// Test Blender detection
describe('BlenderDetector', () => {
  test('detects Blender on macOS', async () => {
    const info = await detectBlender();
    expect(info).toBeTruthy();
    expect(info?.isValid).toBe(true);
  });
});

// Test export
describe('BlenderSync', () => {
  test('exports from blend file', async () => {
    const result = await exportFromBlender({
      blendFilePath: './test.blend',
    });
    expect(result.success).toBe(true);
    expect(result.metadata).toBeTruthy();
  });
});
```

### Integration Tests
```typescript
// Test full workflow
describe('Blender Workflow', () => {
  test('complete sync workflow', async () => {
    // 1. Detect Blender
    // 2. Select .blend file
    // 3. Export
    // 4. Compare with entities
    // 5. Preview changes
    // 6. Apply changes
  });
});
```

## Reporting Issues

When reporting issues, include:
1. **OS and version** (macOS 13, Windows 11, etc.)
2. **Blender version** (from Blender > About)
3. **Creator Hub version**
4. **Console logs** (full output)
5. **Steps to reproduce**
6. **Sample .blend file** (if possible)

## Success Criteria

The feature is working correctly if:
- ✅ Blender is detected automatically
- ✅ Blend file can be selected
- ✅ Export completes without errors
- ✅ Preview shows correct changes
- ✅ Transform values are accurate
- ✅ Console shows progress logs
- 🔄 Changes apply to scene (pending Inspector integration)

## Additional Resources

- [Blender CLI Documentation](https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html)
- [GLTF Export Documentation](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html)
- [Decentraland SDK Documentation](https://docs.decentraland.org/)

