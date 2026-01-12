import { DIRECTORY, withAssetDir } from '../../../lib/data-layer/host/fs-utils';
import type { DataLayerRpcClient } from '../../../lib/data-layer/types';
import type { AssetCatalogResponse } from '../../../tooling-entrypoint';
import { determineAssetType } from '../../ImportAsset/utils';
import type { TreeNode } from '../../ProjectAssetExplorer/ProjectView';
import type { AssetNodeItem } from '../../ProjectAssetExplorer/types';
import { isAssetNode } from '../../ProjectAssetExplorer/utils';
import type { ScriptItem, ScriptLayout } from './types';

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
  const scriptsDir = withAssetDir(`${DIRECTORY.SCENE}/${determineAssetType('ts')}`);
  if (name.startsWith(scriptsDir)) return name; // if it's already a built path, return the name parameter
  const scriptName = isScriptFile(name) ? name : `${name}.ts`;
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

export function mergeLayout(source: ScriptLayout, target: ScriptLayout): ScriptLayout {
  const layout: ScriptLayout = { params: {}, actions: [] };

  for (const [name, value] of Object.entries(source.params)) {
    const targetParam = target.params[name];
    if (!targetParam || value.type !== targetParam.type) {
      layout.params[name] = value; // keep source if param not in target or if param types are different
    } else {
      layout.params[name] = { ...value, ...targetParam };
    }
  }

  layout.actions = source.actions;
  layout.error = source.error;

  return layout;
}
