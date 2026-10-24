import { parse } from '@babel/parser';
import type {
  Identifier,
  TSTypeAnnotation,
  TSType,
  Expression,
  FunctionParameter,
  ClassMethod,
  TSParameterProperty,
} from '@babel/types';
import { engine } from '@dcl/ecs';

import type { ScriptParamUnion, ScriptAction } from './types';

const SLIDER_DEFAULT_STEP = 1;

// Recursively evaluate a constructor default expression into the plain JSON value it
// denotes: numbers (incl. negatives), booleans, strings, and nested object/array literals.
// Returns undefined for anything not statically evaluable (a call, an identifier, a spread),
// so the caller can fall back to the type-derived default.
function evaluateLiteralExpression(expression: Expression): unknown {
  switch (expression.type) {
    case 'NumericLiteral':
      return expression.value;
    case 'BooleanLiteral':
      return expression.value;
    case 'StringLiteral':
      return expression.value;
    case 'UnaryExpression':
      if (expression.operator === '-' && expression.argument.type === 'NumericLiteral') {
        return -expression.argument.value;
      }
      return undefined;
    case 'ObjectExpression': {
      const obj: Record<string, unknown> = {};
      for (const prop of expression.properties) {
        if (prop.type !== 'ObjectProperty' || prop.computed) continue;
        const key =
          prop.key.type === 'Identifier'
            ? prop.key.name
            : prop.key.type === 'StringLiteral'
              ? prop.key.value
              : undefined;
        if (key === undefined) continue;
        const value = evaluateLiteralExpression(prop.value as Expression);
        if (value !== undefined) obj[key] = value;
      }
      return obj;
    }
    case 'ArrayExpression': {
      const arr: unknown[] = [];
      for (const element of expression.elements) {
        if (!element || element.type === 'SpreadElement') continue;
        const value = evaluateLiteralExpression(element as Expression);
        if (value !== undefined) arr.push(value);
      }
      return arr;
    }
  }
  return undefined;
}

// Infers a param's type/shape from a plain JSON value. Used when a param has a default
// expression but no type annotation (so the editor can still render sub-fields/rows).
function inferParamFromValue(value: unknown): ScriptParamUnion {
  if (typeof value === 'number') return { type: 'number', value };
  if (typeof value === 'boolean') return { type: 'boolean', value };
  if (typeof value === 'string') return { type: 'string', value };
  if (Array.isArray(value)) {
    const item: ScriptParamUnion =
      value.length > 0 ? inferParamFromValue(value[0]) : { type: 'string', value: '' };
    return { type: 'array', value, item };
  }
  if (value && typeof value === 'object') {
    const fields: Record<string, ScriptParamUnion> = {};
    for (const [key, fieldValue] of Object.entries(value)) {
      fields[key] = inferParamFromValue(fieldValue);
    }
    return { type: 'object', value: value as Record<string, unknown>, fields };
  }
  return { type: 'string', value: '' };
}

function getValueAndTypeFromExpression(expression: Expression): ScriptParamUnion {
  const value = evaluateLiteralExpression(expression);
  if (value === undefined) return { type: 'string', value: '' };
  return inferParamFromValue(value);
}

// resolves numeric literal types, including negative ones (e.g. -90 is a unary expression)
function getNumericLiteral(type: TSType): number | undefined {
  if (type.type !== 'TSLiteralType') return undefined;
  const literal = type.literal;
  if (literal.type === 'NumericLiteral') return literal.value;
  if (
    literal.type === 'UnaryExpression' &&
    literal.operator === '-' &&
    literal.argument.type === 'NumericLiteral'
  ) {
    return -literal.argument.value;
  }
  return undefined;
}

