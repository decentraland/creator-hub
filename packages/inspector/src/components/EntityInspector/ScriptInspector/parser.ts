import { parse } from '@babel/parser';
import type {
  Identifier,
  TSTypeAnnotation,
  Expression,
  FunctionParameter,
  ClassMethod,
  TSParameterProperty,
} from '@babel/types';
import { engine } from '@dcl/ecs';

import type { ScriptParamUnion, ScriptAction } from './types';

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
    case 'TSTypeReference':
      if (typeAnnotation.typeName.type === 'Identifier') {
        if (typeAnnotation.typeName.name === 'Entity') {
          return { type: 'entity', value: engine.RootEntity };
        }
        if (typeAnnotation.typeName.name === 'ActionCallback') {
          return { type: 'action', value: { entity: engine.RootEntity, action: '' } };
        }
      }
      break;
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

function getIdentifier(param: FunctionParameter | TSParameterProperty): Identifier | undefined {
  if (param.type === 'Identifier') {
    return param;
  } else if (param.type === 'TSParameterProperty' && param.parameter.type === 'Identifier') {
    return param.parameter;
  }
  return undefined;
}

function assertScriptSignature(params: (FunctionParameter | TSParameterProperty)[]): void {
  // first param must be src: string
  const firstIdentifier = getIdentifier(params[0]);
  if (
    !firstIdentifier ||
    !firstIdentifier.typeAnnotation ||
    firstIdentifier.typeAnnotation.type !== 'TSTypeAnnotation' ||
    firstIdentifier.typeAnnotation.typeAnnotation.type !== 'TSStringKeyword'
  ) {
    throw new Error('First parameter must be "src: string"');
  }

  // second param must be entity: Entity
  const secondIdentifier = getIdentifier(params[1]);
  if (
    !secondIdentifier ||
    !secondIdentifier.typeAnnotation ||
    secondIdentifier.typeAnnotation.type !== 'TSTypeAnnotation' ||
    secondIdentifier.typeAnnotation.typeAnnotation.type !== 'TSTypeReference' ||
    secondIdentifier.typeAnnotation.typeAnnotation.typeName.type !== 'Identifier' ||
    secondIdentifier.typeAnnotation.typeAnnotation.typeName.name !== 'Entity'
  ) {
    throw new Error('Second parameter must be "entity: Entity"');
  }
}

function extractJSDocDescription(
  comments?: { type: string; value: string }[] | undefined | null,
): string | undefined {
  if (!comments) return undefined;

  for (const comment of comments) {
    if (comment.type === 'CommentBlock') {
      const lines = comment.value.split('\n').map(line => line.trim().replace(/^\*\s?/, ''));
      const descriptionLines: string[] = [];

      for (const line of lines) {
        // stop at first @tag
        if (line.startsWith('@')) break;
        if (line.length > 0) {
          descriptionLines.push(line);
        }
      }

      const description = descriptionLines.join(' ').trim();
      return description.length > 0 ? description : undefined;
    }
  }

  return undefined;
}

function extractParamTooltips(
  comments?: { type: string; value: string }[] | undefined | null,
): Record<string, string> {
  const tooltips: Record<string, string> = {};
  if (!comments) return tooltips;

  for (const comment of comments) {
    if (comment.type === 'CommentBlock') {
      const lines = comment.value.split('\n').map(line => line.trim().replace(/^\*\s?/, ''));
      for (const line of lines) {
        const match = line.match(/^@param\s+(\w+)\s*[-–—]?\s*(.*)/);
        if (match) {
          const [, name, description] = match;
          if (description.trim().length > 0) {
            tooltips[name] = description.trim();
          }
        }
      }
    }
  }

  return tooltips;
}

