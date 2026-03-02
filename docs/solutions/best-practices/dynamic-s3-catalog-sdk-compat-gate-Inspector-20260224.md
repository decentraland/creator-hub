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

### Part 1 — upload.ts: Publish versioned + latest catalog after asset upload

`packages/asset-packs/scripts/upload.ts` now owns all three catalog upload responsibilities, replacing the previous separate `aws s3 cp` steps in CI:

```typescript
import { version } from '../package.json';

// After all asset pack files are uploaded...

// 1. Versioned copy — immutable, long-cached
const versionedUpload = new Upload({
  client,
  params: {
    Bucket: bucketName,
    Key: `asset-packs/${version}/catalog.json`,
    Body: catalogContent,
    ContentType: 'application/json',
    CacheControl: 'max-age=31536000, immutable',
  },
});
await versionedUpload.done();

// 2. Latest pointer — always fresh
const latestUpload = new Upload({
  client,
  params: {
    Bucket: bucketName,
    Key: 'asset-packs/latest/catalog.json',
    Body: catalogContent,
    ContentType: 'application/json',
    CacheControl: 'max-age=0, must-revalidate',
  },
});
await latestUpload.done();
```

This runs in both CI (`make upload-asset-packs` in `.github/workflows/asset-packs.yml`) and local Docker dev (`npm run upload` against MinIO), so both environments are consistent. `tsconfig.scripts.json` requires `resolveJsonModule: true` for the `package.json` import.

Result: `{contentUrl}/asset-packs/latest/catalog.json` always reflects the most recently uploaded asset-packs version, and `{contentUrl}/asset-packs/{version}/catalog.json` provides an immutable pinned copy.

### Part 2 — Inspector: Replace static import with runtime fetch

**`packages/inspector/src/lib/logic/catalog.ts`** — replace the static import with a cached async fetch with bundled fallback:

```typescript
// Before:
import * as _catalog from '@dcl/asset-packs/catalog.json';
export const catalog = (_catalog as unknown as Catalog).assetPacks;

// After:
import * as _bundledCatalog from '@dcl/asset-packs/catalog.json';

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
      // Fall back to the bundled catalog — covers pre-merge PRs, offline envs, CI without contentUrl.
      // _fetchPromise is NOT reset: the fallback is a valid result, not a transient error.
      console.warn('Failed to fetch latest catalog, falling back to bundled version:', err);
      _catalog = (_bundledCatalog as unknown as Catalog).assetPacks;
      return _catalog;
    });

  return _fetchPromise;
}
```

Key design decisions:
- **Bundled fallback** (`@dcl/asset-packs/catalog.json`): if the CDN fetch fails for any reason (pre-merge PR where `latest/catalog.json` doesn't exist yet, offline, timeout), the app falls back to the catalog bundled in the npm package and always resolves. `_fetchPromise` is kept set because the fallback is a valid terminal result — no retry needed.
- **Promise-level cache** (`_fetchPromise`): `Assets.tsx` and `useSdkContext.ts` both call `fetchLatestCatalog()` on mount — the cache ensures only one HTTP request is made.
- **`AbortController` timeout** (not `Promise.race`): cancels at the network level, not just the promise chain. Timer is cleared on success to avoid lingering callbacks.
- **`_catalog` module ref**: synchronous helpers `getAssetByModel` and `getAssetById` remain usable after load without requiring async callers everywhere.

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

2. **Bundled fallback always resolves**: Pre-merge PRs, offline environments, and e2e CI runs (no `contentUrl` override) all hit a 404 or network error on `latest/catalog.json`. Without the fallback, `fetchLatestCatalog()` rejects, `useSdkContext` never gets a catalog, `.App.is-ready` never appears, and e2e tests time out. The fallback ensures the promise always resolves with a usable catalog.

3. **`_fetchPromise` not reset on fallback**: Unlike a transient network error, the fallback is a valid terminal result. Resetting `_fetchPromise = null` on fallback would allow a second caller to dispatch a redundant fetch that would also fail and fall back — wasting a round-trip. Keeping `_fetchPromise` set means all callers share the same resolved value.

4. **Dual-consumer deduplication**: Both `useSdkContext` and `Assets` need the catalog at startup. The promise-level cache (`_fetchPromise`) ensures only one `fetch()` is ever dispatched regardless of how many callers invoke `fetchLatestCatalog()` concurrently.

5. **Single source of truth for catalog upload**: `upload.ts` now owns both the versioned and latest catalog uploads. The CI workflow (`asset-packs.yml`) no longer has separate `aws s3 cp` steps — `make upload-asset-packs` handles everything. Local Docker dev and CI are consistent.

6. **Component versioning interplay**: `framework.ts` registers each schema version as a distinct component name. A composite that was authored against `asset-packs::Actions-v1` will break silently if the engine only knows `asset-packs::Actions`. The compatibility check detects this by attempting the exact versioned name lookup and then falling back to the base name to distinguish "wrong version" from "completely absent".

7. **Abort vs. race**: `AbortController` cancels the actual HTTP request at the browser network layer. `Promise.race` against a timeout only ignores the response — the request still runs to completion and the browser holds the connection open. `AbortController` is the correct primitive for fetch timeouts.

## Prevention

- **Never bake runtime-mutable data into npm packages as static imports.** If data can change between releases of the consuming package, fetch it at runtime.
- **Always provide a bundled fallback for runtime-fetched data.** Pre-merge PRs and CI runs won't have the latest CDN data. The bundled copy in the npm package is the natural fallback — it's always available and keeps the app functional.
- **Keep `_fetchPromise` set after a fallback.** A fallback is a terminal result, not a transient failure. Resetting the promise cache on fallback causes redundant fetches from all concurrent callers.
- **Consolidate upload logic into `upload.ts`, not CI YAML.** Running `make upload-asset-packs` locally and in CI should produce identical S3 state. Splitting catalog uploads into separate CI steps creates drift between local and CI environments.
- **When adding new components to the versioning registry**, composite files must reference the exact versioned name (`asset-packs::MyComponent-v1`) — the base name alias in the registry always points to the latest, but composites authored against a specific version need to name it explicitly.
- **Before any `importCatalogAsset` path**, call `checkAssetCompatibility` synchronously. It is cheap (a loop over `engine.getComponent()` calls) and must run before network I/O so the drop can be aborted cleanly.
- **All fetch calls with no natural timeout** should use `AbortController` + `setTimeout`. Never rely on the browser's default connection timeout for UX-critical data.

## Related Issues

No related issues documented yet.
