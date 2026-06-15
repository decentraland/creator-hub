import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Input, Dropdown } from '@dcl/react-ecs';
import type { IEngine, Entity } from '@dcl/ecs';

import { ComponentName } from './enums';
import { getUiContextValue, getUiCallback } from './ui-context';
import { coerceToString } from './coerce';
import { parseVariableDefault } from './variable-codecs';

interface ComponentBag {
  UI: any;
  UiTransform: any;
  UiBackground: any;
  UiText: any;
  UiInput: any;
  UiDropdown: any;
  UIBindings: any;
}

function getBag(engine: IEngine): ComponentBag {
  return {
    UI: engine.getComponent(ComponentName.UI),
    UiTransform: engine.getComponent('core::UiTransform'),
    UiBackground: engine.getComponent('core::UiBackground'),
    UiText: engine.getComponent('core::UiText'),
    UiInput: engine.getComponent('core::UiInput'),
    UiDropdown: engine.getComponent('core::UiDropdown'),
    UIBindings: engine.getComponent(ComponentName.UI_BINDINGS),
  };
}

function getChildrenOf(engine: IEngine, bag: ComponentBag): Map<Entity, Entity[]> {
  const out = new Map<Entity, Entity[]>();
  for (const [entity, value] of engine.getEntitiesWith(bag.UiTransform)) {
    const parent: Entity | undefined = (value as any).parent;
    if (parent === undefined) continue;
    const list = out.get(parent) ?? [];
    list.push(entity);
    out.set(parent, list);
  }
  return out;
}

type VarDefs = Map<string, { type: string; defaultValue: string }>;
type Bindings = Map<string, string>;
type Segment = { kind: string; value: string };
type MixedContent = Map<string, Segment[]>;

function buildVarDefs(bag: ComponentBag, root: Entity): VarDefs {
  const marker = bag.UI.getOrNull(root);
  const varDefs: VarDefs = new Map();
  if (marker?.variables) {
    for (const v of marker.variables as Array<{
      name: string;
      type: string;
      defaultValue: string;
    }>) {
      varDefs.set(v.name, { type: v.type, defaultValue: v.defaultValue });
    }
  }
  return varDefs;
}

function buildBindingMaps(
  bag: ComponentBag,
  entity: Entity,
): { single: Bindings; mixed: MixedContent } {
  const single: Bindings = new Map();
  const mixed: MixedContent = new Map();
  const bindingsValue = bag.UIBindings?.getOrNull(entity);
  if (bindingsValue?.value) {
    for (const row of bindingsValue.value as Array<{
      field: string;
      variable: string;
      segments?: Segment[];
    }>) {
      if (row.segments && row.segments.length > 0) {
        mixed.set(row.field, row.segments);
      } else if (row.variable) {
        single.set(row.field, row.variable);
      }
    }
  }
  return { single, mixed };
}

function resolveBoundValue(
  bindings: Bindings,
  varDefs: VarDefs,
  root: Entity,
  componentId: string,
  fieldPath: string,
  staticFallback: unknown,
): unknown {
  const key = `${componentId}.${fieldPath}`;
  const varName = bindings.get(key);
  if (!varName) return staticFallback;
  const def = varDefs.get(varName);
  if (!def) return staticFallback;
  const runtime = getUiContextValue(root, varName);
  if (runtime !== undefined) return runtime;
  if (def.defaultValue !== '') return parseVariableDefault(def.type, def.defaultValue);
  return staticFallback;
}

function resolveBoundCallback(
  bindings: Bindings,
  root: Entity,
  componentId: string,
  eventName: string,
): ((...args: unknown[]) => unknown) | undefined {
  const key = `${componentId}.${eventName}`;
  const varName = bindings.get(key);
  if (!varName) return undefined;
  return getUiCallback(root, varName);
}

// Concatenate a field's mixed-content segments into a single string. Literal
// segments contribute their text verbatim; binding segments resolve their
// variable (runtime value -> declared default -> '') and coerce it to a string.
// Returns undefined when the field has no mixed-content entry, so callers fall
// through to the single-bind / static resolution path.
function resolveMixedField(
  mixedContent: MixedContent,
  varDefs: VarDefs,
  root: Entity,
  componentId: string,
  fieldPath: string,
): string | undefined {
  const key = `${componentId}.${fieldPath}`;
  const segments = mixedContent.get(key);
  if (!segments) return undefined;
  let out = '';
  for (const seg of segments) {
    if (seg.kind === 'binding') {
      const def = varDefs.get(seg.value);
      let resolved: unknown = getUiContextValue(root, seg.value);
      if (resolved === undefined && def && def.defaultValue !== '') {
        resolved = parseVariableDefault(def.type, def.defaultValue);
      }
      out += coerceToString(resolved);
    } else {
      out += seg.value;
    }
  }
  return out;
}

