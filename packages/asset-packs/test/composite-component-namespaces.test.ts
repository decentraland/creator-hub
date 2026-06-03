import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'glob';

/**
 * Coverage guard for runtime composite spawning.
 *
 * Spawning a `composite.json` at runtime requires every component it references
 * to be handled, and composites can't self-describe (almost none carry a
 * `jsonSchema`). So every component name must fall into one of:
 *
 *   - `core::` / `core-schema::`  → registered by the SDK
 *   - `asset-packs::`             → registered by `createComponents(engine)` at init
 *   - `inspector::`               → editor-only; stripped before instancing
 *                                   (see `stripComponents` in add-child.ts)
 *
 * A component in any other namespace would be neither registered nor stripped,
 * so `Composite.instance` would throw at runtime in a user's scene. This test
 * fails the build instead, forcing a decision: register it or strip it.
 */
const REGISTERED_PREFIXES = ['core::', 'core-schema::', 'asset-packs::'];
const STRIPPED_PREFIXES = ['inspector::'];
const KNOWN_PREFIXES = [...REGISTERED_PREFIXES, ...STRIPPED_PREFIXES];

const packsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'packs');

describe('catalog composite component coverage', () => {
  it('every component in a shipped composite.json uses a known namespace', () => {
    const files = globSync('**/composite.json', { cwd: packsDir, absolute: true });
    expect(files.length).toBeGreaterThan(0);

    const offenders: Record<string, number> = {};
    for (const file of files) {
      let json: { components?: Array<{ name?: string }> };
      try {
        json = JSON.parse(readFileSync(file, 'utf8'));
      } catch {
        continue; // not every composite.json in the tree is valid JSON; skip
      }
      for (const component of json.components ?? []) {
        const name = component?.name ?? '';
        if (!KNOWN_PREFIXES.some(prefix => name.startsWith(prefix))) {
          offenders[name] = (offenders[name] ?? 0) + 1;
        }
      }
    }

    const summary = Object.entries(offenders)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `${name} (${count} files)`);

    expect(
      summary,
      `Unknown component namespace(s) found in shipped composites. Either register ` +
        `the component pre-seal (add it to VERSIONS_REGISTRY) or strip it at spawn ` +
        `time (add its prefix to COMPONENTS_PREFIXES in add-child.ts):\n` +
        summary.join('\n'),
    ).toEqual([]);
  });
});