function extractParamsFromFunctionParams(
  params: (FunctionParameter | TSParameterProperty)[],
): Record<string, ScriptParamUnion> {
  const result: Record<string, ScriptParamUnion> = {};

  params.forEach(param => {
    let identifier: Identifier | undefined = undefined;
    let optional = false;
    let type: ScriptParamUnion['type'] = 'string';
    let value: ScriptParamUnion['value'] = '';

    // handle TSParameterProperty (e.g., "public param: Type")
    if (param.type === 'TSParameterProperty') {
      const parameter = param.parameter;
      if (parameter.type === 'Identifier') {
        identifier = parameter;
        optional = !!identifier.optional;
        if (identifier.typeAnnotation?.type === 'TSTypeAnnotation') {
          ({ type, value } = getValueAndTypeFromType(identifier.typeAnnotation.typeAnnotation));
        }
      } else if (parameter.type === 'AssignmentPattern' && parameter.left.type === 'Identifier') {
        identifier = parameter.left;
        optional = true;

        // if type annotation exists (eg: "entity: Entity = 512"), use it to get type and value
        const typeAnnotation = identifier.typeAnnotation;
        if (typeAnnotation?.type === 'TSTypeAnnotation') {
          const typeInfo = getValueAndTypeFromType(typeAnnotation.typeAnnotation);
          const valueInfo = getValueAndTypeFromExpression(parameter.right);
          type = typeInfo.type;
          value = valueInfo.value;
        } else {
          ({ type, value } = getValueAndTypeFromExpression(parameter.right));
        }
      }
    }
    // handle regular function parameters
    else if (param.type === 'AssignmentPattern' && param.left.type === 'Identifier') {
      identifier = param.left;
      optional = true;

      // if type annotation exists, use it for type and expression for value
      // e.g: target: Entity = 0 -> type from "Entity", value from "0"
      const typeAnnotation = identifier.typeAnnotation;
      if (typeAnnotation?.type === 'TSTypeAnnotation') {
        const typeInfo = getValueAndTypeFromType(typeAnnotation.typeAnnotation);
        const valueInfo = getValueAndTypeFromExpression(param.right);
        type = typeInfo.type;
        value = valueInfo.value;
      } else {
        // no type annotation, infer both type and value from expression
        ({ type, value } = getValueAndTypeFromExpression(param.right));
      }
    } else if (param.type === 'Identifier') {
      identifier = param;
      optional = !!identifier.optional;
      if (identifier.typeAnnotation?.type === 'TSTypeAnnotation') {
        ({ type, value } = getValueAndTypeFromType(identifier.typeAnnotation.typeAnnotation));
      }
    }

    if (!identifier) return;

    const name = identifier.name;
    result[name] = { type, optional, value } as ScriptParamUnion;
  });

  return result;
}

export type ScriptParseResult = {
  params: Record<string, ScriptParamUnion>;
  actions: ScriptAction[];
  error?: string;
};

export function getScriptParams(content: string): ScriptParseResult {
  let params: Record<string, ScriptParamUnion> = {};
  const actions: ScriptAction[] = [];

  try {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    for (const statement of ast.program.body) {
      // handle function-based scripts: export function start(src: string, entity: Entity, ...)
      if (
        statement.type === 'ExportNamedDeclaration' &&
        statement.declaration?.type === 'FunctionDeclaration' &&
        statement.declaration.id?.name === 'start'
      ) {
        const functionDeclaration = statement.declaration;
        assertScriptSignature(functionDeclaration.params);

        // skip first two parameters (src and entity) and process the rest
        const restParams = functionDeclaration.params.slice(2);
        params = extractParamsFromFunctionParams(restParams);

        // merge @param tooltips from JSDoc comments
        const fnTooltips = extractParamTooltips(functionDeclaration.leadingComments);
        for (const [paramName, tooltip] of Object.entries(fnTooltips)) {
          if (params[paramName]) {
            params[paramName].tooltip = tooltip;
          }
        }

        break;
      }

      // handle class-based scripts: export class MyScript { ... }
      if (
        statement.type === 'ExportNamedDeclaration' &&
        statement.declaration?.type === 'ClassDeclaration'
      ) {
        const classDeclaration = statement.declaration;

        // find constructor and extract parameters from it
        const constructor = classDeclaration.body.body.find(
          (member): member is ClassMethod =>
            member.type === 'ClassMethod' && member.kind === 'constructor',
        );

        if (constructor) {
          assertScriptSignature(constructor.params);

          // skip first two parameters (src and entity) and extract the rest
          const restParams = constructor.params.slice(2);
          params = extractParamsFromFunctionParams(restParams);

          // merge @param tooltips from JSDoc comments
          const ctorTooltips = extractParamTooltips(constructor.leadingComments);
          for (const [paramName, tooltip] of Object.entries(ctorTooltips)) {
            if (params[paramName]) {
              params[paramName].tooltip = tooltip;
            }
          }
        }

        // extract @action tagged methods
        for (const member of classDeclaration.body.body) {
          if (member.type === 'ClassMethod' && member.kind === 'method') {
            const leadingComments = member.leadingComments;
            const hasActionTag = leadingComments?.some(
              comment => comment.type === 'CommentBlock' && comment.value.includes('@action'),
            );

            if (hasActionTag && member.key.type === 'Identifier') {
              const methodName = member.key.name;
              const methodParams = extractParamsFromFunctionParams(member.params);
              const description = extractJSDocDescription(leadingComments);

              actions.push({
                methodName,
                description,
                params: methodParams,
              });
            }
          }
        }

        break;
      }
    }

    return { params, actions };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '';
    console.warn('Failed to parse script params:', error);
    return { params, actions, error: errorMessage };
  }
}