// Resolve a renderable string field with the full precedence chain:
//   mixed-content segments > single-variable binding > static value,
// always coerced to a string so non-string variables embed correctly.
function resolveTextField(
  mixedContent: MixedContent,
  bindings: Bindings,
  varDefs: VarDefs,
  root: Entity,
  componentId: string,
  fieldPath: string,
  staticFallback: string,
): string {
  const mixed = resolveMixedField(mixedContent, varDefs, root, componentId, fieldPath);
  if (mixed !== undefined) return mixed;
  return coerceToString(
    resolveBoundValue(bindings, varDefs, root, componentId, fieldPath, staticFallback),
  );
}

type NodeProps = {
  key?: string;
  entity: Entity;
  root: Entity;
  engine: IEngine;
  bag: ComponentBag;
  childrenIndex: Map<Entity, Entity[]>;
  visited: Set<Entity>;
  varDefs: VarDefs;
  overrideDisplay?: 'none' | 'flex';
};

const Node = (props: NodeProps): ReactEcs.JSX.Element | null => {
  const { entity, root, engine, bag, childrenIndex, visited, varDefs, overrideDisplay } = props;
  if (visited.has(entity)) return null;
  visited.add(entity);

  const transform = bag.UiTransform.getOrNull(entity);
  if (!transform) return null;

  const background = bag.UiBackground.getOrNull(entity);
  const text = bag.UiText.getOrNull(entity);
  const input = bag.UiInput.getOrNull(entity);
  const dropdown = bag.UiDropdown.getOrNull(entity);

  const { single: bindings, mixed: mixedContent } = buildBindingMaps(bag, entity);

  // Resolve any bound core::UiTransform fields (width, positionTop, opacity, …).
  // Each binding overrides only the scalar value; the companion `${path}Unit`
  // stays from the static transform.
  let resolvedTransform: Record<string, unknown> = transform;
  for (const key of bindings.keys()) {
    if (!key.startsWith('core::UiTransform.')) continue;
    const fieldPath = key.slice('core::UiTransform.'.length);
    if (resolvedTransform === transform)
      resolvedTransform = { ...(transform as Record<string, unknown>) };
    resolvedTransform[fieldPath] = resolveBoundValue(
      bindings,
      varDefs,
      root,
      'core::UiTransform',
      fieldPath,
      (transform as Record<string, unknown>)[fieldPath],
    );
  }
  const uiTransform = overrideDisplay
    ? { ...resolvedTransform, display: overrideDisplay }
    : resolvedTransform;

  const childEntities = childrenIndex.get(entity) ?? [];
  const childNodes = childEntities.map(child => (
    <Node
      key={String(child)}
      entity={child}
      root={root}
      engine={engine}
      bag={bag}
      childrenIndex={childrenIndex}
      visited={visited}
      varDefs={varDefs}
    />
  ));

  // Event listeners (apply to every JSX branch).
  const onMouseDown = resolveBoundCallback(bindings, root, 'asset-packs::UI', 'onMouseDown') as
    | (() => void)
    | undefined;
  const onMouseUp = resolveBoundCallback(bindings, root, 'asset-packs::UI', 'onMouseUp') as
    | (() => void)
    | undefined;
  const onMouseEnter = resolveBoundCallback(bindings, root, 'asset-packs::UI', 'onMouseEnter') as
    | (() => void)
    | undefined;
  const onMouseLeave = resolveBoundCallback(bindings, root, 'asset-packs::UI', 'onMouseLeave') as
    | (() => void)
    | undefined;

  if (input) {
    const resolvedInput = {
      ...input,
      value: resolveTextField(
        mixedContent,
        bindings,
        varDefs,
        root,
        'core::UiInput',
        'value',
        input.value,
      ),
      placeholder: resolveTextField(
        mixedContent,
        bindings,
        varDefs,
        root,
        'core::UiInput',
        'placeholder',
        input.placeholder,
      ),
      disabled: resolveBoundValue(
        bindings,
        varDefs,
        root,
        'core::UiInput',
        'disabled',
        input.disabled,
      ),
    };
    const onChange = resolveBoundCallback(bindings, root, 'core::UiInput', 'onChange') as
      | ((value: string) => void)
      | undefined;
    const onSubmit = resolveBoundCallback(bindings, root, 'core::UiInput', 'onSubmit') as
      | ((value: string) => void)
      | undefined;
    return (
      <Input
        uiTransform={uiTransform}
        uiBackground={background ?? undefined}
        {...resolvedInput}
        onChange={onChange}
        onSubmit={onSubmit}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    );
  }
  if (dropdown) {
    const resolvedDropdown = {
      ...dropdown,
      options: resolveBoundValue(
        bindings,
        varDefs,
        root,
        'core::UiDropdown',
        'options',
        dropdown.options,
      ),
      selectedIndex: resolveBoundValue(
        bindings,
        varDefs,
        root,
        'core::UiDropdown',
        'selectedIndex',
        dropdown.selectedIndex,
      ),
      disabled: resolveBoundValue(
        bindings,
        varDefs,
        root,
        'core::UiDropdown',
        'disabled',
        dropdown.disabled,
      ),
    };
    const onChange = resolveBoundCallback(bindings, root, 'core::UiDropdown', 'onChange') as
      | ((value: number) => void)
      | undefined;
    return (
      <Dropdown
        uiTransform={uiTransform}
        uiBackground={background ?? undefined}
        {...resolvedDropdown}
        onChange={onChange}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    );
  }
  if (text && childEntities.length === 0) {
    return (
      <Label
        uiTransform={uiTransform}
        uiBackground={background ?? undefined}
        value={resolveTextField(
          mixedContent,
          bindings,
          varDefs,
          root,
          'core::UiText',
          'value',
          text.value,
        )}
        color={
          resolveBoundValue(bindings, varDefs, root, 'core::UiText', 'color', text.color) as never
        }
        fontSize={
          resolveBoundValue(
            bindings,
            varDefs,
            root,
            'core::UiText',
            'fontSize',
            text.fontSize,
          ) as number
        }
        textAlign={text.textAlign}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    );
  }
  return (
    <UiEntity
      uiTransform={uiTransform}
      uiBackground={background ?? undefined}
      uiText={text ?? undefined}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {childNodes}
    </UiEntity>
  );
};

