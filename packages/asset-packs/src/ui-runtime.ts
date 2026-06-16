import type { Entity, IEngine, PointerEventsSystem } from '@dcl/ecs';
import { InputAction } from '@dcl/ecs';

import { ComponentName } from './enums';
import { getUiContextValue, getUiCallback } from './ui-context';
import { coerceToString } from './coerce';
import { parseVariableDefault } from './variable-codecs';

// YGDisplay: YGD_FLEX = 0 (default), YGD_NONE = 1.
const YGD_FLEX = 0;
const YGD_NONE = 1;

// YGUnit: YGU_UNDEFINED = 0, YGU_POINT = 1 (px), YGU_PERCENT = 2, YGU_AUTO = 3.
// Only YGU_POINT values participate in virtual-resolution scaling.
const YGU_POINT = 1;

type AnyRecord = Record<string, unknown>;

// core::UiTransform fields that carry a point measurement, paired with the
// companion `${field}Unit` that says whether the value is px/percent/auto.
const POINT_SCALABLE_FIELDS: Array<[valueKey: string, unitKey: string]> = [
  ['width', 'widthUnit'],
  ['height', 'heightUnit'],
  ['minWidth', 'minWidthUnit'],
  ['minHeight', 'minHeightUnit'],
  ['maxWidth', 'maxWidthUnit'],
  ['maxHeight', 'maxHeightUnit'],
  ['positionTop', 'positionTopUnit'],
  ['positionRight', 'positionRightUnit'],
  ['positionBottom', 'positionBottomUnit'],
  ['positionLeft', 'positionLeftUnit'],
  ['marginTop', 'marginTopUnit'],
  ['marginRight', 'marginRightUnit'],
  ['marginBottom', 'marginBottomUnit'],
  ['marginLeft', 'marginLeftUnit'],
  ['paddingTop', 'paddingTopUnit'],
  ['paddingRight', 'paddingRightUnit'],
  ['paddingBottom', 'paddingBottomUnit'],
  ['paddingLeft', 'paddingLeftUnit'],
  ['borderTopWidth', 'borderTopWidthUnit'],
  ['borderRightWidth', 'borderRightWidthUnit'],
  ['borderBottomWidth', 'borderBottomWidthUnit'],
  ['borderLeftWidth', 'borderLeftWidthUnit'],
  ['borderTopLeftRadius', 'borderTopLeftRadiusUnit'],
  ['borderTopRightRadius', 'borderTopRightRadiusUnit'],
  ['borderBottomLeftRadius', 'borderBottomLeftRadiusUnit'],
  ['borderBottomRightRadius', 'borderBottomRightRadiusUnit'],
  ['flexBasis', 'flexBasisUnit'],
];

// Multiply every YGU_POINT field of a transform target by the scale factor in
// place. Percent / auto / undefined units are left untouched.
function scaleTransform(target: AnyRecord, scale: number): void {
  if (scale === 1) return;
  for (const [valueKey, unitKey] of POINT_SCALABLE_FIELDS) {
    if (target[unitKey] === YGU_POINT && typeof target[valueKey] === 'number') {
      target[valueKey] = (target[valueKey] as number) * scale;
    }
  }
}

interface ComponentBag {
  UI: any;
  UiTransform: any;
  UiBackground: any;
  UiText: any;
  UiInput: any;
  UiInputResult: any;
  UiDropdown: any;
  UiDropdownResult: any;
  UiCanvasInformation: any;
  UIBindings: any;
}

function getBag(engine: IEngine): ComponentBag {
  return {
    UI: engine.getComponent(ComponentName.UI),
    UiTransform: engine.getComponent('core::UiTransform'),
    UiBackground: engine.getComponent('core::UiBackground'),
    UiText: engine.getComponent('core::UiText'),
    UiInput: engine.getComponent('core::UiInput'),
    UiInputResult: engine.getComponent('core::UiInputResult'),
    UiDropdown: engine.getComponent('core::UiDropdown'),
    UiDropdownResult: engine.getComponent('core::UiDropdownResult'),
    UiCanvasInformation: engine.getComponent('core::UiCanvasInformation'),
    UIBindings: engine.getComponent(ComponentName.UI_BINDINGS),
  };
}

// Build a parent -> children index from every entity carrying core::UiTransform.
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

// ============================================================================
// Engine-native runtime
// ============================================================================

type NodeSnapshot = {
  transform: AnyRecord; // design core::UiTransform (always present)
  text?: AnyRecord; // design core::UiText
  input?: AnyRecord; // design core::UiInput
  dropdown?: AnyRecord; // design core::UiDropdown
};

