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
  UIDesign: any;
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
    UIDesign: engine.getComponent(ComponentName.UI_DESIGN),
  };
}

// Build a parent -> children index from every entity carrying asset-packs::UIDesign.
function getChildrenOf(engine: IEngine, bag: ComponentBag): Map<Entity, Entity[]> {
  const childrenOf = new Map<Entity, Entity[]>();
  for (const [entity, value] of engine.getEntitiesWith(bag.UIDesign)) {
    const parent = (value as AnyRecord).parent as Entity | undefined;
    if (parent === undefined) continue;
    const siblings = childrenOf.get(parent) ?? [];
    siblings.push(entity);
    childrenOf.set(parent, siblings);
  }
  return childrenOf;
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

type NodeDesign = {
  transform: AnyRecord; // design core::UiTransform (always present)
  text?: AnyRecord; // design core::UiText
  input?: AnyRecord; // design core::UiInput
  dropdown?: AnyRecord; // design core::UiDropdown
};

type RootState = {
  // Perf cache of decoded designs, keyed by entity. Re-decoded when the raw UIDesign
  // value changes (UIDesign is pristine, so caching never causes compounding).
  design: Map<Entity, { raw: AnyRecord; decoded: NodeDesign }>;
  // One-time interactivity wiring per entity (pointer handlers + result subscriptions).
  wired: Set<Entity>;
  pointerWired: Set<Entity>;
};

// Keys an attacker could place in composite JSON to attempt prototype pollution; stripped from
// every decoded object before it reaches createOrReplace. Variable-key delete avoids the
// linter's no-proto literal-access rule. Keep IN LOCKSTEP with the copy in
// packages/inspector/src/lib/data-layer/host/utils/ui-design-migration.ts.
const DANGEROUS_KEYS = ['__proto__', 'prototype', 'constructor'];

// The composite JSON is attacker-controllable; a malformed UIDesign string field must not
// throw out of the per-frame UI system, nor reach a core::* component as a wrong-shape value
// or with prototype-polluting keys. Parse defensively: on throw OR non-plain-object shape, log
// and fall back; otherwise strip dangerous keys and return. exported for unit tests.
export function safeParse<T>(
  raw: string | undefined,
  fallback: T,
  entity: Entity,
  field: string,
): T {
  if (!raw) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error(`decodeDesign: malformed UIDesign.${field} on entity ${entity}; using fallback`);
    return fallback;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    console.error(`decodeDesign: non-object UIDesign.${field} on entity ${entity}; using fallback`);
    return fallback;
  }
  const obj = parsed as AnyRecord;
  for (const k of DANGEROUS_KEYS) delete obj[k];
  return obj as T;
}

// Decode an asset-packs::UIDesign value into the design shape the materialize* helpers
// consume. parent/rightOf are stored as entity fields (for composite remapping); the rest
// of the transform + the text/input/dropdown design are JSON-encoded. UIDesign is authored
// and never written by the runtime, so this is always the pristine, unscaled design.
function decodeDesign(uiDesign: AnyRecord, entity: Entity): NodeDesign {
  const transform: AnyRecord = {
    ...safeParse<AnyRecord>(uiDesign.transform as string | undefined, {}, entity, 'transform'),
    parent: uiDesign.parent,
    rightOf: uiDesign.rightOf,
  };
  const text = safeParse<AnyRecord | undefined>(
    uiDesign.text as string | undefined,
    undefined,
    entity,
    'text',
  );
  const input = safeParse<AnyRecord | undefined>(
    uiDesign.input as string | undefined,
    undefined,
    entity,
    'input',
  );
  const dropdown = safeParse<AnyRecord | undefined>(
    uiDesign.dropdown as string | undefined,
    undefined,
    entity,
    'dropdown',
  );
  return { transform, text, input, dropdown };
}

// Decoded UIDesign values are attacker-controllable; a deeply-nested value would otherwise
// overflow the stack here, because writeIfChanged compares the stored object reference every
// frame. Real UI component values are ~2-3 levels deep, so 32 never trips for valid content;
// anything deeper is treated as "changed" (return false) so writeIfChanged falls through to
// createOrReplace instead of recursing without bound.
const MAX_DEEP_EQUAL_DEPTH = 32;

