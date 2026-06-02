import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Input, Dropdown } from '@dcl/react-ecs';
import type { IEngine, Entity } from '@dcl/ecs';

import { ComponentName } from './enums';
import { getUiContextValue, getUiCallback } from './ui-context';

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

type ResolvedContext = {
  bindingsByField: Map<string, string>;
  varDefs: VarDefs;
};

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

function buildContext(bag: ComponentBag, entity: Entity, varDefs: VarDefs): ResolvedContext {
  const bindingsValue = bag.UIBindings?.getOrNull(entity);
  const bindingsByField = new Map<string, string>();
  if (bindingsValue?.value) {
    for (const row of bindingsValue.value as Array<{ field: string; variable: string }>) {
      bindingsByField.set(row.field, row.variable);
    }
  }
  return { bindingsByField, varDefs };
}

function parseDefault(type: string, raw: string): unknown {
  switch (type) {
    case 'number': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    }
    case 'boolean':
      return raw === 'true';
    case 'color': {
      // Stored as '#RRGGBB' or '#RRGGBBAA'; parse to Color4 { r, g, b, a } in [0..1].
      // Each channel returns its fallback (0 for r/g/b, 1 for a) when the byte
      // pair is not a valid 2-hex-digit sequence — prevents NaN flowing into
      // PB float fields downstream.
      const hex = raw.startsWith('#') ? raw.slice(1) : raw;
      if (hex.length !== 6 && hex.length !== 8) {
        return { r: 0, g: 0, b: 0, a: 1 };
      }
      const parseChannel = (slice: string, fallback: number): number => {
        const n = parseInt(slice, 16);
        return Number.isFinite(n) ? n / 255 : fallback;
      };
      const r = parseChannel(hex.slice(0, 2), 0);
      const g = parseChannel(hex.slice(2, 4), 0);
      const b = parseChannel(hex.slice(4, 6), 0);
      const a = hex.length === 8 ? parseChannel(hex.slice(6, 8), 1) : 1;
      return { r, g, b, a };
    }
    case 'string-array':
      return raw.split('\n').filter(Boolean);
    case 'callback':
      return undefined;
    case 'string':
    default:
      return raw;
  }
}

function resolveBoundValue(
  ctx: ResolvedContext,
  root: Entity,
  componentId: string,
  fieldPath: string,
  staticFallback: unknown,
): unknown {
  const key = `${componentId}.${fieldPath}`;
  const varName = ctx.bindingsByField.get(key);
  if (!varName) return staticFallback;
  const def = ctx.varDefs.get(varName);
  if (!def) return staticFallback;
  const runtime = getUiContextValue(root, varName);
  if (runtime !== undefined) return runtime;
  if (def.defaultValue !== '') return parseDefault(def.type, def.defaultValue);
  return staticFallback;
}

function resolveBoundCallback(
  ctx: ResolvedContext,
  root: Entity,
  componentId: string,
  eventName: string,
): ((...args: unknown[]) => unknown) | undefined {
  const key = `${componentId}.${eventName}`;
  const varName = ctx.bindingsByField.get(key);
  if (!varName) return undefined;
  return getUiCallback(root, varName);
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

  const ctx = buildContext(bag, entity, varDefs);

  const uiTransform = overrideDisplay ? { ...transform, display: overrideDisplay } : transform;

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
  const onMouseDown = resolveBoundCallback(ctx, root, 'asset-packs::UI', 'onMouseDown') as
    | (() => void)
    | undefined;
  const onMouseUp = resolveBoundCallback(ctx, root, 'asset-packs::UI', 'onMouseUp') as
    | (() => void)
    | undefined;

  if (input) {
    const resolvedInput = {
      ...input,
      value: resolveBoundValue(ctx, root, 'core::UiInput', 'value', input.value),
      placeholder: resolveBoundValue(ctx, root, 'core::UiInput', 'placeholder', input.placeholder),
      disabled: resolveBoundValue(ctx, root, 'core::UiInput', 'disabled', input.disabled),
    };
    const onChange = resolveBoundCallback(ctx, root, 'core::UiInput', 'onChange') as
      | ((value: string) => void)
      | undefined;
    const onSubmit = resolveBoundCallback(ctx, root, 'core::UiInput', 'onSubmit') as
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
      />
    );
  }
  if (dropdown) {
    const resolvedDropdown = {
      ...dropdown,
      options: resolveBoundValue(ctx, root, 'core::UiDropdown', 'options', dropdown.options),
      selectedIndex: resolveBoundValue(
        ctx,
        root,
        'core::UiDropdown',
        'selectedIndex',
        dropdown.selectedIndex,
      ),
      disabled: resolveBoundValue(ctx, root, 'core::UiDropdown', 'disabled', dropdown.disabled),
    };
    const onChange = resolveBoundCallback(ctx, root, 'core::UiDropdown', 'onChange') as
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
      />
    );
  }
  if (text && childEntities.length === 0) {
    return (
      <Label
        uiTransform={uiTransform}
        uiBackground={background ?? undefined}
        value={resolveBoundValue(ctx, root, 'core::UiText', 'value', text.value) as string}
        color={resolveBoundValue(ctx, root, 'core::UiText', 'color', text.color) as never}
        fontSize={resolveBoundValue(ctx, root, 'core::UiText', 'fontSize', text.fontSize) as number}
        textAlign={text.textAlign}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
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
  const rootCtx = buildContext(bag, props.root, varDefs);
  const resolvedVisible = resolveBoundValue(
    rootCtx,
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

    for (const [entity] of engine.getEntitiesWith(UI as any)) {
      if (registered.has(entity)) continue;
      ReactEcsRenderer.addUiRenderer(
        entity,
        () => (
          <UINodeRenderer
            root={entity}
            engine={engine}
          />
        ),
        { virtualWidth: 1920, virtualHeight: 1080 },
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
