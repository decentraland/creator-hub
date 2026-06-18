import type { Entity, IEngine, PointerEventsSystem } from '@dcl/ecs';
import { InputAction } from '@dcl/ecs';

import { ComponentName } from './enums';
import { getUiContextValue, getUiCallback, clearUiContext, clearUiCallbacks } from './ui-context';
import { coerceToString } from './coerce';
import { parseVariableDefault } from './variable-codecs';
import { safeParse } from './safe-parse';

// Re-exported so existing importers (and the unit test) keep resolving safeParse
// from this module; the implementation lives in ./safe-parse, shared with the
// inspector migration.
export { safeParse } from './safe-parse';

// Fallback logging for malformed composite-sourced UIDesign JSON (runtime side).
const DECODE_LOG = { label: 'decodeDesign', warn: (msg: string) => console.error(msg) };

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
// Rebuilt each tick (not cached): it is a global aggregate over all UIDesign entities,
// sensitive to both membership and per-node parent changes, so a correct invalidation
// check would cost the same O(N) pass as the rebuild. The expensive per-entity work
// (design decode, binding maps) is cached separately by raw-value identity; this pass
// is a cheap linear walk over a small node set.
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

// Cached binding-map accessor: rebuilds only when the raw UIBindings value changes
// (reference identity, same strategy as the design cache). `changed` is true only
// when an entity that already had cached bindings sees a *new* raw value — i.e. a
// live re-bind / hot-reload after the initial wiring, which must trigger a pointer
// re-wire. It is false on the first build, so initial wiring runs through the normal
// `wired` gate.
function getBindingMaps(
  bag: ComponentBag,
  entity: Entity,
  state: RootState,
): { single: Bindings; mixed: MixedContent; changed: boolean } {
  const raw = bag.UIBindings?.getOrNull(entity) ?? null;
  const cached = state.bindings.get(entity);
  if (cached && cached.raw === raw) {
    return { single: cached.single, mixed: cached.mixed, changed: false };
  }
  const { single, mixed } = buildBindingMaps(bag, entity);
  state.bindings.set(entity, { raw, single, mixed });
  return { single, mixed, changed: cached !== undefined };
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
  background?: AnyRecord; // design core::UiBackground
};

type RootState = {
  // Perf cache of decoded designs, keyed by entity. Re-decoded when the raw UIDesign
  // value changes (UIDesign is pristine, so caching never causes compounding).
  design: Map<Entity, { raw: AnyRecord; decoded: NodeDesign }>;
  // Perf cache of built binding maps, keyed by entity. Re-built only when the raw
  // UIBindings value changes; doubles as the change-detector that drives pointer
  // re-wiring on a live re-bind / hot-reload (see materializeSubtree).
  bindings: Map<Entity, { raw: unknown; single: Bindings; mixed: MixedContent }>;
  // One-time interactivity wiring per entity (pointer handlers + result subscriptions).
  wired: Set<Entity>;
  pointerWired: Set<Entity>;
};