// Structural equality for plain PB component values (objects, arrays, scalars). exported for tests.
export function deepEqual(a: unknown, b: unknown, depth = 0): boolean {
  if (a === b) return true;
  if (depth >= MAX_DEEP_EQUAL_DEPTH) return false;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const aArr = Array.isArray(a);
  const bArr = Array.isArray(b);
  if (aArr || bArr) {
    if (!aArr || !bArr || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i], depth + 1)) return false;
    return true;
  }
  const ak = Object.keys(a as AnyRecord);
  const bk = Object.keys(b as AnyRecord);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual((a as AnyRecord)[k], (b as AnyRecord)[k], depth + 1)) return false;
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
  design: NodeDesign,
  bindings: Bindings,
  varDefs: VarDefs,
  displayOverride: number | undefined,
  scale: number,
): void {
  const target: AnyRecord = { ...design.transform };
  for (const key of bindings.keys()) {
    if (!key.startsWith('core::UiTransform.')) continue;
    const fieldPath = key.slice('core::UiTransform.'.length);
    target[fieldPath] = resolveBoundValue(
      bindings,
      varDefs,
      root,
      'core::UiTransform',
      fieldPath,
      design.transform[fieldPath],
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
  designText: AnyRecord,
  bindings: Bindings,
  mixedContent: MixedContent,
  varDefs: VarDefs,
  scale: number,
): void {
  const target: AnyRecord = { ...designText };
  target.value = resolveTextField(
    mixedContent,
    bindings,
    varDefs,
    root,
    'core::UiText',
    'value',
    designText.value as string,
  );
  target.color = resolveBoundValue(
    bindings,
    varDefs,
    root,
    'core::UiText',
    'color',
    designText.color,
  );
  target.fontSize = resolveBoundValue(
    bindings,
    varDefs,
    root,
    'core::UiText',
    'fontSize',
    designText.fontSize,
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
  designInput: AnyRecord,
  bindings: Bindings,
  mixedContent: MixedContent,
  varDefs: VarDefs,
): void {
  const target: AnyRecord = { ...designInput };
  target.value = resolveTextField(
    mixedContent,
    bindings,
    varDefs,
    root,
    'core::UiInput',
    'value',
    designInput.value as string,
  );
  target.placeholder = resolveTextField(
    mixedContent,
    bindings,
    varDefs,
    root,
    'core::UiInput',
    'placeholder',
    designInput.placeholder as string,
  );
  target.disabled = resolveBoundValue(
    bindings,
    varDefs,
    root,
    'core::UiInput',
    'disabled',
    designInput.disabled,
  );
  writeIfChanged(bag.UiInput, entity, target);
}

function materializeDropdown(
  bag: ComponentBag,
  entity: Entity,
  root: Entity,
  designDropdown: AnyRecord,
  bindings: Bindings,
  varDefs: VarDefs,
): void {
  const target: AnyRecord = { ...designDropdown };
  target.options = resolveBoundValue(
    bindings,
    varDefs,
    root,
    'core::UiDropdown',
    'options',
    designDropdown.options,
  );
  target.selectedIndex = resolveBoundValue(
    bindings,
    varDefs,
    root,
    'core::UiDropdown',
    'selectedIndex',
    designDropdown.selectedIndex,
  );
  target.disabled = resolveBoundValue(
    bindings,
    varDefs,
    root,
    'core::UiDropdown',
    'disabled',
    designDropdown.disabled,
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

  // Root visibility -> display override on the root transform only.
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

  // Virtual-resolution scale: design canvas (marker) -> player screen.
  const m = marker as { canvasWidth?: number; canvasHeight?: number };
  const canvasWidth = m?.canvasWidth && m.canvasWidth > 0 ? m.canvasWidth : 1920;
  const canvasHeight = m?.canvasHeight && m.canvasHeight > 0 ? m.canvasHeight : 1080;
  const scale =
    screen && screen.width > 0 && screen.height > 0
      ? Math.min(screen.width / canvasWidth, screen.height / canvasHeight)
      : 1;

  // Drop cache/wiring for entities whose UIDesign left the tree.
  for (const e of Array.from(state.design.keys())) {
    if (!bag.UIDesign.has(e)) {
      state.design.delete(e);
      state.wired.delete(e);
      if (state.pointerWired.has(e)) {
        teardownPointer(pointerEventsSystem, e);
        state.pointerWired.delete(e);
      }
    }
  }

  for (const entity of subtreeOf(root, childrenIndex)) {
    materializeSubtree(
      bag,
      pointerEventsSystem,
      root,
      entity,
      state,
      resultSubscribed,
      varDefs,
      entity === root ? rootDisplay : undefined,
      scale,
    );
  }
}

function materializeSubtree(
  bag: ComponentBag,
  pointerEventsSystem: PointerEventsSystem,
  root: Entity,
  entity: Entity,
  state: RootState,
  resultSubscribed: Set<Entity>,
  varDefs: VarDefs,
  displayOverride: number | undefined,
  scale: number,
): void {
  const uiDesign = bag.UIDesign.getOrNull(entity) as AnyRecord | null;
  if (!uiDesign) return; // subtreeOf only yields UIDesign-bearing entities; defensive no-op.

  // Decode (cache by raw value identity; UIDesign is pristine so this never compounds).
  let entry = state.design.get(entity);
  if (!entry || entry.raw !== uiDesign) {
    entry = { raw: uiDesign, decoded: decodeDesign(uiDesign, entity) };
    state.design.set(entity, entry);
  }
  const design = entry.decoded;

  // Wire interactivity once per entity.
  if (!state.wired.has(entity)) {
    state.wired.add(entity);
    wireInteractivity(bag, pointerEventsSystem, root, entity, state, resultSubscribed);
  }

  const { single: bindings, mixed: mixedContent } = buildBindingMaps(bag, entity);

  materializeTransform(bag, entity, root, design, bindings, varDefs, displayOverride, scale);
  if (design.text)
    materializeText(bag, entity, root, design.text, bindings, mixedContent, varDefs, scale);
  if (design.input)
    materializeInput(bag, entity, root, design.input, bindings, mixedContent, varDefs);
  if (design.dropdown) materializeDropdown(bag, entity, root, design.dropdown, bindings, varDefs);
}

// Engine-native UI Designer runtime. Each UI node carries a pristine, authored
// asset-packs::UIDesign (the design source — the runtime never writes it). On every tick
// this system reads UIDesign, resolves variable bindings, wires interactivity, and recreates
// the scaled core::UiTransform/UiText/UiInput/UiDropdown render components the SDK engine
// renders. Input (UIDesign) and output (core::*) are distinct components, so re-running over
// a kept CRDT re-derives the output from pristine input and never compounds (Tween pattern).
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
        roots.set(rootEntity, { design: new Map(), wired: new Set(), pointerWired: new Set() });
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
