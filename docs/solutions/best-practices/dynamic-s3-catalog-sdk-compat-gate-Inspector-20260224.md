---
module: Inspector
date: 2026-02-24
problem_type: best_practice
component: frontend_stimulus
symptoms:
  - "Asset catalog shows stale assets baked into the Creator Hub release — new packs added to asset-packs are invisible until a full Creator Hub update"
  - "Dropping a smart item whose composite.json references components not present in the scene SDK silently creates a broken/partial entity with no user feedback"
  - "Schema-mismatched components (versioned name in composite doesn't match engine registration) are silently skipped during asset drop"
root_cause: wrong_api
resolution_type: code_fix
severity: high
tags: [asset-packs, s3, catalog, sdk-compatibility, ci-cd, dynamic-fetch, component-versioning, abort-controller]
---

# Dynamic S3 Catalog + SDK Compatibility Gate for Asset Drops

## Problem

The inspector's asset catalog was a static JSON snapshot baked into the `@dcl/asset-packs` npm package at build time and imported at module load. This meant:

1. Users only saw assets from the version bundled with their installed Creator Hub — newly added asset packs were invisible until a full desktop app update.
2. Dropping a smart item whose `composite.json` referenced components unavailable in the scene's SDK (either missing entirely, or present under a different versioned schema name) silently produced a broken entity — the `add-asset` operation swallowed component errors without notifying the user.

## Environment

- Module: Inspector (`packages/inspector`)
- CI: `.github/workflows/asset-packs.yml`
- Asset source: `packages/asset-packs`
- Affected Components: `catalog.ts`, `Assets.tsx`, `useSdkContext.ts`, `Renderer.tsx`, `add-asset/index.ts`
- Date: 2026-02-24

## Symptoms

- Opening the Asset Packs tab shows asset packs from the bundled `catalog.json`, not the latest published packs.
- New assets added in `asset-packs` after a Creator Hub release do not appear in the catalog.
- Dropping a smart item that requires `asset-packs::AdminTools` (or any component not in the current engine) produces a partially-constructed entity with a console error only — no user-facing warning.
- Dropping an asset whose composite uses `asset-packs::Actions-v1` when the engine only has `asset-packs::Actions` (v0 schema) silently uses the wrong schema.

## What Didn't Work

**Attempting to solve staleness by bumping asset-packs version more frequently:**
- Why it failed: The root issue is architectural — the catalog is baked at build time. No release cadence solves the problem.

**Silent catch in `add-asset/index.ts`:**
- The existing code already had `try/catch` around component creation, logging to console only. This was a known gap but not addressed until now.

## Solution

### Part 1 — CI/CD: Publish full catalog + latest pointer on every version bump

In `.github/workflows/asset-packs.yml`, the `upload` job now:

1. Moves all AWS credential env vars to **job scope** (shared across steps).
2. Runs `make upload-asset-packs` as before (content-addressed asset files via `contents/{hash}`).
3. Publishes a **versioned catalog** (immutable, 1-year cache):
   ```yaml
   - name: publish versioned catalog to S3
     run: |
       aws s3 cp packages/asset-packs/catalog.json \
         "s3://${S3_BUCKET_NAME}/asset-packs/${{ needs.version.outputs.version }}/catalog.json" \
         --region "${S3_REGION}" \
         --content-type "application/json" \
         --cache-control "max-age=31536000, immutable"
   ```
4. Updates a **latest pointer** (no-cache):
   ```yaml
   - name: update latest catalog pointer on S3
     run: |
       aws s3 cp packages/asset-packs/catalog.json \
         "s3://${S3_BUCKET_NAME}/asset-packs/latest/catalog.json" \
         --region "${S3_REGION}" \
         --content-type "application/json" \
         --cache-control "max-age=0, must-revalidate"
   ```

Result: `{contentUrl}/asset-packs/latest/catalog.json` always reflects the most recently merged asset-packs version.

### Part 2 — Inspector: Replace static import with runtime fetch

**`packages/inspector/src/lib/logic/catalog.ts`** — replace the static import with a cached async fetch:

```typescript
// Before:
import * as _catalog from '@dcl/asset-packs/catalog.json';
export const catalog = (_catalog as unknown as Catalog).assetPacks;

// After:
const CATALOG_FETCH_TIMEOUT_MS = 10_000;
let _catalog: AssetPack[] = [];
let _fetchPromise: Promise<AssetPack[]> | null = null;

export function fetchLatestCatalog(): Promise<AssetPack[]> {
  if (_fetchPromise) return _fetchPromise;

  const config = getConfig();
  const url = `${config.contentUrl}/asset-packs/latest/catalog.json`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CATALOG_FETCH_TIMEOUT_MS);

  _fetchPromise = fetch(url, { signal: controller.signal })
    .then(async response => {
      if (!response.ok) throw new Error(`Failed to fetch catalog: ${response.status}`);
      const data: Catalog = await response.json();
      _catalog = data.assetPacks;
      return _catalog;
    })
    .finally(() => clearTimeout(timeoutId))
    .catch(err => {
      _fetchPromise = null; // allow retry on transient failure
      throw err;
    });

  return _fetchPromise;
}
```

Key design decisions:
- **Promise-level cache** (`_fetchPromise`): `Assets.tsx` and `useSdkContext.ts` both call `fetchLatestCatalog()` on mount — the cache ensures only one HTTP request is made.
- **`AbortController` timeout** (not `Promise.race`): cancels at the network level, not just the promise chain. Timer is cleared on success to avoid lingering callbacks.
- **`_catalog` module ref**: synchronous helpers `getAssetByModel` and `getAssetById` remain usable after load without requiring async callers everywhere.
- **Cache cleared on failure**: transient errors allow a retry on the next call.

