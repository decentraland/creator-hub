# Fix CLI Multi-Scene Deploy Behavior

**Issue**: [#1225](https://github.com/decentraland/creator-hub/issues/1225)  
**Created**: 2026-03-16  
**Status**: Planning

## Problem

When publishing a scene to a world via CLI, the deployment always behaves as if "Multi Scene World" mode is enabled. This differs from the Creator Hub GUI default behavior, where scenes are replaced (single-scene mode) unless the "Multi Scene World" checkbox is explicitly checked.

### Current Behavior

- **GUI (Creator Hub)**: Default is single-scene mode → existing scenes in different coords are removed
- **CLI**: Always behaves as multi-scene mode → scenes accumulate, spawn position can't be controlled

### Expected Behavior

1. **Default (`npm run deploy`)**: Replace existing scenes (match GUI default)
2. **With flag (`npm run deploy --multi-scene`)**: Keep all non-overlapping scenes

## Root Cause Analysis

The Creator Hub UI handles multi-scene vs single-scene deployment through the `deploymentMetadata.isMultiScene` parameter:

1. **In `PublishToWorld` component** (`packages/creator-hub/renderer/src/components/Modals/PublishProject/steps/PublishToWorld/component.tsx`):
   - Has a "Multi Scene World" checkbox (defaults to `false` for new worlds)
   - Passes `deploymentMetadata: { isMultiScene: isMultiSceneEnabled }` to the Deploy step

2. **In `Deploy` component** (`packages/creator-hub/renderer/src/components/Modals/PublishProject/steps/Deploy/component.tsx`):
   - Calculates `needsUndeploy = isWorld && deploymentMetadata?.isMultiScene === false && worldScenes.length > 0`
   - If `needsUndeploy` is true, calls `managementActions.unpublishEntireWorld()` before deploying
   - This ensures existing scenes are removed in single-scene mode

3. **The CLI path** (`packages/creator-hub/main/src/modules/cli.ts`):
   - Does NOT receive or handle the `isMultiScene` parameter
   - No logic to unpublish existing scenes
   - Always behaves as multi-scene mode

## Solution Design

### 1. Update TypeScript Types

**File**: `packages/creator-hub/shared/types/deploy.ts`

Add `isMultiScene` parameter to `DeployOptions`:

```typescript
export type DeployOptions = {
  path: string;
  target?: string;
  targetContent?: string;
  language?: Locale;
  chainId: ChainId;
  wallet: string;
  isMultiScene?: boolean;  // NEW: defaults to false (single-scene mode)
};
```

### 2. Update CLI Deploy Function

**File**: `packages/creator-hub/main/src/modules/cli.ts`

The `deploy()` function needs to:

1. Accept `isMultiScene` from `DeployOptions` (default: `false`)
2. Before deploying, check if we need to unpublish existing scenes
3. If `isMultiScene === false` and there are existing scenes, unpublish the world first

**Implementation**:

```typescript
export async function deploy({
  path,
  target,
  targetContent,
  language,
  chainId,
  wallet,
  isMultiScene = false,  // NEW: default to single-scene mode
}: DeployOptions): Promise<number> {
  if (deployServer) {
    await deployServer.stop();
  }

  // NEW: Handle single-scene mode
  if (!isMultiScene && target && wallet) {
    try {
      // Extract world name from target (format: worlds-content-server with worldName in project config)
      // This logic may need adjustment based on how the world name is determined
      const needsUndeploy = await checkIfNeedsUndeploy(path, target);
      if (needsUndeploy) {
        log.info('[CLI] Single-scene mode: unpublishing existing world content');
        // Call the management API to unpublish entire world
        // Note: This requires importing/accessing the management module
        await unpublishWorld(worldName, wallet);
        log.info('[CLI] World content unpublished successfully');
      }
    } catch (error) {
      log.error('[CLI] Error during world unpublish:', error);
      throw error;
    }
  }

  const isLegacyDeploy = await shouldRunLegacyDeploy(path);
  if (isLegacyDeploy) {
    log.info('[CLI] Running legacy deploy');
    return legacyDeploy({ path, target, targetContent, chainId, wallet });
  }

  const port = await getAvailablePort();

  const { stop } = await runCommand(path, 'deploy', [
    '--dir',
    path,
    '--no-browser',
    '--port',
    port.toString(),
    ...(target ? ['--target', target] : []),
    ...(targetContent ? ['--target-content', targetContent] : []),
    '--programmatic',
    ...(language ? ['--language', language] : []),
  ]);

  deployServer = { stop };

  return port;
}
```

### 3. Update IPC Type Definitions

**File**: `packages/creator-hub/preload/src/modules/editor.ts`

Ensure the preload types match the updated `DeployOptions`:

```typescript
publishScene: (opts: {
  path: string;
  target?: string;
  targetContent?: string;
  chainId: ChainId;
  wallet: string;
  language?: Locale;
  isMultiScene?: boolean;  // NEW
}) => Promise<number>;
```

### 4. Update Deploy Component to Pass isMultiScene

**File**: `packages/creator-hub/renderer/src/hooks/useEditor.ts`

Update the `publishScene` call to include `isMultiScene`:

```typescript
publishScene: async (opts: {
  target?: string;
  targetContent?: string;
  chainId?: ChainId;
  isMultiScene?: boolean;  // NEW
}) => {
  // ... existing code ...
  
  const port = await editor.publishScene({
    path,
    target: opts.target,
    targetContent: opts.targetContent,
    chainId: opts.chainId || chainId,
    wallet,
    language: translation.locale,
    isMultiScene: opts.isMultiScene,  // NEW: pass through
  });
  
  // ... rest of existing code ...
}
```

### 5. Update Deploy Step to Use isMultiScene

**File**: `packages/creator-hub/renderer/src/components/Modals/PublishProject/steps/Deploy/component.tsx`

Instead of handling `needsUndeploy` in the Deploy component, pass `isMultiScene` to the deploy call:

```typescript
const handlePublish = useCallback(async () => {
  setShowWarning(false);
  updateProjectInfo(project.path, { skipPublishWarning: skipWarning });

  // Remove the old needsUndeploy logic - let the CLI handle it
  executeDeployment(project.path);
}, [skipWarning, project, executeDeployment, updateProjectInfo]);
```

But wait - we need to ensure `executeDeployment` has access to `isMultiScene`. This may require passing it through the deployment state.

### 6. Handle CLI Flag Parsing (Future Enhancement)

For direct CLI usage (if creator-hub exposes a CLI), parse the `--multi-scene` flag:

```typescript
// Pseudo-code for CLI argument parsing
const args = parseArgs(process.argv);
const isMultiScene = args.includes('--multi-scene');
```

## Testing Plan

### Unit Tests

1. **Test `DeployOptions` type** - ensure `isMultiScene` is optional and defaults to `false`
2. **Test `cli.deploy()` function**:
   - When `isMultiScene === false`, verify unpublish is called
   - When `isMultiScene === true`, verify unpublish is NOT called
   - When no existing scenes, verify unpublish is NOT called

### Manual Testing

1. **Test GUI default behavior**:
   - Create a world with Scene A at coords 0,0
   - Deploy Scene B to the same world at coords 10,10 (Multi Scene World unchecked)
   - Verify: Scene A is removed, only Scene B exists
   
2. **Test GUI multi-scene behavior**:
   - Create a world with Scene A at coords 0,0
   - Deploy Scene B to the same world at coords 10,10 (Multi Scene World checked)
   - Verify: Both Scene A and Scene B exist
   
3. **Test warning messages**:
   - Verify the warning message appears when deploying in single-scene mode
   - Verify the warning mentions existing content will be replaced

## Edge Cases & Considerations

1. **World name resolution**: How do we determine the world name from the deployment target?
   - The world name is in `project.worldConfiguration?.name`
   - Need to pass this through or derive it from context

2. **Permission handling**: Ensure the wallet has permission to unpublish before attempting
   - Check world ownership or deployment permissions

3. **Error handling**: If unpublish fails, should we abort the deployment?
   - Yes - failing to unpublish in single-scene mode means the deployment won't match expectations

4. **Race conditions**: If multiple deployments happen simultaneously
   - The current code already handles this via `deployServer` singleton

5. **Legacy deploy**: Does the legacy deploy path need the same fix?
   - Yes - include the same logic in `legacyDeploy()`

## Files to Modify

1. ✅ `packages/creator-hub/shared/types/deploy.ts` - Add `isMultiScene` to `DeployOptions`
2. ✅ `packages/creator-hub/main/src/modules/cli.ts` - Implement unpublish logic in `deploy()`
3. ✅ `packages/creator-hub/preload/src/modules/editor.ts` - Update type definitions
4. ✅ `packages/creator-hub/renderer/src/hooks/useEditor.ts` - Pass `isMultiScene` through
5. ✅ `packages/creator-hub/renderer/src/components/Modals/PublishProject/steps/Deploy/component.tsx` - Simplify by delegating unpublish to CLI layer
6. ✅ `packages/creator-hub/renderer/src/components/Modals/PublishProject/steps/PublishToWorld/component.tsx` - Pass `isMultiScene` to deploy

## Implementation Order

1. Update types in `shared/types/deploy.ts`
2. Implement unpublish logic in `cli.ts`
3. Update preload types
4. Update renderer hooks to pass parameter
5. Update UI components to use new parameter
6. Add tests
7. Manual testing

## Risks & Mitigations

**Risk**: Breaking existing deployments
- **Mitigation**: Default `isMultiScene` to `false` matches the documented expected behavior
- **Mitigation**: Comprehensive testing before release

**Risk**: Unpublish API may not be accessible from CLI layer
- **Mitigation**: Investigate management module API, may need to refactor

**Risk**: Performance impact of checking existing scenes before every deployment
- **Mitigation**: Only check when deploying to a world, skip for land deployments

## Success Criteria

✅ CLI deploy default behavior matches GUI default behavior (single-scene mode)  
✅ `--multi-scene` flag enables multi-scene mode  
✅ Warning message displayed in CLI when existing content will be replaced  
✅ All existing tests pass  
✅ New tests cover the multi-scene logic  
✅ Documentation updated to reflect the new flag

---

**Next Steps**: Begin implementation, starting with type updates.
