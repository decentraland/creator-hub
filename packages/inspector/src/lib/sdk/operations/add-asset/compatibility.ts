import type { IEngine } from '@dcl/ecs';
import type { AssetData } from '@dcl/asset-packs';

export type IncompatibleComponent = {
  name: string;
  reason: 'missing' | 'outdated-definition';
};

export type CompatibilityResult =
  | { compatible: true }
  | { compatible: false; incompatibleComponents: IncompatibleComponent[] };

/**
 * Checks whether all components referenced in an asset's composite.json are available
 * in the current engine with the exact schema version expected.
 *
 * Two failure modes are detected:
 * - 'missing': the component name does not exist in the engine at all.
 * - 'outdated-definition': a versioned variant of the component exists (e.g. `asset-packs::Actions`)
 *   but the exact versioned name from the composite (e.g. `asset-packs::Actions-v1`) is not registered,
 *   meaning the installed SDK schema is behind what the asset requires.
 */
export function checkAssetCompatibility(
  composite: AssetData['composite'],
  engine: IEngine,
): CompatibilityResult {
  const incompatible: IncompatibleComponent[] = [];

  for (const component of composite?.components ?? []) {
    const name = component.name;
    try {
      // Attempt exact lookup of the component name as written in composite.json.
      // The versioning framework registers each versioned name individually:
      //   asset-packs::Actions       → schema v0
      //   asset-packs::Actions-v1    → schema v0+v1
      // If the engine doesn't have the exact versioned name the composite expects,
      // getComponent() throws.
      engine.getComponent(name);
    } catch {
      // Distinguish: does any variant (base name) of this component exist?
      const baseName = name.replace(/-v\d+$/, '');
      let baseExists = false;
      try {
        engine.getComponent(baseName);
        baseExists = true;
      } catch {
        // base component doesn't exist at all
      }

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