export type UINodeRendererProps = { root: Entity; engine: IEngine };

export const UINodeRenderer = (props: UINodeRendererProps): ReactEcs.JSX.Element | null => {
  const bag = getBag(props.engine);
  const marker = bag.UI.getOrNull(props.root);
  if (!marker) return null;
  const varDefs = buildVarDefs(bag, props.root);
  const { single: rootBindings } = buildBindingMaps(bag, props.root);
  const resolvedVisible = resolveBoundValue(
    rootBindings,
    varDefs,
    props.root,
    'asset-packs::UI',
    'visible',
    marker.visible,
  ) as boolean;
  const overrideDisplay = resolvedVisible === false ? ('none' as const) : undefined;
  const childrenIndex = getChildrenOf(props.engine, bag);
  const visited = new Set<Entity>();
  return (
    <Node
      entity={props.root}
      root={props.root}
      engine={props.engine}
      bag={bag}
      childrenIndex={childrenIndex}
      visited={visited}
      varDefs={varDefs}
      overrideDisplay={overrideDisplay}
    />
  );
};

export function createUIRendererSystem(engine: IEngine) {
  const registered = new Set<Entity>();

  return function uiRendererSystem(_dt: number) {
    const UI = engine.getComponent(ComponentName.UI);

    for (const [entity, marker] of engine.getEntitiesWith(UI as any)) {
      if (registered.has(entity)) continue;
      // The UI is authored against a design/virtual resolution (canvasWidth ×
      // canvasHeight on the marker); addUiRenderer scales it to fit the player's
      // screen. Fall back to 1920×1080 for legacy UIs created before these fields.
      const m = marker as { canvasWidth?: number; canvasHeight?: number };
      const virtualWidth = m?.canvasWidth && m.canvasWidth > 0 ? m.canvasWidth : 1920;
      const virtualHeight = m?.canvasHeight && m.canvasHeight > 0 ? m.canvasHeight : 1080;
      ReactEcsRenderer.addUiRenderer(
        entity,
        () => (
          <UINodeRenderer
            root={entity}
            engine={engine}
          />
        ),
        { virtualWidth, virtualHeight },
      );
      registered.add(entity);
    }

    for (const entity of Array.from(registered)) {
      if (!UI.has(entity)) {
        ReactEcsRenderer.removeUiRenderer(entity);
        registered.delete(entity);
      }
    }
  };
}
