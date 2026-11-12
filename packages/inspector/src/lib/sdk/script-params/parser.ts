import { parse } from '@babel/parser';
import type {
  Identifier,
  TSTypeAnnotation,
  TSType,
  Expression,
  FunctionParameter,
  ClassMethod,
  TSParameterProperty,
  CallExpression,
} from '@babel/types';
import { engine } from '@dcl/ecs';
import { Color3, Color4 } from '@dcl/ecs-math';

import type { ScriptParamUnion, ScriptAction, ScriptColor, ScriptStringFormat } from './types';

const SLIDER_DEFAULT_STEP = 1;

type ColorKind = 'Color3' | 'Color4';

// The Color3/Color4 helpers a default value may call, e.g. `Color3.fromHexString('#ff8800')`.
// Only these run, and only with literal arguments, so parsing never executes script code.
const COLOR_FACTORIES: Record<ColorKind, Record<string, (...args: any[]) => ScriptColor>> = {
  Color3: {
    create: Color3.create,
    fromHexString: Color3.fromHexString,
    fromInts: Color3.fromInts,
    Black: Color3.Black,
    Blue: Color3.Blue,
    Gray: Color3.Gray,
    Green: Color3.Green,
    Magenta: Color3.Magenta,
    Purple: Color3.Purple,
    Red: Color3.Red,
    Teal: Color3.Teal,
    White: Color3.White,
    Yellow: Color3.Yellow,
  },
  Color4: {
    create: Color4.create,
    fromHexString: Color4.fromHexString,
    fromInts: Color4.fromInts,
    Black: Color4.Black,
    Blue: Color4.Blue,
    Clear: Color4.Clear,
    Gray: Color4.Gray,
    Green: Color4.Green,
    Magenta: Color4.Magenta,
    Purple: Color4.Purple,
    Red: Color4.Red,
    Teal: Color4.Teal,
    White: Color4.White,
    Yellow: Color4.Yellow,
  },
};

const isColorKind = (name: string): name is ColorKind => name === 'Color3' || name === 'Color4';

function evaluateColorCall(expression: CallExpression): ScriptColor | undefined {
  const callee = expression.callee;
  if (
    callee.type !== 'MemberExpression' ||
    callee.computed ||
    callee.object.type !== 'Identifier' ||
    callee.property.type !== 'Identifier' ||
    !isColorKind(callee.object.name)
  ) {
    return undefined;
  }
  const factory = COLOR_FACTORIES[callee.object.name][callee.property.name];
  if (!factory) return undefined;
  const args: unknown[] = [];
  for (const argument of expression.arguments) {
    const value =
      argument.type === 'SpreadElement' || argument.type === 'ArgumentPlaceholder'
        ? undefined
        : evaluateLiteralExpression(argument as Expression);
    if (typeof value !== 'number' && typeof value !== 'string') return undefined;
    args.push(value);
  }
  try {
    const { r, g, b, a } = factory(...args);
    return a === undefined ? { r, g, b } : { r, g, b, a };
  } catch {
    return undefined;
  }
}

function isColorValue(value: unknown): value is ScriptColor {
  if (!value || typeof value !== 'object') return false;
  const { r, g, b } = value as Record<string, unknown>;
  return typeof r === 'number' && typeof g === 'number' && typeof b === 'number';
}

// Shapes any stored or authored colour to the declared kind: a Color3 drops `a`, a Color4
// always carries one (opaque unless the value says otherwise).
export function toColorOfKind(value: ScriptColor, alpha: boolean): ScriptColor {
  const { r, g, b } = value;
  if (!alpha) return { r, g, b };
  return { r, g, b, a: typeof value.a === 'number' ? value.a : 1 };
}

