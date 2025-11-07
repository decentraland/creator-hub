import { parse } from '@babel/parser';
import type { Identifier, TSTypeAnnotation, Expression } from '@babel/types';
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

function getBabelType(
  typeAnnotation: TSTypeAnnotation['typeAnnotation'],
): ScriptParamUnion['type'] {
  if (!typeAnnotation) return 'string';

  if (typeAnnotation.type === 'TSNumberKeyword') {
    return 'number';
  }

  if (typeAnnotation.type === 'TSBooleanKeyword') {
    return 'boolean';
  }

  if (typeAnnotation.type === 'TSStringKeyword') {
    return 'string';
  }

  // handle union types (e.g., string | undefined)
  if (typeAnnotation.type === 'TSUnionType') {
    // TODO: what do we do with union types? for now, we'll return the first non-undefined type
    for (const subType of typeAnnotation.types) {
      if (subType.type !== 'TSUndefinedKeyword') {
        return getBabelType(subType);
      }
    }
  }

  return 'string';
}

function inferTypeFromDefault(
  defaultValue: Expression | null | undefined,
): ScriptParamUnion['type'] {
  if (!defaultValue) return 'string';
  if (defaultValue.type === 'NumericLiteral') {
    return 'number';
  }
  if (defaultValue.type === 'BooleanLiteral') {
    return 'boolean';
  }
  return 'string';
}

export function getScriptParams(content: string): Record<string, Omit<ScriptParamUnion, 'value'>> {
  const params: Record<string, Omit<ScriptParamUnion, 'value'>> = {};

  try {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['typescript'],
    });

    for (const statement of ast.program.body) {
      if (
        statement.type === 'ExportNamedDeclaration' &&
        statement.declaration?.type === 'FunctionDeclaration' &&
        statement.declaration.id?.name === 'main'
      ) {
        const functionDeclaration = statement.declaration;

        // skip first parameter (Entity) and process the rest
        functionDeclaration.params.slice(1).forEach(param => {
          let identifier: Identifier | null = null;
          let isOptional = false;
          let defaultValue: Expression | null | undefined = undefined;

          // extract identifier, optional status, and default value based on param type
          if (param.type === 'AssignmentPattern' && param.left.type === 'Identifier') {
            identifier = param.left as Identifier;
            isOptional = true;
            defaultValue = param.right;
          } else if (param.type === 'Identifier') {
            identifier = param as Identifier;
            isOptional = !!identifier.optional;
          }

          if (!identifier) return;

          const name = identifier.name;

          let type: ScriptParamUnion['type'];
          if (
            identifier.typeAnnotation &&
            identifier.typeAnnotation.type === 'TSTypeAnnotation' &&
            identifier.typeAnnotation.typeAnnotation
          ) {
            type = getBabelType(identifier.typeAnnotation.typeAnnotation);
          } else {
            type = inferTypeFromDefault(defaultValue);
          }

          params[name] = { type, optional: isOptional };
        });

        break;
      }
    }
  } catch (error) {
    console.warn('Failed to parse script params:', error);
  }

  return params;
}
