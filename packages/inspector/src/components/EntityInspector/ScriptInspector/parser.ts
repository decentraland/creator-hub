import { parse } from '@babel/parser';
import type { Identifier, TSTypeAnnotation, Expression } from '@babel/types';

import type { ScriptParamUnion } from './types';

function getValueAndTypeFromExpression(expression: Expression): ScriptParamUnion {
  switch (expression.type) {
    case 'NumericLiteral':
      return { type: 'number', value: expression.value };
    case 'BooleanLiteral':
      return { type: 'boolean', value: expression.value };
    case 'StringLiteral':
      return { type: 'string', value: expression.value };
  }

  return { type: 'string', value: '' };
}

function getValueAndTypeFromType(
  typeAnnotation: TSTypeAnnotation['typeAnnotation'],
): ScriptParamUnion {
  switch (typeAnnotation.type) {
    case 'TSNumberKeyword':
      return { type: 'number', value: 0 };
    case 'TSBooleanKeyword':
      return { type: 'boolean', value: false };
    case 'TSUnionType': // (e.g: string | undefined)
      // TODO: what do we do with union types? for now, we'll return the first non-undefined type
      for (const subType of typeAnnotation.types) {
        if (subType.type !== 'TSUndefinedKeyword') {
          return getValueAndTypeFromType(subType);
        }
      }
  }

  return { type: 'string', value: '' };
}

export type ScriptParseResult = {
  params: Record<string, ScriptParamUnion>;
  error?: string;
};

export function getScriptParams(content: string): ScriptParseResult {
  const params: Record<string, ScriptParamUnion> = {};

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
          let identifier: Identifier | undefined = undefined;
          let optional = false;
          let type: ScriptParamUnion['type'] = 'string';
          let value: ScriptParamUnion['value'] = '';

          // extract identifier, optional status, and default value based on param type
          if (param.type === 'AssignmentPattern' && param.left.type === 'Identifier') {
            identifier = param.left;
            optional = true;
            ({ type, value } = getValueAndTypeFromExpression(param.right));
          } else if (param.type === 'Identifier') {
            identifier = param;
            optional = !!identifier.optional;
            if (identifier.typeAnnotation?.type === 'TSTypeAnnotation') {
              ({ type, value } = getValueAndTypeFromType(identifier.typeAnnotation.typeAnnotation));
            }
          }

          if (!identifier) return;

          const name = identifier.name;
          params[name] = { type, optional, value } as ScriptParamUnion;
        });

        break; // exit the for..of loop after finding the main function
      }
    }

    return { params };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '';
    console.warn('Failed to parse script params:', error);
    return { params, error: errorMessage };
  }
}
