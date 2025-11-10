import { DIRECTORY, withAssetDir } from '../../../lib/data-layer/host/fs-utils';
import type { DataLayerRpcClient } from '../../../lib/data-layer/types';
import type { AssetCatalogResponse } from '../../../tooling-entrypoint';
import { determineAssetType } from '../../ImportAsset/utils';
import type { TreeNode } from '../../ProjectAssetExplorer/ProjectView';
import type { AssetNodeItem } from '../../ProjectAssetExplorer/types';
import { isAssetNode } from '../../ProjectAssetExplorer/utils';
import type { ScriptLayout } from './types';

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

export const isScriptFile = (value: string): boolean => value.endsWith('.ts');
export const isScriptNode = (node: TreeNode): node is AssetNodeItem =>
  isAssetNode(node) && isScriptFile(node.name);

export function buildScriptPath(name: string): string {
  const scriptName = name.endsWith('.ts') ? name : `${name}.ts`;
  const scriptsDir = withAssetDir(`${DIRECTORY.SCENE}/${determineAssetType('ts')}`);
  const scriptPath = `${scriptsDir}/${scriptName}`;
  return scriptPath;
}

export function isScriptNameAvailable({ assets }: AssetCatalogResponse, src: string): boolean {
  if (!src) return true;
  const newScriptPath = buildScriptPath(src);
  return !assets.find($ => newScriptPath === $.path);
}

export async function readScript(
  dataLayer: DataLayerRpcClient,
  scriptPath: string,
): Promise<string | undefined> {
  try {
    const { data } = await dataLayer.getAssetData({ path: scriptPath });
    const content = new TextDecoder().decode(data);
    return content;
  } catch (error) {
    console.warn('Failed to read script:', scriptPath, error);
    return undefined;
  }
}