function getColorKind(typeAnnotation: TSType): ColorKind | undefined {
  if (typeAnnotation.type !== 'TSTypeReference') return undefined;
  const typeName = typeAnnotation.typeName;
  // `Color3` itself, or one of its namespace types such as `Color3.Mutable`
  const name =
    typeName.type === 'Identifier'
      ? typeName.name
      : typeName.type === 'TSQualifiedName' && typeName.left.type === 'Identifier'
        ? typeName.left.name
        : undefined;
  return name && isColorKind(name) ? name : undefined;
}

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
    case 'CallExpression':
      return evaluateColorCall(expression);
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
  const colorKind = getColorKind(typeAnnotation);
  if (colorKind) {
    return { type: 'color', value: toColorOfKind({ r: 1, g: 1, b: 1 }, colorKind === 'Color4') };
  }
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
          const child = applyParamTags(
            getValueAndTypeFromType(member.typeAnnotation.typeAnnotation),
            extractParamTags(member.leadingComments),
          );
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

type Comments = { type: string; value: string }[] | undefined | null;

// Editor hints a script can put in the JSDoc of a param or of an object member. They only shape
// the editor (the runtime still receives the plain value), so scripts stay valid on any SDK:
//   @components <name> …  an Entity picks only entities with one of these components
//   @actionsOf <key>      a string picks one of the actions of the entity in sibling `<key>`
//   @format wallet        a string holds an Ethereum address
//   @format image         a string holds the path of a scene image (also audio, video, model)
//   @enabledIf [!]<key>   the field is locked unless the sibling field `<key>` is on (off with !)
// On a list, the hint applies to each element, except @enabledIf, which locks the whole list.
type ParamTags = {
  components?: string[];
  actionsOf?: string;
  format?: ScriptStringFormat;
  enabledIf?: string;
};

function extractParamTags(comments: Comments): ParamTags {
  const tags: ParamTags = {};
  for (const comment of comments ?? []) {
    if (comment.type !== 'CommentBlock') continue;
    for (const rawLine of comment.value.split('\n')) {
      const line = rawLine.trim().replace(/^\*\s?/, '');
      const components = line.match(/^@components\s+(.+)/);
      if (components) {
        tags.components = components[1].split(/[\s,]+/).filter(Boolean);
        continue;
      }
      const actionsOf = line.match(/^@actionsOf\s+([A-Za-z_$][\w$]*)/);
      if (actionsOf) {
        tags.actionsOf = actionsOf[1];
        continue;
      }
      const enabledIf = line.match(/^@enabledIf\s+(!?\s*[A-Za-z_$][\w$]*)/);
      if (enabledIf) {
        tags.enabledIf = enabledIf[1].replace(/\s+/g, '');
        continue;
      }
      const format = line.match(/^@format\s+(wallet|image|audio|video|model)\b/);
      if (format) tags.format = format[1] as ScriptStringFormat;
    }
  }
  return tags;
}

function applyParamTags(param: ScriptParamUnion, tags: ParamTags): ScriptParamUnion {
  const { enabledIf, ...typeTags } = tags;
  const tagged = applyTypeTags(param, typeTags);
  return enabledIf ? { ...tagged, enabledIf } : tagged;
}

function applyTypeTags(param: ScriptParamUnion, tags: ParamTags): ScriptParamUnion {
  if (param.type === 'array') return { ...param, item: applyTypeTags(param.item, tags) };
  if (param.type === 'entity' && tags.components?.length) {
    return { ...param, components: tags.components };
  }
  if (param.type === 'string') {
    const next = { ...param };
    if (tags.actionsOf) next.actionsOf = tags.actionsOf;
    if (tags.format) next.format = tags.format;
    return next;
  }
  return param;
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
  if (typeInfo.type === 'color') {
    // the declared type decides Color3 vs Color4, the default only supplies the channels
    if (!isColorValue(valueInfo.value)) return typeInfo;
    return { ...typeInfo, value: toColorOfKind(valueInfo.value, typeInfo.value.a !== undefined) };
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
    const tagged = applyParamTags(clampSliderValue(info), extractParamTags(param.leadingComments));
    result[name] = { ...tagged, optional };
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
