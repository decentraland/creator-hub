/**
 * Compose multiple `Composite.Provider` instances into a single provider.
 *
 * Semantics:
 *   - `schemas`: concatenated in input order. We materialise as an array at
 *     construction time so the resulting iterable is safe to iterate more
 *     than once (callers — including `setCompositeProvider` — only iterate
 *     it once today, but future iteration is cheap to support).
 *   - `getCompositeOrNull`: first non-null wins.
 *   - `loadComposite`: tried in order; on a load failure for one provider we
 *     fall through to the next provider that can `loadComposite`. Throws
 *     only if no provider can load `src`.
 */

import type { Composite } from '@dcl/ecs';

type ProviderSchema = { name: string; jsonSchema: unknown };

export function composeProviders(providers: Composite.Provider[]): Composite.Provider {
  const schemas: ProviderSchema[] = [];
  for (const p of providers) {
    if (p.schemas) {
      for (const s of p.schemas as Iterable<ProviderSchema>) schemas.push(s);
    }
  }
  return {
    schemas: schemas as Composite.Provider['schemas'],
    getCompositeOrNull(src: string) {
      for (const p of providers) {
        const r = p.getCompositeOrNull(src);
        if (r) return r;
      }
      return null;
    },
    async loadComposite(src: string) {
      for (const p of providers) {
        if (!p.loadComposite) continue;
        try {
          const r = await p.loadComposite(src);
          if (r) return r;
        } catch {
          // try next
        }
      }
      throw new Error(`No provider could load "${src}"`);
    },
  };
}
