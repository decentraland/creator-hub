import { withAssetDir } from '../../../lib/data-layer/host/fs-utils';
import type { DataLayerRpcClient } from '../../../lib/data-layer/types';
import type { AssetCatalogResponse } from '../../../tooling-entrypoint';
import { determineAssetType } from '../../ImportAsset/utils';
import type { TreeNode } from '../../ProjectAssetExplorer/ProjectView';
import type { AssetNodeItem } from '../../ProjectAssetExplorer/types';
import { isAssetNode } from '../../ProjectAssetExplorer/utils';
import type { ScriptItem, ScriptLayout, ScriptParamUnion } from './types';

export function fromNumber(value: number): string {
  return value.toString();
}

export function toNumber(value: string): number {
  return parseFloat(value) || 0;
}

export function isValidNumber(value: string): boolean {
  return !isNaN(parseFloat(value));
}

export function isValidPath(value: string): boolean {
  return value.length > 0 && value.trim().length > 0;
}

export function parseLayout(layout?: string): ScriptLayout | undefined {
  if (!layout) return undefined;
  try {
    return JSON.parse(layout);
  } catch (error) {
    console.warn('Failed to parse script layout:', error);
    return undefined;
  }
}

export const isScriptFile = (value: string): boolean =>
  value.endsWith('.ts') || value.endsWith('.tsx');
export const isScriptNode = (node: TreeNode): node is AssetNodeItem =>
  isAssetNode(node) && isScriptFile(node.name);

export function buildScriptPath(name: string): string {
  const scriptsDir = withAssetDir(determineAssetType('ts'));
  if (name.startsWith(scriptsDir)) return name; // if it's already a built path, return the name parameter
  const scriptName = isScriptFile(name) ? name : `${name}.tsx`;
  const scriptPath = `${scriptsDir}/${scriptName}`;
  return scriptPath;
}

export function isScriptNameAvailable({ assets }: AssetCatalogResponse, src: string): boolean {
  if (!src) return true;
  return !assets.find($ => src === $.path.toLowerCase());
}

export function isScriptAlreadyAdded(scripts: ScriptItem[], src: string): boolean {
  if (!src) return false;
  return scripts.some(script => script.path === src);
}

export async function readScript(
  dataLayer: DataLayerRpcClient,
  scriptPath: string,
): Promise<string> {
  const { data } = await dataLayer.getAssetData({ path: scriptPath });
  const content = new TextDecoder().decode(data);
  return content;
}

// Reconciles a stored value against a freshly-parsed param shape: the structure/defaults
// come from `sourceParam` (current script source), the data from `storedValue` (the user's
// edits). For containers it recurses — keeping stored keys/elements that still exist,
// dropping removed keys, adding new keys with the source default. Leaf values are kept if
// present, with enum/slider validated against the fresh options/range.
function reconcileValue(sourceParam: ScriptParamUnion, storedValue: unknown): unknown {
  switch (sourceParam.type) {
    case 'object': {
      const stored =
        storedValue && typeof storedValue === 'object' && !Array.isArray(storedValue)
          ? (storedValue as Record<string, unknown>)
          : {};
      const result: Record<string, unknown> = {};
      for (const [key, fieldParam] of Object.entries(sourceParam.fields)) {
        result[key] = key in stored ? reconcileValue(fieldParam, stored[key]) : fieldParam.value;
      }
      return result;
    }
    case 'array':
      if (!Array.isArray(storedValue)) return sourceParam.value;
      return storedValue.map(element => reconcileValue(sourceParam.item, element));
    case 'enum':
      return typeof storedValue === 'string' && sourceParam.options.includes(storedValue)
        ? storedValue
        : sourceParam.value;
    case 'slider': {
      const n = typeof storedValue === 'number' ? storedValue : sourceParam.value;
      return Math.min(Math.max(n, sourceParam.min), sourceParam.max);
    }
    default:
      return storedValue !== undefined ? storedValue : sourceParam.value;
  }
}

export function mergeLayout(source: ScriptLayout, target: ScriptLayout): ScriptLayout {
  const layout: ScriptLayout = { params: {}, actions: [] };

  for (const [name, value] of Object.entries(source.params)) {
    const targetParam = target.params[name];
    if (!targetParam || value.type !== targetParam.type) {
      layout.params[name] = value; // keep source if param not in target or if param types are different
    } else if (value.type === 'object' && targetParam.type === 'object') {
      // fresh `fields`/defaults from source; stored values reconciled key-by-key
      layout.params[name] = {
        ...value,
        value: reconcileValue(value, targetParam.value) as Record<string, unknown>,
      };
    } else if (value.type === 'array' && targetParam.type === 'array') {
      // fresh `item` shape from source; stored rows reconciled element-by-element
      layout.params[name] = {
        ...value,
        value: reconcileValue(value, targetParam.value) as unknown[],
      };
    } else if (value.type === 'slider' && targetParam.type === 'slider') {
      // min/max/step always come from the fresh parse; keep the stored value clamped to the new range
      const storedValue = typeof targetParam.value === 'number' ? targetParam.value : value.value;
      layout.params[name] = {
        ...value,
        value: Math.min(Math.max(storedValue, value.min), value.max),
      };
    } else if (value.type === 'enum' && targetParam.type === 'enum') {
      // options always come from the fresh parse; keep the stored choice only if still valid
      const storedValue =
        typeof targetParam.value === 'string' && value.options.includes(targetParam.value)
          ? targetParam.value
          : value.value;
      layout.params[name] = { ...value, value: storedValue };
    } else {
      layout.params[name] = { ...value, ...targetParam };
    }
  }

  layout.actions = source.actions;
  layout.events = source.events;
  layout.error = source.error;

  return layout;
}