// Decode an asset-packs::UIDesign value into the design shape the materialize* helpers
// consume. parent/rightOf are stored as entity fields (for composite remapping); the rest
// of the transform + the text/input/dropdown design are JSON-encoded. UIDesign is authored
// and never written by the runtime, so this is always the pristine, unscaled design.
function decodeDesign(uiDesign: AnyRecord, entity: Entity): NodeDesign {
  const transform: AnyRecord = {
    ...safeParse<AnyRecord>(
      uiDesign.transform as string | undefined,
      {},
      entity,
      'transform',
      DECODE_LOG,
    ),
    parent: uiDesign.parent,
    rightOf: uiDesign.rightOf,
  };
  const text = safeParse<AnyRecord | undefined>(
    uiDesign.text as string | undefined,
    undefined,
    entity,
    'text',
    DECODE_LOG,
  );
  const input = safeParse<AnyRecord | undefined>(
    uiDesign.input as string | undefined,
    undefined,
    entity,
    'input',
    DECODE_LOG,
  );
  const dropdown = safeParse<AnyRecord | undefined>(
    uiDesign.dropdown as string | undefined,
    undefined,
    entity,
    'dropdown',
    DECODE_LOG,
  );
  const background = safeParse<AnyRecord | undefined>(
    uiDesign.background as string | undefined,
    undefined,
    entity,
    'background',
    DECODE_LOG,
  );
  return { transform, text, input, dropdown, background };
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

// Delete a derived render component only if it is currently present — keeps the
// "stable UI produces zero CRDT writes" guarantee while ensuring a render component
// disappears when its UIDesign field is removed (e.g. a hot-reload that drops the
// node's background/text). Without this, the previously-derived component lingers.
function clearIfPresent(component: any, entity: Entity): void {
  if (component.has(entity)) component.deleteFrom(entity);
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

// Resolve the design background into the live core::UiBackground. Background carries no
// spatial fields, so (unlike transform/fontSize) nothing scales — texture/textureMode/uvs
// pass through verbatim, with core::UiBackground.color overridable by a variable binding.
function materializeBackground(
  bag: ComponentBag,
  entity: Entity,
  root: Entity,
  designBackground: AnyRecord,
  bindings: Bindings,
  varDefs: VarDefs,
): void {
  const target: AnyRecord = { ...designBackground };
  target.color = resolveBoundValue(
    bindings,
    varDefs,
    root,
    'core::UiBackground',
    'color',
    designBackground.color,
  );
  writeIfChanged(bag.UiBackground, entity, target);
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
  bindings: Bindings,
): void {
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
  // so guard against double-subscribe. Mirrors react-ecs reconciler:191-211. The
  // subscription outlives any binding change, so it resolves the bound variable
  // LIVE at fire time (reading the current UIBindings) rather than capturing the
  // wire-time snapshot.
  if (
    (bindings.has('core::UiInput.onChange') || bindings.has('core::UiInput.onSubmit')) &&
    !resultSubscribed.has(entity)
  ) {
    resultSubscribed.add(entity);
    bag.UiInputResult.onChange(
      entity,
      (value: { value?: string; isSubmit?: boolean } | undefined) => {
        if (!value) return;
        const live = buildBindingMaps(bag, entity).single;
        if (value.isSubmit) {
          resolveBoundCallback(live, root, 'core::UiInput', 'onSubmit')?.(value.value);
        }
        resolveBoundCallback(live, root, 'core::UiInput', 'onChange')?.(value.value);
      },
    );
  }

  // Dropdown result -> onChange (also resolved live at fire time).
  if (bindings.has('core::UiDropdown.onChange') && !resultSubscribed.has(entity)) {
    resultSubscribed.add(entity);
    bag.UiDropdownResult.onChange(entity, (value: { value?: number } | undefined) => {
      if (!value) return;
      const live = buildBindingMaps(bag, entity).single;
      resolveBoundCallback(live, root, 'core::UiDropdown', 'onChange')?.(value.value);
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

  // Root visibility -> display override on the root transform only. Built uncached
  // (not via getBindingMaps): the subtree loop below must be the first cache
  // interaction for the root, so it — not this call — observes a binding change and
  // re-wires the root's pointer handlers. This is one extra map build for a single
  // entity per tick.
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
      state.bindings.delete(e);
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

  const {
    single: bindings,
    mixed: mixedContent,
    changed: bindingsChanged,
  } = getBindingMaps(bag, entity, state);

  // A live re-bind / hot-reload changed this entity's bindings after it was wired:
  // tear down its pointer handlers so the block below re-wires from the new bindings
  // (the set of bound pointer events can grow or shrink). Result-component
  // subscriptions are intentionally left in place (no unsubscribe API) — they resolve
  // the bound variable live at fire time, and a newly-added binding still subscribes
  // on re-wire via the resultSubscribed guard.
  if (bindingsChanged && state.wired.has(entity)) {
    if (state.pointerWired.has(entity)) {
      teardownPointer(pointerEventsSystem, entity);
      state.pointerWired.delete(entity);
    }
    state.wired.delete(entity);
  }

  // Wire interactivity once per entity (or re-wire after a binding change above).
  if (!state.wired.has(entity)) {
    state.wired.add(entity);
    wireInteractivity(bag, pointerEventsSystem, root, entity, state, resultSubscribed, bindings);
  }

  materializeTransform(bag, entity, root, design, bindings, varDefs, displayOverride, scale);
  // Each optional render component is re-derived when its design field is present,
  // and removed when absent — so dropping a field (e.g. on hot-reload) doesn't leave
  // a previously-derived component stranded on the entity.
  if (design.background)
    materializeBackground(bag, entity, root, design.background, bindings, varDefs);
  else clearIfPresent(bag.UiBackground, entity);
  if (design.text)
    materializeText(bag, entity, root, design.text, bindings, mixedContent, varDefs, scale);
  else clearIfPresent(bag.UiText, entity);
  if (design.input)
    materializeInput(bag, entity, root, design.input, bindings, mixedContent, varDefs);
  else clearIfPresent(bag.UiInput, entity);
  if (design.dropdown) materializeDropdown(bag, entity, root, design.dropdown, bindings, varDefs);
  else clearIfPresent(bag.UiDropdown, entity);
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
  // The component bag (definition references) is stable for the system's lifetime,
  // so build it once on the first tick and reuse it — avoids a per-tick object alloc
  // plus 11 engine.getComponent lookups every frame. Built lazily (not at factory
  // time) so it never depends on component-registration order: getComponent throws
  // for an unregistered component, and by the first tick all core + asset-pack UI
  // components are registered.
  let cachedBag: ComponentBag | null = null;

  return function uiRuntimeSystem(_dt: number) {
    const bag = (cachedBag ??= getBag(engine));

    // Register newly-appeared roots.
    for (const [rootEntity] of engine.getEntitiesWith(bag.UI)) {
      if (!roots.has(rootEntity)) {
        roots.set(rootEntity, {
          design: new Map(),
          bindings: new Map(),
          wired: new Set(),
          pointerWired: new Set(),
        });
      }
    }

    // Tear down removed roots (pointer handlers; result subs are left inert).
    for (const rootEntity of Array.from(roots.keys())) {
      if (!bag.UI.has(rootEntity)) {
        const state = roots.get(rootEntity) as RootState;
        for (const entity of state.pointerWired) teardownPointer(pointerEventsSystem, entity);
        roots.delete(rootEntity);
        // Reclaim the per-root context + callback maps so they don't grow without
        // bound as UIs are created/destroyed. Context/callbacks are keyed by the root
        // entity, so a single clear per map suffices. Result subscriptions stay inert
        // (no unsubscribe API) and resolve live, so a recycled id sees fresh state.
        clearUiContext(rootEntity);
        clearUiCallbacks(rootEntity);
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