function getSliderParam(
  typeAnnotation: TSTypeAnnotation['typeAnnotation'],
): ScriptParamUnion | undefined {
  if (typeAnnotation.type !== 'TSTypeReference') return undefined;
  const typeArgs = typeAnnotation.typeParameters?.params ?? [];
  const min = typeArgs.length > 0 ? getNumericLiteral(typeArgs[0]) : undefined;
  const max = typeArgs.length > 1 ? getNumericLiteral(typeArgs[1]) : undefined;
  const step = typeArgs.length > 2 ? getNumericLiteral(typeArgs[2]) : SLIDER_DEFAULT_STEP;

  // a slider without valid literal bounds degrades to a plain number field
  if (min === undefined || max === undefined || step === undefined || min >= max || step <= 0) {
    return undefined;
  }

  return { type: 'slider', value: min, min, max, step };
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
        if (typeAnnotation.typeName.name === 'Slider') {
          return getSliderParam(typeAnnotation) ?? { type: 'number', value: 0 };
        }
        // `Array<T>` — same list param as the `T[]` shorthand below.
        if (typeAnnotation.typeName.name === 'Array') {
          const element = typeAnnotation.typeParameters?.params[0];
          const item = element
            ? getValueAndTypeFromType(element)
            : ({ type: 'string', value: '' } as ScriptParamUnion);
          return { type: 'array', value: [], item };
        }
      }
      break;
    // `T[]`
    case 'TSArrayType':
      return {
        type: 'array',
        value: [],
        item: getValueAndTypeFromType(typeAnnotation.elementType),
      };
    // an inline object type literal, e.g. `{ x: number; y: number; z: number }`. Nested
    // object/array members recurse. Named interface/alias refs are NOT resolved (Babel has
    // no type checker), so authors declare nested shapes inline.
    case 'TSTypeLiteral': {
      const fields: Record<string, ScriptParamUnion> = {};
      const value: Record<string, unknown> = {};
      for (const member of typeAnnotation.members) {
        if (
          member.type === 'TSPropertySignature' &&
          member.key.type === 'Identifier' &&
          member.typeAnnotation?.type === 'TSTypeAnnotation'
        ) {
          const child = getValueAndTypeFromType(member.typeAnnotation.typeAnnotation);
          fields[member.key.name] = member.optional ? { ...child, optional: true } : child;
          value[member.key.name] = child.value;
        }
      }
      return { type: 'object', value, fields };
    }
    case 'TSUnionType': {
      // A union of string literals (e.g. `'box' | 'sphere'`) is a dropdown. Any other union
      // (e.g. `string | undefined`) degrades to its first non-undefined member, as before.
      const literals: string[] = [];
      let onlyStringLiterals = true;
      for (const subType of typeAnnotation.types) {
        if (subType.type === 'TSUndefinedKeyword') continue;
        if (subType.type === 'TSLiteralType' && subType.literal.type === 'StringLiteral') {
          literals.push(subType.literal.value);
        } else {
          onlyStringLiterals = false;
        }
      }
      if (onlyStringLiterals && literals.length > 0) {
        return { type: 'enum', value: literals[0], options: literals };
      }
      for (const subType of typeAnnotation.types) {
        if (subType.type !== 'TSUndefinedKeyword') {
          return getValueAndTypeFromType(subType);
        }
      }
      break;
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

// A smart item declares the events its reactions can hook with `@event <name>` tags in the
// class JSDoc — parsed here like @param/@action. Drives the inspector's Reactions section and
// the AI reaction recipe, so the gate isn't a brittle per-item filename check.
function extractEvents(comments?: { type: string; value: string }[] | undefined | null): string[] {
  const events: string[] = [];
  if (!comments) return events;
  for (const comment of comments) {
    if (comment.type !== 'CommentBlock') continue;
    for (const rawLine of comment.value.split('\n')) {
      const match = rawLine
        .trim()
        .replace(/^\*\s?/, '')
        .match(/^@event\s+([A-Za-z0-9_-]+)/);
      if (match && !events.includes(match[1])) events.push(match[1]);
    }
  }
  return events;
}

function mergeTooltips(
  params: Record<string, ScriptParamUnion>,
  comments: { type: string; value: string }[] | undefined | null,
): void {
  const tooltips = extractParamTooltips(comments);
  for (const [name, tooltip] of Object.entries(tooltips)) {
    if (params[name]) params[name].tooltip = tooltip;
  }
}

// merges a param's declared type info with its default value expression, keeping
// type-specific metadata (slider min/max/step, object `fields`, array `item`) from the
// TYPE while taking the value from the DEFAULT expression. For containers, only adopt the
// expression's value when it actually parsed as a matching container — otherwise the
// (scalar-fallback) valueInfo would clobber the structure with '' and the type-derived
// default stands.
function withDefaultValue(
  typeInfo: ScriptParamUnion,
  valueInfo: ScriptParamUnion,
): ScriptParamUnion {
  if (typeInfo.type === 'object') {
    // Shallow-merge the authored default over the type-derived one so a partial literal (or one
    // whose values weren't statically evaluable) keeps a defined value for every declared key
    // rather than leaving some undefined at runtime.
    const value =
      valueInfo.type === 'object'
        ? { ...(typeInfo.value as Record<string, unknown>), ...valueInfo.value }
        : typeInfo.value;
    return { ...typeInfo, value };
  }
  if (typeInfo.type === 'array') {
    return { ...typeInfo, value: valueInfo.type === 'array' ? valueInfo.value : typeInfo.value };
  }
  return { ...typeInfo, value: valueInfo.value } as ScriptParamUnion;
}

// keeps slider values inside the declared range even if the script's default is out of bounds
function clampSliderValue(param: ScriptParamUnion): ScriptParamUnion {
  if (param.type !== 'slider') return param;
  const value = typeof param.value === 'number' && !isNaN(param.value) ? param.value : param.min;
  return { ...param, value: Math.min(Math.max(value, param.min), param.max) };
}

function extractParamsFromFunctionParams(
  params: (FunctionParameter | TSParameterProperty)[],
): Record<string, ScriptParamUnion> {
  const result: Record<string, ScriptParamUnion> = {};

  params.forEach(param => {
    let identifier: Identifier | undefined = undefined;
    let optional = false;
    let info: ScriptParamUnion = { type: 'string', value: '' };

    // handle TSParameterProperty (e.g., "public param: Type")
    if (param.type === 'TSParameterProperty') {
      const parameter = param.parameter;
      if (parameter.type === 'Identifier') {
        identifier = parameter;
        optional = !!identifier.optional;
        if (identifier.typeAnnotation?.type === 'TSTypeAnnotation') {
          info = getValueAndTypeFromType(identifier.typeAnnotation.typeAnnotation);
        }
      } else if (parameter.type === 'AssignmentPattern' && parameter.left.type === 'Identifier') {
        identifier = parameter.left;
        optional = true;

        // if type annotation exists (eg: "entity: Entity = 512"), use it to get type and value
        const typeAnnotation = identifier.typeAnnotation;
        if (typeAnnotation?.type === 'TSTypeAnnotation') {
          const typeInfo = getValueAndTypeFromType(typeAnnotation.typeAnnotation);
          const valueInfo = getValueAndTypeFromExpression(parameter.right);
          info = withDefaultValue(typeInfo, valueInfo);
        } else {
          info = getValueAndTypeFromExpression(parameter.right);
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
        info = withDefaultValue(typeInfo, valueInfo);
      } else {
        // no type annotation, infer both type and value from expression
        info = getValueAndTypeFromExpression(param.right);
      }
    } else if (param.type === 'Identifier') {
      identifier = param;
      optional = !!identifier.optional;
      if (identifier.typeAnnotation?.type === 'TSTypeAnnotation') {
        info = getValueAndTypeFromType(identifier.typeAnnotation.typeAnnotation);
      }
    }

    if (!identifier) return;

    const name = identifier.name;
    result[name] = { ...clampSliderValue(info), optional };
  });

  return result;
}

export type ScriptParseResult = {
  params: Record<string, ScriptParamUnion>;
  actions: ScriptAction[];
  // Event names the script's reactions can hook (from `@event` JSDoc tags).
  events: string[];
  error?: string;
};

export function getScriptParams(content: string): ScriptParseResult {
  let params: Record<string, ScriptParamUnion> = {};
  const actions: ScriptAction[] = [];
  let events: string[] = [];

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

        mergeTooltips(params, functionDeclaration.leadingComments);
        events = extractEvents(functionDeclaration.leadingComments);

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

          mergeTooltips(params, constructor.leadingComments);
        }

        // `@event` tags may sit on the export statement, the class, or the constructor JSDoc.
        events = extractEvents([
          ...(statement.leadingComments ?? []),
          ...(classDeclaration.leadingComments ?? []),
          ...(constructor?.leadingComments ?? []),
        ]);

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

    return { params, actions, events };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '';
    console.warn('Failed to parse script params:', error);
    return { params, actions, events, error: errorMessage };
  }
}