type RootState = {
  // Immutable design values per node entity (lazily captured on first encounter).
  snapshot: Map<Entity, NodeSnapshot>;
  // Entities whose pointer handlers we registered (for teardown).
  pointerWired: Set<Entity>;
};

function cloneOrUndefined(v: AnyRecord | null): AnyRecord | undefined {
  return v ? { ...v } : undefined;
}

// Structural equality for plain PB component values (objects, arrays, scalars).
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const aArr = Array.isArray(a);
  const bArr = Array.isArray(b);
  if (aArr || bArr) {
    if (!aArr || !bArr || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ak = Object.keys(a as AnyRecord);
  const bk = Object.keys(b as AnyRecord);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual((a as AnyRecord)[k], (b as AnyRecord)[k])) return false;
  }
  return true;
}

// Write the target value into the live component only when it differs — the
// CRDT-wire-cost guard. A stable UI produces zero writes after the first pass.
function writeIfChanged(component: any, entity: Entity, target: AnyRecord): void {
  const live = component.getOrNull(entity);
  if (live && deepEqual(live, target)) return;
  component.createOrReplace(entity, target);
}

// DFS collect a root entity + every descendant via the parent index.
function subtreeOf(root: Entity, childrenIndex: Map<Entity, Entity[]>): Entity[] {
  const out: Entity[] = [];
  const seen = new Set<Entity>();
  const stack: Entity[] = [root];
  while (stack.length) {
    const e = stack.pop() as Entity;
    if (seen.has(e)) continue;
    seen.add(e);
    out.push(e);
    for (const c of childrenIndex.get(e) ?? []) stack.push(c);
  }
  return out;
}

function teardownPointer(pointerEventsSystem: PointerEventsSystem, entity: Entity): void {
  pointerEventsSystem.removeOnPointerDown(entity);
  pointerEventsSystem.removeOnPointerUp(entity);
  pointerEventsSystem.removeOnPointerHoverEnter(entity);
  pointerEventsSystem.removeOnPointerHoverLeave(entity);
}

// Resolve the design transform's bound scalar fields + visibility-driven display
// into the live core::UiTransform.
function materializeTransform(
  bag: ComponentBag,
  entity: Entity,
  root: Entity,
  snap: NodeSnapshot,
  bindings: Bindings,
  varDefs: VarDefs,
  displayOverride: number | undefined,
  scale: number,
): void {
  const target: AnyRecord = { ...snap.transform };
  for (const key of bindings.keys()) {
    if (!key.startsWith('core::UiTransform.')) continue;
    const fieldPath = key.slice('core::UiTransform.'.length);
    target[fieldPath] = resolveBoundValue(
      bindings,
      varDefs,
      root,
      'core::UiTransform',
      fieldPath,
      snap.transform[fieldPath],
    );
  }
  if (displayOverride !== undefined) target.display = displayOverride;
  scaleTransform(target, scale);
  writeIfChanged(bag.UiTransform, entity, target);
}

function materializeText(
  bag: ComponentBag,
  entity: Entity,
  root: Entity,
  snapText: AnyRecord,
  bindings: Bindings,
  mixedContent: MixedContent,
  varDefs: VarDefs,
  scale: number,
): void {
  const target: AnyRecord = { ...snapText };
  target.value = resolveTextField(
    mixedContent,
    bindings,
    varDefs,
    root,
    'core::UiText',
    'value',
    snapText.value as string,
  );
  target.color = resolveBoundValue(
    bindings,
    varDefs,
    root,
    'core::UiText',
    'color',
    snapText.color,
  );
  target.fontSize = resolveBoundValue(
    bindings,
    varDefs,
    root,
    'core::UiText',
    'fontSize',
    snapText.fontSize,
  );
  if (scale !== 1 && typeof target.fontSize === 'number') {
    target.fontSize = (target.fontSize as number) * scale;
  }
  writeIfChanged(bag.UiText, entity, target);
}

function materializeInput(
  bag: ComponentBag,
  entity: Entity,
  root: Entity,
  snapInput: AnyRecord,
  bindings: Bindings,
  mixedContent: MixedContent,
  varDefs: VarDefs,
): void {
  const target: AnyRecord = { ...snapInput };
  target.value = resolveTextField(
    mixedContent,
    bindings,
    varDefs,
    root,
    'core::UiInput',
    'value',
    snapInput.value as string,
  );
  target.placeholder = resolveTextField(
    mixedContent,
    bindings,
    varDefs,
    root,
    'core::UiInput',
    'placeholder',
    snapInput.placeholder as string,
  );
  target.disabled = resolveBoundValue(
    bindings,
    varDefs,
    root,
    'core::UiInput',
    'disabled',
    snapInput.disabled,
  );
  writeIfChanged(bag.UiInput, entity, target);
}

