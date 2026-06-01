/**
 * Asset-pack `Composite.Provider`. Replaces the old
 * `createComponents(engine)` side-effect + `installAssetPackCompositeProvider`
 * deferred installer.
 *
 * Two responsibilities:
 *
 *   1. `schemas` — declares every asset-pack component (and every legacy
 *      versioned alias) so the engine can register them at
 *      `setCompositeProvider` time, before the engine is sealed.
 *
 *   2. `getCompositeOrNull` / `loadComposite` — the asset-pack provider does
 *      not bundle composite JSON itself today (asset-packs ship as on-disk
 *      asset directories resolved by the SDK provider). Returns `null` so the
 *      compose chain falls through to the SDK provider. When asset-packs do
 *      ship bundled composites in the future, the `{assetPath}` substitution
 *      pass (see `wrapWithAssetPathSubstitution` below) is the canonical
 *      place to apply it.
 */

import type { Composite } from '@dcl/ecs';
import { VERSIONS_REGISTRY } from './versioning/registry';
import { substituteAssetPathInComposite } from './add-child';

type ProviderSchema = { name: string; jsonSchema: unknown };

/**
 * Build the `schemas` iterable from the versioned component registry. Yields
 * every version of every asset-pack component (latest plus legacy aliases) so
 * loading older composites does not break.
 *
 * Each registry entry's `component` is a `Record<string, ISchema>`. The
 * engine's `defineComponentFromSchema` expects an `ISchema<T>`, so the
 * provider hands the engine the matching `jsonSchema` descriptor built from
 * the spec — the engine reconstructs the ISchema via `Schemas.fromJson`.
 */
function buildAssetPackSchemas(): ProviderSchema[] {
  const schemas: ProviderSchema[] = [];
  for (const versions of Object.values(VERSIONS_REGISTRY)) {
    for (const v of versions) {
      const properties: Record<string, unknown> = {};
      for (const [key, schema] of Object.entries(v.component)) {
        properties[key] = (schema as { jsonSchema: unknown }).jsonSchema;
      }
      schemas.push({
        name: v.versionName,
        jsonSchema: {
          serializationType: 'map',
          properties,
        },
      });
    }
  }
  return schemas;
}

export const assetPackProvider: Composite.Provider = {
  schemas: buildAssetPackSchemas() as Composite.Provider['schemas'],
  // Asset-packs don't bundle composites today; the SDK provider serves them.
  // Returning `null` lets `composeProviders` fall through to the SDK provider.
  // When asset-packs do ship bundled composites, this is where the
  // `{assetPath}` substitution pass should be applied — see
  // `wrapWithAssetPathSubstitution` for the existing implementation.
  getCompositeOrNull() {
    return null;
  },
};

/**
 * Wrap a base `Composite.Provider` so every composite it returns has its
 * `{assetPath}` placeholders resolved in place before being handed to the
 * engine. Required because asset-pack composite JSON files on disk store
 * texture / GLB / audio paths as `{assetPath}/relative/path.ext` so they're
 * portable across asset-dir layouts — the engine sees the resolved paths.
 *
 * Mutates the cached resource in place: the base provider keeps a single
 * resource by reference and we mutate it on first resolution. Substitution is
 * idempotent, so a re-resolution after a second `getCompositeOrNull(src)` is
 * a no-op.
 */
export function wrapWithAssetPathSubstitution(base: Composite.Provider): Composite.Provider {
  return {
    schemas: base.schemas,
    getCompositeOrNull(src: string) {
      const resource = base.getCompositeOrNull(src);
      if (resource) substituteAssetPathInComposite(resource.composite, src);
      return resource;
    },
    loadComposite: base.loadComposite
      ? async (src: string) => {
          const resource = await base.loadComposite!(src);
          substituteAssetPathInComposite(resource.composite, src);
          return resource;
        }
      : undefined,
  };
}
