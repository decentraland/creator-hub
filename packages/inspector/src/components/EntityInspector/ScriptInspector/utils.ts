import ts from 'typescript';
import { DIRECTORY, withAssetDir } from '../../../lib/data-layer/host/fs-utils';
import type { ScriptItem } from '../../../lib/sdk/components';
import type { DataLayerRpcClient } from '../../../lib/data-layer/types';
import type { AssetCatalogResponse } from '../../../tooling-entrypoint';
import { determineAssetType } from '../../ImportAsset/utils';
import type { TreeNode } from '../../ProjectAssetExplorer/ProjectView';
import type { AssetNodeItem } from '../../ProjectAssetExplorer/types';
import { isAssetNode } from '../../ProjectAssetExplorer/utils';
import type { ScriptLayout, ScriptParamUnion } from './types';

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

export function parseLayout(layout?: string): ScriptLayout | null {
  if (!layout) return null;
  try {
    return JSON.parse(layout);
  } catch (error) {
    console.warn('Failed to parse script layout:', error);
    return null;
  }
}

export function createDefaultScript(): ScriptItem {
  return {
    path: '',
    priority: 0,
    layout: undefined,
  };
}

export const isScriptFile = (value: string): boolean => value.endsWith('.ts');
export const isScriptNode = (node: TreeNode): node is AssetNodeItem =>
  isAssetNode(node) && isScriptFile(node.name);

export function getScriptsDirectory(): string {
  const scriptsDir = determineAssetType('ts');
  return withAssetDir(`${DIRECTORY.SCENE}/${scriptsDir}`);
}

export function buildScriptPath(name: string): string {
  const scriptName = name.endsWith('.ts') ? name : `${name}.ts`;
  const scriptPath = `${getScriptsDirectory()}/${scriptName}`;
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

export function discriminateScriptParamType(type: string): ScriptParamUnion['type'] {
  const cleanType = type.replace(/\s*\|\s*undefined/g, '').trim();

  if (cleanType === 'number') return 'number';
  if (cleanType === 'boolean') return 'boolean';

  return 'string';
}

export function getScriptParams(content: string): Record<string, Omit<ScriptParamUnion, 'value'>> {
  const sourceFile = ts.createSourceFile(
    'tmp.ts',
    content,
    ts.ScriptTarget.ES2020,
    true,
    ts.ScriptKind.TS,
  );
  const params: Record<string, Omit<ScriptParamUnion, 'value'>> = {};

  sourceFile.forEachChild(node => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'main') {
      // skip first parameter (Entity) and only process configurable parameters
      node.parameters.slice(1).forEach(param => {
        if (!ts.isIdentifier(param.name)) return;

        const name = param.name.text;
        const typeText = param.type ? param.type.getText(sourceFile) : 'string';
        const type = discriminateScriptParamType(typeText);
        const isOptional = !!(param.questionToken || param.initializer);

        params[name] = { type, optional: isOptional };
      });
    }
  });

  return params;
}