function materializeDropdown(
  bag: ComponentBag,
  entity: Entity,
  root: Entity,
  snapDropdown: AnyRecord,
  bindings: Bindings,
  varDefs: VarDefs,
): void {
  const target: AnyRecord = { ...snapDropdown };
  target.options = resolveBoundValue(
    bindings,
    varDefs,
    root,
    'core::UiDropdown',
    'options',
    snapDropdown.options,
  );
  target.selectedIndex = resolveBoundValue(
    bindings,
    varDefs,
    root,
    'core::UiDropdown',
    'selectedIndex',
    snapDropdown.selectedIndex,
  );
  target.disabled = resolveBoundValue(
    bindings,
    varDefs,
    root,
    'core::UiDropdown',
    'disabled',
    snapDropdown.disabled,
  );
  writeIfChanged(bag.UiDropdown, entity, target);
}

// Register pointer handlers + input/dropdown result subscriptions once per node.
// Callbacks resolve at fire time (getUiCallback reads the live callback map, so
// scene code can (re)register via setUiCallback after wiring).
function wireInteractivity(
  bag: ComponentBag,
  pointerEventsSystem: PointerEventsSystem,
  root: Entity,
  entity: Entity,
  state: RootState,
  resultSubscribed: Set<Entity>,
): void {
  const { single: bindings } = buildBindingMaps(bag, entity);
  const opts = { button: InputAction.IA_POINTER };

  if (bindings.has('asset-packs::UI.onMouseDown')) {
    pointerEventsSystem.onPointerDown({ entity, opts }, () =>
      resolveBoundCallback(bindings, root, 'asset-packs::UI', 'onMouseDown')?.(),
    );
    state.pointerWired.add(entity);
  }
  if (bindings.has('asset-packs::UI.onMouseUp')) {
    pointerEventsSystem.onPointerUp({ entity, opts }, () =>
      resolveBoundCallback(bindings, root, 'asset-packs::UI', 'onMouseUp')?.(),
    );
    state.pointerWired.add(entity);
  }
  if (bindings.has('asset-packs::UI.onMouseEnter')) {
    pointerEventsSystem.onPointerHoverEnter({ entity, opts }, () =>
      resolveBoundCallback(bindings, root, 'asset-packs::UI', 'onMouseEnter')?.(),
    );
    state.pointerWired.add(entity);
  }
  if (bindings.has('asset-packs::UI.onMouseLeave')) {
    pointerEventsSystem.onPointerHoverLeave({ entity, opts }, () =>
      resolveBoundCallback(bindings, root, 'asset-packs::UI', 'onMouseLeave')?.(),
    );
    state.pointerWired.add(entity);
  }

  // Input result -> onChange / onSubmit. Push subscription (no unsubscribe API),
  // so guard against double-subscribe. Mirrors react-ecs reconciler:191-211.
  if (
    (bindings.has('core::UiInput.onChange') || bindings.has('core::UiInput.onSubmit')) &&
    !resultSubscribed.has(entity)
  ) {
    resultSubscribed.add(entity);
    bag.UiInputResult.onChange(
      entity,
      (value: { value?: string; isSubmit?: boolean } | undefined) => {
        if (!value) return;
        if (value.isSubmit) {
          resolveBoundCallback(bindings, root, 'core::UiInput', 'onSubmit')?.(value.value);
        }
        resolveBoundCallback(bindings, root, 'core::UiInput', 'onChange')?.(value.value);
      },
    );
  }

  // Dropdown result -> onChange.
  if (bindings.has('core::UiDropdown.onChange') && !resultSubscribed.has(entity)) {
    resultSubscribed.add(entity);
    bag.UiDropdownResult.onChange(entity, (value: { value?: number } | undefined) => {
      if (!value) return;
      resolveBoundCallback(bindings, root, 'core::UiDropdown', 'onChange')?.(value.value);
    });
  }
}

