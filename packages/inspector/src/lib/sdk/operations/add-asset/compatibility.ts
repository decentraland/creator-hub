import type { IEngine } from '@dcl/ecs';
import type { AssetData } from '@dcl/asset-packs';
import { findUnsupportedParams, parseLayout } from '../../script-params';

export type IncompatibleComponent = {
  name: string;
  reason: 'missing' | 'outdated-definition' | 'unsupported-script-param';
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

  incompatible.push(...findUnsupportedScriptParams(composite));

  return incompatible.length === 0
    ? { compatible: true }
    : { compatible: false, incompatibleComponents: incompatible };
}

const SCRIPT_COMPONENT = /^asset-packs::Script(-v\d+)?$/;

/** Script params in the composite whose type this editor can't render. */
function findUnsupportedScriptParams(composite: AssetData['composite']): IncompatibleComponent[] {
  const result: IncompatibleComponent[] = [];
  try {
    for (const component of composite?.components ?? []) {
      if (!SCRIPT_COMPONENT.test(component.name)) continue;
      for (const entry of Object.values(component.data ?? {})) {
        const scripts = entry?.json?.value;
        for (const script of Array.isArray(scripts) ? scripts : []) {
          const layout =
            typeof script?.layout === 'string' ? parseLayout(script.layout) : undefined;
          if (!layout) continue;
          const file = String(script.path ?? '')
            .split('/')
            .pop();
          for (const param of findUnsupportedParams(layout)) {
            result.push({ name: `${file}: ${param}`, reason: 'unsupported-script-param' });
          }
        }
      }
    }
  } catch (error) {
    console.warn('Failed to read the script params of an asset:', error);
    return [];
  }
  return result;
}