**`packages/inspector/src/components/Assets/Assets.tsx`** — fetch on mount, show error to user:

```typescript
// Replace: import { catalog } from '../../lib/logic/catalog'
// With:    import { fetchLatestCatalog } from '../../lib/logic/catalog'

const [catalog, setCatalog] = useState<AssetPack[]>([]);

useEffect(() => {
  fetchLatestCatalog()
    .then(setCatalog)
    .catch(err => {
      console.error('Failed to load asset catalog:', err);
      void pushNotification('error', 'Could not load the asset catalog. Please check your connection and try again.');
    });
}, []);
```

**`packages/inspector/src/hooks/sdk/useSdkContext.ts`** — same pattern (shared promise cache):

```typescript
// Replace static catalog import with:
const [catalog, setCatalog] = useState<AssetPack[]>([]);

useEffect(() => {
  // Shares the in-flight request with Assets.tsx via promise cache
  fetchLatestCatalog()
    .then(setCatalog)
    .catch(e => console.error('Failed to load catalog for SDK context:', e));
}, []);
```

### Part 3 — SDK Compatibility Gate

**New file `packages/inspector/src/lib/sdk/operations/add-asset/compatibility.ts`**:

```typescript
export type IncompatibleComponent = {
  name: string;
  reason: 'missing' | 'outdated-definition';
};

export type CompatibilityResult =
  | { compatible: true }
  | { compatible: false; incompatibleComponents: IncompatibleComponent[] };

export function checkAssetCompatibility(
  composite: AssetData['composite'],
  engine: IEngine,
): CompatibilityResult {
  const incompatible: IncompatibleComponent[] = [];

  for (const component of composite?.components ?? []) {
    const name = component.name;
    try {
      engine.getComponent(name);
    } catch {
      const baseName = name.replace(/-v\d+$/, '');
      let baseExists = false;
      try { engine.getComponent(baseName); baseExists = true; } catch {}

      incompatible.push({
        name,
        reason: baseExists ? 'outdated-definition' : 'missing',
      });
    }
  }

  return incompatible.length === 0
    ? { compatible: true }
    : { compatible: false, incompatibleComponents: incompatible };
}
```

Two failure modes detected:
- **`missing`**: `engine.getComponent(name)` throws — component does not exist in the installed SDK at all.
- **`outdated-definition`**: exact versioned name (e.g. `asset-packs::Actions-v1`) not registered, but base name (`asset-packs::Actions`) exists — the installed SDK schema is behind what the asset requires. The component versioning framework (`packages/asset-packs/src/versioning/framework.ts`) registers names as `{baseName}` (v0) and `{baseName}-v{n}` (v1+).

**`packages/inspector/src/components/Renderer/Renderer.tsx`** — gate at the top of `importCatalogAsset()`, before any network I/O:

```typescript
const importCatalogAsset = async (asset: Asset) => {
  if (sdk) {
    const compat = checkAssetCompatibility(asset.composite, sdk.engine);
    if (!compat.compatible) {
      setIncompatibleAssetInfo({
        assetName: asset.name,
        incompatibleComponents: compat.incompatibleComponents,
      });
      return;
    }
  }
  // ... existing fetch + import logic unchanged
};
```

**New `packages/inspector/src/components/IncompatibleAssetModal/`** — follows existing `Modal` + `Button` patterns, shows asset name and a list of incompatible components with their reason label.

## Why This Works

1. **Static catalog problem**: The old `import * as _catalog from '@dcl/asset-packs/catalog.json'` resolved at webpack/vite bundle time. No matter what was on S3, the catalog in the running app was frozen at the version bundled into the release. The runtime fetch bypasses this entirely.

2. **Dual-consumer deduplication**: Both `useSdkContext` and `Assets` need the catalog at startup. The promise-level cache (`_fetchPromise`) ensures only one `fetch()` is ever dispatched regardless of how many callers invoke `fetchLatestCatalog()` concurrently.

3. **Component versioning interplay**: `framework.ts` registers each schema version as a distinct component name. A composite that was authored against `asset-packs::Actions-v1` will break silently if the engine only knows `asset-packs::Actions`. The compatibility check detects this by attempting the exact versioned name lookup and then falling back to the base name to distinguish "wrong version" from "completely absent".

4. **Abort vs. race**: `AbortController` cancels the actual HTTP request at the browser network layer. `Promise.race` against a timeout only ignores the response — the request still runs to completion and the browser holds the connection open. `AbortController` is the correct primitive for fetch timeouts.

## Prevention

- **Never bake runtime-mutable data into npm packages as static imports.** If data can change between releases of the consuming package, fetch it at runtime.
- **When adding new components to the versioning registry**, composite files must reference the exact versioned name (`asset-packs::MyComponent-v1`) — the base name alias in the registry always points to the latest, but composites authored against a specific version need to name it explicitly.
- **Before any `importCatalogAsset` path**, call `checkAssetCompatibility` synchronously. It is cheap (a loop over `engine.getComponent()` calls) and must run before network I/O so the drop can be aborted cleanly.
- **All fetch calls with no natural timeout** should use `AbortController` + `setTimeout`. Never rely on the browser's default connection timeout for UX-critical data.

## Related Issues

No related issues documented yet.