function materializeRoot(
  bag: ComponentBag,
  pointerEventsSystem: PointerEventsSystem,
  root: Entity,
  state: RootState,
  resultSubscribed: Set<Entity>,
  childrenIndex: Map<Entity, Entity[]>,
  screen: { width: number; height: number } | null,
): void {
  const marker = bag.UI.getOrNull(root);
  if (!marker) return;
  const varDefs = buildVarDefs(bag, root);

  // Root visibility -> display override on the root transform only (display:none
  // cascades to the subtree in Yoga).
  const { single: rootBindings } = buildBindingMaps(bag, root);
  const resolvedVisible = resolveBoundValue(
    rootBindings,
    varDefs,
    root,
    'asset-packs::UI',
    'visible',
    marker.visible,
  ) as boolean;
  const rootDisplay = resolvedVisible === false ? YGD_NONE : YGD_FLEX;

  // Virtual-resolution scale: design canvas (marker) -> player screen. Same
  // min-fit formula the react-ecs addUiRenderer wiring used. Legacy UIs (no
  // canvasWidth) fall back to 1920×1080. Scale 1 when the screen size is unknown.
  const m = marker as { canvasWidth?: number; canvasHeight?: number };
  const canvasWidth = m?.canvasWidth && m.canvasWidth > 0 ? m.canvasWidth : 1920;
  const canvasHeight = m?.canvasHeight && m.canvasHeight > 0 ? m.canvasHeight : 1080;
  const scale =
    screen && screen.width > 0 && screen.height > 0
      ? Math.min(screen.width / canvasWidth, screen.height / canvasHeight)
      : 1;

  // Drop (and tear down) snapshot entries whose entity left the tree.
  for (const e of Array.from(state.snapshot.keys())) {
    if (!bag.UiTransform.has(e)) {
      state.snapshot.delete(e);
      if (state.pointerWired.has(e)) {
        teardownPointer(pointerEventsSystem, e);
        state.pointerWired.delete(e);
      }
    }
  }

  for (const entity of subtreeOf(root, childrenIndex)) {
    const liveTransform = bag.UiTransform.getOrNull(entity);
    if (!liveTransform) continue;

    // Lazy snapshot on first encounter — live still equals design here.
    let snap = state.snapshot.get(entity);
    if (!snap) {
      snap = {
        transform: { ...(liveTransform as AnyRecord) },
        text: cloneOrUndefined(bag.UiText.getOrNull(entity)),
        input: cloneOrUndefined(bag.UiInput.getOrNull(entity)),
        dropdown: cloneOrUndefined(bag.UiDropdown.getOrNull(entity)),
      };
      state.snapshot.set(entity, snap);
      wireInteractivity(bag, pointerEventsSystem, root, entity, state, resultSubscribed);
    }

    const { single: bindings, mixed: mixedContent } = buildBindingMaps(bag, entity);

    materializeTransform(
      bag,
      entity,
      root,
      snap,
      bindings,
      varDefs,
      entity === root ? rootDisplay : undefined,
      scale,
    );
    if (snap.text)
      materializeText(bag, entity, root, snap.text, bindings, mixedContent, varDefs, scale);
    if (snap.input)
      materializeInput(bag, entity, root, snap.input, bindings, mixedContent, varDefs);
    if (snap.dropdown) materializeDropdown(bag, entity, root, snap.dropdown, bindings, varDefs);
  }
}

// Engine-native UI Designer runtime. The SDK engine renders the stored
// core::UiTransform tree directly; this system resolves variable bindings,
// wires interactivity, and (Phase C) scales the design to the screen — writing
// in place into the live components rather than rendering a second tree.
export function createUIRuntimeSystem(engine: IEngine, pointerEventsSystem: PointerEventsSystem) {
  const roots = new Map<Entity, RootState>();
  // Module-lifetime guard: the ECS Component.onChange API has no unsubscribe,
  // so we subscribe a result component at most once per entity for the whole
  // system lifetime (survives root teardown/re-add of recycled entity ids).
  const resultSubscribed = new Set<Entity>();

  return function uiRuntimeSystem(_dt: number) {
    const bag = getBag(engine);

    // Register newly-appeared roots.
    for (const [rootEntity] of engine.getEntitiesWith(bag.UI)) {
      if (!roots.has(rootEntity)) {
        roots.set(rootEntity, { snapshot: new Map(), pointerWired: new Set() });
      }
    }

    // Tear down removed roots (pointer handlers; result subs are left inert).
    for (const rootEntity of Array.from(roots.keys())) {
      if (!bag.UI.has(rootEntity)) {
        const state = roots.get(rootEntity) as RootState;
        for (const entity of state.pointerWired) teardownPointer(pointerEventsSystem, entity);
        roots.delete(rootEntity);
      }
    }

    // Materialize every live root.
    const childrenIndex = getChildrenOf(engine, bag);
    const canvasInfo = bag.UiCanvasInformation.getOrNull(engine.RootEntity) as {
      width?: number;
      height?: number;
    } | null;
    const screen =
      canvasInfo && typeof canvasInfo.width === 'number' && typeof canvasInfo.height === 'number'
        ? { width: canvasInfo.width, height: canvasInfo.height }
        : null;
    for (const [rootEntity, state] of roots) {
      materializeRoot(
        bag,
        pointerEventsSystem,
        rootEntity,
        state,
        resultSubscribed,
        childrenIndex,
        screen,
      );
    }
  };
}
