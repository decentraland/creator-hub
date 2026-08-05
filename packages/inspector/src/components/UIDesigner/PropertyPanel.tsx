import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  IoDesktopOutline,
  IoEyeOffOutline,
  IoEyeOutline,
  IoOptionsOutline,
  IoLockClosedOutline,
  IoLockOpenOutline,
  IoPhoneLandscapeOutline,
  IoWarningOutline,
} from 'react-icons/io5';
import { VscTrash } from 'react-icons/vsc';
import { AiOutlinePlus } from 'react-icons/ai';
import cx from 'classnames';
import type { Entity, TextureUnion } from '@dcl/ecs';

import {
  YGD_FLEX,
  YGD_NONE,
  YGPT_ABSOLUTE,
  YGPT_RELATIVE,
  YGU_AUTO,
  YGU_PERCENT,
  YGU_POINT,
  YGU_UNDEFINED,
} from '../../lib/sdk/ui-transform-constants';
import { isValidIdentifier } from '../../lib/sdk/operations/validators';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  getAspectLockedNodes,
  getCollapsedGroups,
  getInteractionLayer,
  getPlatform,
  getSelectedNode,
  setAspectLocked,
  setGroupCollapsed,
  setInteractionLayer,
  setPlatform,
} from '../../redux/ui-designer';
import { Block } from '../Block';
import { Container } from '../Container';
import { CheckboxField, Dropdown, RgbaColorField, TextArea, TextField } from '../ui';
import { Pill } from '../ui/Pill';
import { measureParentBox, measureNodeOffset, axisForPath, convertLength } from './measure';
import type { DeviceKind } from './safe-areas';
import { classifyNode, type CanvasSegment, type UINodeType } from './tree-model';
import { WIDGET_ICONS } from './widget-catalog';
import {
  addBindAction,
  addInteractionLayer,
  addInteractionStates,
  addPlatformVariant,
  codeComponentValueForLayer,
  findCodeLayoutParent,
  findCodeNode,
  interactionLayerValue,
  removeInteractionLayer,
  removeInteractionStates,
  removePlatformVariant,
  setInteractionActiveBinding,
  setInteractionField,
  spliceComponentPatch,
  useCodeState,
} from './code/store';
import { INTERACTION_STATES, type InteractionStateKey } from './code/interaction-convention';
import { ComponentRefPanel } from './code/ComponentRefPanel';
import type { CodeUINode } from './code/types';
import {
  type Alignment,
  ALIGNMENTS,
  alignmentToPatch,
  clearAlignmentPatch,
  patchToAlignment,
} from './alignment-presets';
import { absolutePatch, inFlowPatch } from './flow';
import { type OverflowFlag, overflowFlags, overflowPatch } from './overflow-flags';
import { fillOwnsProp } from './resize-modes';
import { AnchorPresetField } from './AnchorPresetField';
import { BindAffordance } from './BindAffordance';
import { BindableField } from './BindableField';
import { BoxModelField } from './BoxModelField';
import { BindableSubField } from './BindableSubField';
import { EmptyState } from './EmptyState';
import { FlowField } from './FlowField';
import { MixedContentField } from './MixedContentField';
import { seedSegments } from './MixedContentField/segments';
import { ResizeField } from './ResizeField';
import { TextureField } from './TextureField';
import { regionToUvs, uvsToRegion } from './uv-region';
import {
  buildGroups,
  isEventGroup,
  POSITION_MODE_FIELD,
  TRANSFORM,
  type FieldConfig,
} from './field-configs';

import './PropertyPanel.css';

type Color4 = { r: number; g: number; b: number; a?: number };

function clampNumber(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

// For a `writeAll` field, replicate a single value across all target paths.
// When `withUnit` is given, also writes each path's `${path}Unit` companion.
function expandWriteAll(
  paths: string[],
  value: unknown,
  withUnit?: { unit: number },
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const p of paths) {
    patch[p] = value;
    if (withUnit) patch[`${p}Unit`] = withUnit.unit;
  }
  return patch;
}

// `auto` is deliberately absent: it is the Resize control's "Hug" mode, and on a
// corner radius or a border width it has no defined behaviour. Hand-authored
// `auto` still reads back (the inputs go disabled — see `numbersDisabled`).
const UNIT_OPTIONS = [
  { value: YGU_POINT, label: 'px' },
  { value: YGU_PERCENT, label: '%' },
];

// The 9 cells plus a reset. "Default" clears both props, which is the only way
// back to Yoga's own defaults (stretch on the cross axis) once they are authored.
const ALIGNMENT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Default' },
  ...ALIGNMENTS.map(a => {
    const [v, h] = a.split('-');
    return { value: a, label: `${v[0].toUpperCase()}${v.slice(1)} ${h}` };
  }),
];

// --- Figma-style add/remove property model (Phase F) ---
// A field is one of three buckets:
//   • core        → always shown (structural props; see field-configs `core`).
//   • togglable   → a simple scalar-ish prop shown only when SET in source, with
//                   a `−` to unset it and a group `+ Add property` entry when
//                   unset. This is what tames the panel clutter.
//   • always-on   → composite / context-gated props (texture, box-model, anchor,
//                   uv-region, event callbacks) that stay visible (subject to
//                   their own hiddenWhen/disabledWhen).
const TOGGLABLE_KINDS = new Set([
  'number',
  'index',
  'boolean',
  'string',
  'string-array',
  'color',
  'enum',
  'length',
  'length-vec',
  'position-mode',
]);

// `hiddenWhen` is deliberately NOT consulted here: a row can be suppressed
// because a composite control currently speaks for its value and still need to be
// addable, which is the only way into a value that composite cannot express.
// The context-gated composites (uv-region, border-rect) stay non-togglable via
// TOGGLABLE_KINDS, which is what actually excluded them.
function isTogglable(field: FieldConfig): boolean {
  return !field.core && TOGGLABLE_KINDS.has(field.kind);
}

// Composite widgets that render full-width (stacked) rather than in the inline
// control column — the nested box-model and the 4-input texture editors need the
// width (Figma stacks these too). The 3×3 anchor grid is compact (~96px) and
// stays inline in the control column.

// The concrete PB paths whose presence means "this field is authored in source".
function fieldSetPaths(field: FieldConfig): string[] {
  if (field.writeAll) return field.writeAll;
  if (field.subFields) return field.subFields.map(s => s.path);
  return field.path ? [field.path] : [];
}

// The parser only populates keys physically present in source (ecs-shape never
// synthesizes proto defaults), so a present key means "explicitly set".
function isFieldSet(field: FieldConfig, value: Record<string, unknown> | null): boolean {
  if (!value) return false;
  return fieldSetPaths(field).some(p => p in value);
}

// "How I sit in my parent" has no meaning on a UI root — its parent is the
// screen. Kept on a root that is ALREADY absolute, though: dragging a root on the
// canvas switches it, and these are then the only controls over the offsets now
// sitting in source (unchecking Ignore Layout Flow puts it back in flow, after
// which they all drop away).
function hiddenOnRoot(
  field: FieldConfig,
  isGuiRoot: boolean,
  value: Record<string, unknown> | null,
): boolean {
  if (!field.hideOnRoot || !isGuiRoot) return false;
  return ((value?.positionType as number | undefined) ?? YGPT_RELATIVE) !== YGPT_ABSOLUTE;
}

// Seed patch written when the user ADDS an optional prop — a sensible default so
// the newly-shown row isn't empty/degenerate (border width 1 so it's visible,
// opacity 1, enums at their default option, lengths in px).
function buildAddPatch(field: FieldConfig): Record<string, unknown> {
  switch (field.kind) {
    case 'number':
      return { [field.path]: field.defaultValue ?? 0 };
    case 'index':
      return { [field.path]: 0 };
    case 'boolean':
      return { [field.path]: false };
    case 'string':
      return { [field.path]: '' };
    case 'string-array':
      return { [field.path]: [] };
    case 'enum':
    case 'position-mode':
      return { [field.path]: field.defaultValue ?? field.options?.[0]?.value ?? 0 };
    case 'color': {
      const black = { r: 0, g: 0, b: 0, a: 1 };
      return field.writeAll ? expandWriteAll(field.writeAll, black) : { [field.path]: black };
    }
    case 'length': {
      const seed = /width/i.test(field.path) ? 1 : 0;
      return field.writeAll
        ? expandWriteAll(field.writeAll, seed, { unit: YGU_POINT })
        : { [field.path]: seed, [`${field.path}Unit`]: YGU_POINT };
    }
    case 'length-vec': {
      const patch: Record<string, unknown> = {};
      for (const s of field.subFields ?? []) {
        patch[s.path] = 0;
        patch[`${s.path}Unit`] = YGU_POINT;
      }
      return patch;
    }
    default:
      return {};
  }
}

// Unset patch written when the user REMOVES a prop — every set path (and its
// `Unit` companion; harmless where none exists) resolves to undefined, which the
// splice layer removes from source (uiTransformPatchEdits / setObjectFields /
// removeAttribute all treat undefined as "delete").
function buildRemovePatch(field: FieldConfig): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const p of fieldSetPaths(field)) {
    patch[p] = undefined;
    patch[`${p}Unit`] = undefined;
  }
  return patch;
}

// Native <details> disclosure — keyboard-accessible with no popover math. Lists
// the group's unset optional props; picking one splices its seed default.
const AddPropertyMenu: React.FC<{ fields: FieldConfig[]; onAdd: (f: FieldConfig) => void }> = ({
  fields,
  onAdd,
}) => {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details
      className="ui-designer-add-prop"
      ref={ref}
    >
      <summary className="ui-designer-add-prop-trigger">
        <AiOutlinePlus aria-hidden />
        Add property
      </summary>
      <ul className="ui-designer-add-prop-menu">
        {fields.map(f => (
          <li key={`${f.componentId}:${f.path}:${f.label}`}>
            <button
              type="button"
              onClick={() => {
                onAdd(f);
                if (ref.current) ref.current.open = false;
              }}
            >
              {f.label}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
};

// The design's `+ Add New Action` at the foot of an events group: declare a
// handler without having to pick an event to hang it off first. It reaches source
// through the same `addBindAction` the per-field 🔗 picker uses, so the new
// handler appears in every event's picker on every node of this UI — which is
// what "then it appears in the dropdowns" means.
//
// Same native <details> disclosure as `+ Add property` (keyboard-accessible, no
// popover math). The design labels the input "Description"; what it produces is
// the handler's NAME, so it has to be a valid identifier — the button stays
// disabled until it is, because the name is spliced into source as code and
// interpolating it raw would be an injection / build-break vector.
const AddActionMenu: React.FC = () => {
  const { bindingSurface } = useCodeState();
  const ref = useRef<HTMLDetailsElement>(null);
  const [name, setName] = useState('');

  const trimmed = name.trim();
  const taken = bindingSurface.actions.some(a => a.name === trimmed);
  const canAdd = isValidIdentifier(trimmed) && !taken;

  const add = () => {
    if (!canAdd) return;
    void addBindAction(trimmed);
    setName('');
    if (ref.current) ref.current.open = false;
  };

  return (
    <details
      className="ui-designer-add-prop"
      ref={ref}
    >
      <summary className="ui-designer-add-prop-trigger">
        <AiOutlinePlus aria-hidden />
        Add New Action
      </summary>
      <div className="ui-designer-add-action">
        <TextField
          aria-label="Description"
          placeholder="Description"
          value={name}
          error={taken ? 'Name already in use' : undefined}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') add();
          }}
        />
        <button
          type="button"
          disabled={!canAdd}
          onClick={add}
        >
          ADD
        </button>
      </div>
    </details>
  );
};

// Human labels for the interaction layers. "Default" reads better than "base"
// in the UI; the code-side key stays `base`.
const LAYER_LABELS: Record<InteractionStateKey, string> = {
  base: 'Default',
  hover: 'Hover',
  press: 'Pressed',
  active: 'Active',
};

const LAYER_HINTS: Record<InteractionStateKey, string> = {
  base: 'The resting style.',
  hover: 'While the pointer is over this node.',
  press: 'While the pointer is held down on this node.',
  active: 'While the bound condition below is true — a selected tab, a checked toggle.',
};

// The interaction-states bar: pick which layer the fields below edit, add a
// layer, or drop interaction styling entirely. A node without interaction states
// shows a single "Add interaction states" affordance instead.
const StatesBar: React.FC<{
  node: CodeUINode;
  entity: Entity;
  layer: InteractionStateKey;
  onPick: (layer: InteractionStateKey) => void;
}> = ({ node, entity, layer, onPick }) => {
  const id = entity as unknown as number;
  const interaction = node.interaction;

  if (!interaction) {
    return (
      <div className="ui-designer-states-bar">
        <button
          type="button"
          className="ui-designer-states-add"
          title="Style this node differently on hover, press, or when active"
          onClick={() => void addInteractionStates(id)}
        >
          <AiOutlinePlus aria-hidden /> Add interaction states
        </button>
      </div>
    );
  }

  const present = interaction.states;
  const missing = INTERACTION_STATES.filter(k => k !== 'base' && !present[k]);

  return (
    <div className="ui-designer-states-bar">
      <div
        className="ui-designer-states-tabs"
        role="tablist"
        aria-label="Interaction state"
      >
        {INTERACTION_STATES.filter(k => k === 'base' || present[k]).map(k => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={k === layer}
            className={`ui-designer-states-tab${k === layer ? ' selected' : ''}`}
            title={LAYER_HINTS[k]}
            onClick={() => onPick(k)}
          >
            {LAYER_LABELS[k]}
          </button>
        ))}
        {missing.map(k => (
          <button
            key={k}
            type="button"
            className="ui-designer-states-tab add"
            title={`Add a ${LAYER_LABELS[k]} state — ${LAYER_HINTS[k]}`}
            onClick={() => {
              void addInteractionLayer(id, k);
              onPick(k);
            }}
          >
            <AiOutlinePlus aria-hidden /> {LAYER_LABELS[k]}
          </button>
        ))}
      </div>
      <div className="ui-designer-states-actions">
        {layer !== 'base' ? (
          <button
            type="button"
            className="ui-designer-prop-remove"
            aria-label={`Remove the ${LAYER_LABELS[layer]} state`}
            title={`Remove the ${LAYER_LABELS[layer]} state`}
            onClick={() => {
              void removeInteractionLayer(id, layer);
              onPick('base');
            }}
          >
            <VscTrash aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            className="ui-designer-prop-remove"
            aria-label="Remove interaction states"
            title="Remove interaction states — keeps the Default style, drops the overrides"
            onClick={() => void removeInteractionStates(id)}
          >
            <VscTrash aria-hidden />
          </button>
        )}
      </div>
      <p className="ui-designer-states-hint">{LAYER_HINTS[layer]}</p>
    </div>
  );
};

// Structural device variants (see code/platform-convention.ts) — a GUI-level
// choice, not a per-node one: the two branches are alternative whole trees, so
// this only renders for the root. Picking a device here switches the whole
// canvas + tree (same state the canvas toggle drives), which is what makes the
// other branch reachable at all.
const PLATFORM_TABS: { key: DeviceKind; label: string; icon: React.ReactNode }[] = [
  { key: 'desktop', label: 'Desktop', icon: <IoDesktopOutline aria-hidden /> },
  { key: 'mobile', label: 'Mobile', icon: <IoPhoneLandscapeOutline aria-hidden /> },
];

const VariantsBar: React.FC<{
  node: CodeUINode;
  entity: Entity;
  // The conditional node itself, when this GUI already has variants. Removal
  // targets it rather than the branch: given a BRANCH id the store keeps the
  // OTHER device's tree, which is the opposite of what "remove, keep what I'm
  // looking at" should do.
  variantEntity?: Entity;
}> = ({ node, entity, variantEntity }) => {
  const dispatch = useAppDispatch();
  const platform = useAppSelector(getPlatform);
  const id = entity as unknown as number;

  if (!node.platform) {
    return (
      <div className="ui-designer-states-bar">
        <button
          type="button"
          className="ui-designer-states-add"
          title="Give this GUI a separate mobile layout — each device gets its own tree"
          onClick={() => void addPlatformVariant(id)}
        >
          <AiOutlinePlus aria-hidden /> Add device variants
        </button>
      </div>
    );
  }

  return (
    <div className="ui-designer-states-bar">
      <div
        className="ui-designer-states-tabs"
        role="tablist"
        aria-label="Device variant"
      >
        {PLATFORM_TABS.map(t => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === platform}
            className={cx('ui-designer-states-tab', { selected: t.key === platform })}
            title={`Edit the ${t.label} layout`}
            onClick={() => dispatch(setPlatform({ platform: t.key }))}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <div className="ui-designer-states-actions">
        <button
          type="button"
          className="ui-designer-prop-remove"
          aria-label="Remove device variants"
          title="Remove device variants — the layout you're editing becomes the only one"
          onClick={() => void removePlatformVariant((variantEntity ?? entity) as unknown as number)}
        >
          <VscTrash aria-hidden />
        </button>
      </div>
      <p className="ui-designer-states-hint">
        This GUI has a separate layout per device. Editing the{' '}
        {platform === 'mobile' ? 'Mobile' : 'Desktop'} tree.
      </p>
    </div>
  );
};

// The boolean driving the `active` layer. It binds through the same
// VariablePicker as any other field (a `boolean` kind already lists the boolean
// state variables), but it writes the helper call's SECOND ARGUMENT rather than a
// JSX attribute — so it owns its picker state instead of reusing
// useFieldBinding, whose onBind targets an attribute.
const ACTIVE_FLAG_FIELD: FieldConfig = {
  label: 'Active when',
  componentId: 'ui::interaction',
  path: 'active',
  kind: 'boolean',
  info: 'While this is true, the Active style applies. Bind it to a boolean variable — a selected tab, a checked toggle.',
};

const ActiveFlagRow: React.FC<{ entity: Entity; expr?: string }> = ({ entity, expr }) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const id = entity as unknown as number;

  return (
    <div className="ui-designer-property-row">
      <Block
        label={ACTIVE_FLAG_FIELD.label}
        info={ACTIVE_FLAG_FIELD.info}
      >
        {expr ? (
          <Pill
            content={expr}
            onRemove={() => void setInteractionActiveBinding(id, undefined)}
          />
        ) : (
          <div className="ui-designer-bindable-row">
            <div className="ui-designer-bindable-content">
              <span className="ui-designer-states-unbound">Always off until bound</span>
            </div>
            <BindAffordance
              field={ACTIVE_FLAG_FIELD}
              anchorRef={anchorRef}
              pickerOpen={pickerOpen}
              setPickerOpen={setPickerOpen}
              onBind={e => {
                void setInteractionActiveBinding(id, e);
                setPickerOpen(false);
              }}
            />
          </div>
        )}
      </Block>
    </div>
  );
};

// Panel header: which KIND of node is selected, plus the eye — the only control
// here that is not a property row. Labelled by kind rather than by a per-node
// name, which the editor has nowhere to store yet.
//
// The eye writes `display`, a real prop: a hidden node also stops rendering in
// the shipped scene, and it can only be reached again from the tree.
const PanelHeader: React.FC<{ node: CodeUINode; hidden: boolean; onToggle: () => void }> = ({
  node,
  hidden,
  onToggle,
}) => (
  <div className={cx('ui-designer-panel-header', { hidden })}>
    <span
      className="ui-designer-panel-header-icon"
      aria-hidden
    >
      {node.opaque ? <IoWarningOutline /> : WIDGET_ICONS[classifyNode(node)]}
    </span>
    <span className="ui-designer-panel-header-name">
      {node.opaque ? node.name : classifyNode(node)}
    </span>
    {node.opaque ? null : (
      <button
        type="button"
        className="ui-designer-panel-header-eye"
        aria-pressed={hidden}
        aria-label={hidden ? 'Show this node' : 'Hide this node'}
        title={
          hidden
            ? 'Show this node'
            : 'Hide this node — it stops rendering in the scene too, not just on the canvas'
        }
        onClick={onToggle}
      >
        {hidden ? <IoEyeOffOutline /> : <IoEyeOutline />}
      </button>
    )}
  </div>
);

const PropertyPanelComponent: React.FC = () => {
  const dispatch = useAppDispatch();
  const selected = useAppSelector(getSelectedNode);
  const collapsed = useAppSelector(getCollapsedGroups);
  const interactionLayer = useAppSelector(getInteractionLayer);

  // Code-mode: the selected node's data comes from the parsed .tsx tree (by its
  // synthetic id), not the ECS engine.
  const codeState = useCodeState();
  const codeNode: CodeUINode | undefined = useMemo(
    () =>
      selected !== null
        ? findCodeNode(
            codeState.parsed?.root as CodeUINode | undefined,
            selected as unknown as number,
          )
        : undefined,
    [codeState, selected],
  );

  const type: UINodeType | null = useMemo(() => codeNode?.type ?? null, [codeNode]);

  // Device variants are a GUI-level choice, so their affordance belongs to the
  // root alone. `useUINodeTree` presents the active branch AS the root, so the
  // node the user perceives as root is either the parsed root itself or one of
  // its branches.
  const isGuiRoot = useMemo(() => {
    const parsedRoot = codeState.parsed?.root;
    if (!parsedRoot || !codeNode) return false;
    if (codeNode === parsedRoot) return true;
    return !!parsedRoot.platformVariant && parsedRoot.children.includes(codeNode);
  }, [codeState, codeNode]);

  // Fill grows along the PARENT's main axis, so the Resize control and the row
  // gate below both need the parent's direction — which the selected node's own
  // component value cannot answer. Read here for the same reason `hideOnRoot` is:
  // the panel is where the tree is in scope. The base layer is the right one to
  // read: an interaction state overriding a parent's direction would be exotic,
  // and the axes would then flip as the pointer moved.
  const parentFlexDirection = useMemo(() => {
    const parent = findCodeLayoutParent(
      codeState.parsed?.root as CodeUINode | undefined,
      selected as unknown as number,
    );
    const t = codeComponentValueForLayer(parent, TRANSFORM, 'base');
    return (t?.flexDirection as number | undefined) ?? 0;
  }, [codeState, selected]);

  // The interaction layer the fields edit. The picked layer is global, so it can
  // be stale for this node (that state may not exist here) — fall back to base.
  const activeLayer: InteractionStateKey = useMemo(
    () =>
      codeNode?.interaction &&
      (interactionLayer === 'base' || codeNode.interaction.states[interactionLayer])
        ? interactionLayer
        : 'base',
    [codeNode, interactionLayer],
  );

  // Bindings come from the parsed source (`node.bindings`, keyed by
  // `componentId.field`): a `value={state.x}` attribute is a single-variable
  // binding, a `value={`…${x}…`}` template is mixed content.
  const { bindingsByField, mixedByField } = useMemo(() => {
    const byField: Record<string, string> = {};
    const mixed: Record<string, CanvasSegment[]> = {};
    for (const row of codeNode?.bindings ?? []) {
      if (row.segments && row.segments.length > 0) mixed[row.field] = row.segments;
      else byField[row.field] = row.variable;
    }
    return { bindingsByField: byField, mixedByField: mixed };
  }, [codeNode]);

  // A node with interaction states keeps ALL of its styles in the helper's
  // layers (base included), so every patch routes there — which is what lets the
  // existing field editors edit any prop in any state without duplicating them.
  const hasInteraction = !!codeNode?.interaction;
  const writeAndDispatch = useCallback(
    (componentId: string, patch: Record<string, unknown>) => {
      if (selected === null) return;
      const id = selected as unknown as number;
      if (hasInteraction) void setInteractionField(id, activeLayer, componentId, patch);
      else void spliceComponentPatch(id, componentId, patch);
    },
    [selected, hasInteraction, activeLayer],
  );

  const readComponentValue = useCallback(
    (componentId: string) => codeComponentValueForLayer(codeNode, componentId, activeLayer),
    [codeNode, activeLayer],
  );

  if (selected === null || type === null) {
    return (
      <EmptyState
        icon={<IoOptionsOutline />}
        title="No node selected"
        message="Select a node on the canvas or in the tree to edit its properties."
      />
    );
  }

  // A nested component reference edits the values passed to the instance (its
  // props), not the generic UiEntity fields.
  if (codeNode?.componentRef) {
    return <ComponentRefPanel node={codeNode} />;
  }

  // A platform variant is the conditional itself — it has no props of its own.
  if (codeNode?.platformVariant) {
    return (
      <EmptyState
        icon={<IoOptionsOutline />}
        title="Device variants"
        message="This node renders a different subtree per device. Pick the Desktop or Mobile branch in the tree — or flip the canvas device toggle — to edit one."
      />
    );
  }

  // The canvas drop wraps `<Name />` in a positioning UiEntity, and canvas
  // clicks select that WRAPPER (the ref block is click-transparent so the
  // wrapper stays draggable) — so surface the nested instance's props here
  // too, below the wrapper's own fields.
  const refChildren = (codeNode?.children ?? []).filter(c => c.componentRef);

  const allGroups = buildGroups(type);
  const transform = readComponentValue(TRANSFORM) as Record<string, unknown> | null;
  const nodeHidden = (transform?.display as number | undefined) === YGD_NONE;
  // Unhiding REMOVES the prop, since react-ecs already defaults to flex. Not in an
  // override layer though: there an absent key means "inherit from Default", so the
  // node would stay hidden and the eye would read as a no-op.
  const unhideValue = activeLayer === 'base' ? undefined : YGD_FLEX;

  // One row, wherever it renders: inside a group or standalone above them.
  // In an override layer, distinguish a field this state actually sets from one
  // merely inherited from Default — the displayed value is merged, so it can't
  // convey that on its own. An inherited field reads dimmed; an overridden one
  // gets a reset (−) back to inherited.
  const renderRow = (field: FieldConfig, value: Record<string, unknown> | null) => {
    const overriding = activeLayer !== 'base';
    const overridden =
      overriding &&
      isFieldSet(field, interactionLayerValue(codeNode, field.componentId, activeLayer));
    const removable = overriding ? overridden : isTogglable(field);
    return (
      <div
        className={cx('ui-designer-property-row', {
          half: field.half,
          overridden: overriding && overridden,
          inherited: overriding && !overridden,
        })}
        key={`${field.componentId}:${field.path}:${field.label}`}
      >
        <FieldRow
          field={field}
          componentValue={value}
          entity={selected as Entity}
          bound={bindingsByField[`${field.componentId}.${field.path}`]}
          bindings={bindingsByField}
          mixed={mixedByField[`${field.componentId}.${field.path}`]}
          parentFlexDirection={parentFlexDirection}
          write={writeAndDispatch}
        />
        {removable ? (
          <button
            type="button"
            className="ui-designer-prop-remove"
            aria-label={
              overriding
                ? `Reset ${field.label ?? 'property'} to its Default value`
                : `Remove ${field.label ?? 'property'}`
            }
            title={
              overriding
                ? `Reset ${field.label ?? 'property'} to its Default value`
                : `Remove ${field.label ?? 'property'}`
            }
            onClick={() => writeAndDispatch(field.componentId, buildRemovePatch(field))}
          >
            <VscTrash aria-hidden />
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="ui-designer-property-panel">
      {codeNode ? (
        <PanelHeader
          node={codeNode}
          hidden={nodeHidden}
          onToggle={() =>
            writeAndDispatch(TRANSFORM, { display: nodeHidden ? unhideValue : YGD_NONE })
          }
        />
      ) : null}
      {/* A nested component's Inputs are the primary thing to edit on an instance,
          so surface them at the TOP — above the wrapper's Layout/Background groups
          (which only position the instance). */}
      {refChildren.map(child => (
        <ComponentRefPanel
          key={child.entity as unknown as number}
          node={child}
        />
      ))}
      {codeNode && !codeNode.opaque ? (
        <>
          <StatesBar
            node={codeNode}
            entity={selected as Entity}
            layer={activeLayer}
            onPick={layer => dispatch(setInteractionLayer({ layer }))}
          />
          {isGuiRoot ? (
            <VariantsBar
              node={codeNode}
              entity={selected as Entity}
              variantEntity={
                codeState.parsed?.root.platformVariant ? codeState.parsed.root.entity : undefined
              }
            />
          ) : null}
        </>
      ) : null}
      {activeLayer === 'active' && codeNode?.interaction ? (
        <ActiveFlagRow
          entity={selected as Entity}
          expr={codeNode.interaction.activeExpr}
        />
      ) : null}
      {/* The design draws Ignore Layout Flow above the first group, not inside one:
          it gates fields in both Position (Anchor/Position) and Layout (margin). */}
      {hiddenOnRoot(POSITION_MODE_FIELD, isGuiRoot, transform)
        ? null
        : renderRow(POSITION_MODE_FIELD, transform)}
      {allGroups.map(group => {
        // Bucket each field: shown (core / set / always-on) → a row (with a `−`
        // when it's an optional set prop); togglable-and-unset → the group's
        // `+ Add property` menu. Field values come from the parsed .tsx node.
        const rows: React.ReactNode[] = [];
        const addable: FieldConfig[] = [];
        // The group consts have narrow inferred field types; treat them uniformly.
        for (const field of group.fields as FieldConfig[]) {
          const value = readComponentValue(field.componentId) as Record<string, unknown> | null;
          if (hiddenOnRoot(field, isGuiRoot, value)) continue;
          const togglable = isTogglable(field);
          // The menu comes FIRST: an unset optional prop belongs in `+ Add property`
          // even while its row is suppressed, or a value the composite control has
          // no cell for (space-between, stretch) would have no way in at all.
          if (togglable && !isFieldSet(field, value)) {
            addable.push(field);
            continue;
          }
          if (field.hiddenWhen?.((value ?? {}) as Record<string, unknown>)) continue;
          // The same rule as `hiddenWhen`, for the two props Resize's Fill mode
          // borrows: their rows stay out of the way exactly while it speaks for
          // them. It lives here because it needs the PARENT's direction to know
          // which prop belongs to which axis.
          if (
            field.componentId === TRANSFORM &&
            fillOwnsProp(field.path, value, parentFlexDirection)
          )
            continue;
          rows.push(renderRow(field, value));
        }
        if (rows.length === 0 && addable.length === 0) return null;
        return (
          <Container
            key={group.title}
            label={group.title}
            initialOpen={!collapsed[group.title]}
            onToggle={open => dispatch(setGroupCollapsed({ title: group.title, collapsed: !open }))}
          >
            <div className="ui-designer-property-rows">{rows}</div>
            {addable.length > 0 ? (
              <AddPropertyMenu
                fields={addable}
                onAdd={f => writeAndDispatch(f.componentId, buildAddPatch(f))}
              />
            ) : null}
            {isEventGroup(group.title) ? <AddActionMenu /> : null}
          </Container>
        );
      })}
    </div>
  );
};

interface LengthVecFieldProps {
  field: FieldConfig;
  componentValue: Record<string, unknown> | null;
  entity: Entity;
  bindings?: Record<string, string>;
  boundProp?: { variable: string };
  fieldDisabled: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
}

// A `length-vec` group (Size / Min / Max / Position). Sub-fields stack in the
// control column with a shared unit selector. When the field declares
// `collapsedSubFields`, it renders that compact projection (Position → X/Y) with
// a reveal toggle to the full edge set (T/R/B/L). The toggle seeds expanded when
// an edge outside the compact set is already authored — a right/bottom-anchored
// node then shows its real values without a manual reveal.
const LengthVecField = React.memo(function LengthVecField({
  field,
  componentValue,
  entity,
  bindings,
  boundProp,
  fieldDisabled,
  onPatch,
}: LengthVecFieldProps) {
  const dispatch = useAppDispatch();
  const aspectLockedMap = useAppSelector(getAspectLockedNodes);
  const aspectLocked = !!field.aspectLockable && !!aspectLockedMap[entity as unknown as number];
  const fullSubs = field.subFields ?? [];
  const compactSubs = field.collapsedSubFields;
  const hasFacade = !!compactSubs && compactSubs.length > 0;
  const extraPaths = hasFacade
    ? fullSubs.filter(s => !compactSubs!.some(c => c.path === s.path)).map(s => s.path)
    : [];
  const autoExpand = !!componentValue && extraPaths.some(p => p in componentValue);
  // null = follow the data (autoExpand); a boolean = the user's explicit choice.
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const expanded = userExpanded ?? autoExpand;
  const subs = hasFacade && !expanded ? compactSubs! : fullSubs;

  const firstUnitKey = subs[0] ? `${subs[0].path}Unit` : '';
  const firstUnitRaw = (componentValue?.[firstUnitKey] as number | undefined) ?? YGU_UNDEFINED;
  const unit = firstUnitRaw === YGU_UNDEFINED ? YGU_POINT : firstUnitRaw;
  // `auto` sizes from the content, so the numbers stop meaning anything.
  const numbersDisabled = fieldDisabled || unit === YGU_AUTO;

  return (
    <BindableField
      field={field}
      entity={entity}
      bound={boundProp}
    >
      {subs.map(sub => {
        const v = (componentValue?.[sub.path] as number | undefined) ?? 0;
        const subBound = bindings?.[`${field.componentId}.${sub.path}`];
        return (
          <BindableSubField
            key={sub.path}
            field={{ componentId: field.componentId, path: sub.path, kind: 'length' }}
            entity={entity}
            bound={subBound}
          >
            <TextField
              type="number"
              leftLabel={sub.leftLabel}
              value={String(v)}
              disabled={numbersDisabled}
              onChange={e => {
                const next = clampNumber(e.target.value);
                const patch: Record<string, unknown> = {
                  [sub.path]: next,
                  [`${sub.path}Unit`]: unit,
                };
                // Aspect lock: scale the sibling axis to preserve the current ratio.
                if (aspectLocked && subs.length === 2) {
                  const other = subs.find(s => s.path !== sub.path);
                  const curThis = (componentValue?.[sub.path] as number | undefined) ?? 0;
                  const curOther = other
                    ? ((componentValue?.[other.path] as number | undefined) ?? 0)
                    : 0;
                  if (other && curThis > 0 && curOther > 0) {
                    patch[other.path] = Math.max(0, Math.round(next * (curOther / curThis)));
                    patch[`${other.path}Unit`] = unit;
                  }
                }
                onPatch(patch);
              }}
            />
          </BindableSubField>
        );
      })}
      <div className="ui-designer-unit-selector">
        {field.aspectLockable ? (
          <button
            type="button"
            className={`ui-designer-vec-lock${aspectLocked ? ' active' : ''}`}
            aria-pressed={aspectLocked}
            aria-label={aspectLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
            title={aspectLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
            onClick={() => dispatch(setAspectLocked({ entity, locked: !aspectLocked }))}
          >
            {aspectLocked ? <IoLockClosedOutline aria-hidden /> : <IoLockOpenOutline aria-hidden />}
          </button>
        ) : null}
        {hasFacade ? (
          <button
            type="button"
            className="ui-designer-vec-reveal"
            aria-expanded={expanded}
            aria-label={expanded ? 'Show X and Y only' : 'Show all edges'}
            onClick={() => setUserExpanded(!expanded)}
          >
            {expanded ? 'X / Y' : 'T R B L'}
          </button>
        ) : null}
        <Dropdown
          options={UNIT_OPTIONS}
          value={unit}
          aria-label="Unit"
          disabled={fieldDisabled}
          onChange={e => {
            const nextUnit = Number(e.target.value);
            const parent = measureParentBox(entity);
            const patch: Record<string, unknown> = {};
            for (const sub of subs) {
              const cur = (componentValue?.[sub.path] as number | undefined) ?? 0;
              const dim = parent ? parent[axisForPath(sub.path)] : 0;
              patch[sub.path] = convertLength(cur, unit, nextUnit, dim);
              patch[`${sub.path}Unit`] = nextUnit;
            }
            onPatch(patch);
          }}
        />
      </div>
    </BindableField>
  );
});

interface FieldRowProps {
  field: FieldConfig;
  componentValue: Record<string, unknown> | null;
  entity: Entity;
  bound?: string;
  bindings?: Record<string, string>;
  mixed?: CanvasSegment[];
  // The PARENT's flexDirection — which axis the Resize control's Fill grows along.
  parentFlexDirection: number;
  // The stable component writer; FieldRow binds it to its own field.componentId.
  // Passing the writer (not a per-field arrow) keeps the prop stable so the
  // memoized row only re-renders when its value/bindings actually change.
  write: (componentId: string, patch: Record<string, unknown>) => void;
}

const FieldRow = React.memo(function FieldRow({
  field,
  componentValue,
  entity,
  bound,
  bindings,
  mixed,
  parentFlexDirection,
  write,
}: FieldRowProps) {
  const onPatch = useCallback(
    (patch: Record<string, unknown>) => write(field.componentId, patch),
    [write, field.componentId],
  );
  const boundProp = bound ? { variable: bound } : undefined;
  const raw = componentValue?.[field.path];
  const fieldDisabled =
    field.disabledWhen?.((componentValue ?? {}) as Record<string, unknown>) ?? false;

  switch (field.kind) {
    case 'string': {
      if (field.mixable) {
        return (
          <Block
            label={field.label}
            info={field.info}
          >
            <MixedContentField
              field={field}
              entity={entity}
              segments={seedSegments(raw, mixed, bound)}
            />
          </Block>
        );
      }
      const v = (raw as string | undefined) ?? '';
      return (
        <BindableField
          field={field}
          entity={entity}
          bound={boundProp}
        >
          <TextField
            value={v}
            onChange={e =>
              onPatch({
                [field.path]: field.sanitize ? field.sanitize(e.target.value) : e.target.value,
              })
            }
          />
        </BindableField>
      );
    }
    case 'number': {
      // `toDisplay`/`fromDisplay` let a field's UI unit differ from the SDK prop's
      // (Transparency is the inverse of `opacity`) without the inversion leaking
      // past this control — source, bindings and the canvas all keep the SDK's own
      // meaning.
      const v = (raw as number | undefined) ?? field.defaultValue ?? 0;
      return (
        <BindableField
          field={field}
          entity={entity}
          bound={boundProp}
        >
          <TextField
            type="number"
            value={String(field.toDisplay ? field.toDisplay(v) : v)}
            onChange={e => {
              const next = clampNumber(e.target.value);
              onPatch({ [field.path]: field.fromDisplay ? field.fromDisplay(next) : next });
            }}
          />
        </BindableField>
      );
    }
    case 'boolean': {
      // Fields stack label-over-control: `BindableField` → `Block` owns the
      // visible Label; the control gets an aria-label for screen readers.
      const v = !!raw;
      return (
        <BindableField
          field={field}
          entity={entity}
          bound={boundProp}
        >
          <CheckboxField
            checked={v}
            aria-label={field.label}
            onChange={e => onPatch({ [field.path]: e.target.checked })}
          />
        </BindableField>
      );
    }
    case 'enum': {
      // An unset value shows the field's in-world default (e.g. textAlign →
      // center), falling back to the zero option.
      const v = (raw as number | undefined) ?? field.defaultValue ?? 0;
      return (
        <BindableField
          field={field}
          entity={entity}
          bound={boundProp}
        >
          <Dropdown
            options={field.options ?? []}
            value={v}
            aria-label={field.label}
            onChange={e => onPatch({ [field.path]: Number(e.target.value) })}
          />
        </BindableField>
      );
    }
    case 'length': {
      // Flat-PB shape: `(value: number, valueUnit: YGUnit)` pair as siblings.
      const unitKey = `${field.path}Unit`;
      const numeric = (componentValue?.[field.path] as number | undefined) ?? 0;
      const unitRaw = (componentValue?.[unitKey] as number | undefined) ?? YGU_UNDEFINED;
      // `YGU_UNDEFINED` is the proto default for never-written fields; surface
      // it in the UI as `pixel` since that's the most common authoring intent.
      const unit = unitRaw === YGU_UNDEFINED ? YGU_POINT : unitRaw;
      return (
        <BindableField
          field={field}
          entity={entity}
          bound={boundProp}
        >
          <div className="ui-designer-length-row">
            <TextField
              type="number"
              value={String(numeric)}
              disabled={unit === YGU_AUTO}
              onChange={e =>
                onPatch(
                  field.writeAll
                    ? expandWriteAll(field.writeAll, clampNumber(e.target.value), { unit })
                    : { [field.path]: clampNumber(e.target.value), [unitKey]: unit },
                )
              }
            />
            <Dropdown
              options={UNIT_OPTIONS}
              value={unit}
              aria-label="Unit"
              onChange={e => {
                const nextUnit = Number(e.target.value);
                const parent = measureParentBox(entity);
                const dim = parent ? parent[axisForPath(field.path)] : 0;
                const nextValue = convertLength(numeric, unit, nextUnit, dim);
                onPatch(
                  field.writeAll
                    ? expandWriteAll(field.writeAll, nextValue, { unit: nextUnit })
                    : { [field.path]: nextValue, [unitKey]: nextUnit },
                );
              }}
            />
          </div>
        </BindableField>
      );
    }
    case 'resize': {
      // The design titles this row "Resize" for a node in flow — where the Fill
      // modes live — and "Size" for an absolute one, which really is just a size.
      // Derived here because the value that decides it (the node's own
      // positionType) is already in this row's hands; field-configs stays static.
      const absolute =
        ((componentValue?.positionType as number | undefined) ?? YGPT_RELATIVE) === YGPT_ABSOLUTE;
      return (
        <Block
          label={absolute ? field.label : 'Resize'}
          info={field.info}
        >
          <ResizeField
            field={field}
            value={componentValue}
            entity={entity}
            bindings={bindings}
            parentFlexDirection={parentFlexDirection}
            onPatch={onPatch}
          />
        </Block>
      );
    }
    case 'overflow-scroll':
    case 'overflow-clip': {
      // Two checkboxes over the one `overflow` enum. Clipping is implied by
      // scrolling, so its box shows checked and goes read-only rather than
      // pretending to be an independent bit (see overflow-flags.ts).
      const flag: OverflowFlag = field.kind === 'overflow-scroll' ? 'scroll' : 'clip';
      const flags = overflowFlags(componentValue);
      return (
        <Block
          label={field.label}
          info={field.info}
        >
          <CheckboxField
            checked={flags[flag]}
            disabled={fieldDisabled || (flag === 'clip' && flags.clipLocked)}
            aria-label={field.label}
            onChange={e => onPatch(overflowPatch(flag, e.target.checked, componentValue))}
          />
        </Block>
      );
    }
    case 'length-vec': {
      return (
        <LengthVecField
          field={field}
          componentValue={componentValue}
          entity={entity}
          bindings={bindings}
          boundProp={boundProp}
          fieldDisabled={fieldDisabled}
          onPatch={onPatch}
        />
      );
    }
    case 'color': {
      const c = (raw as Color4 | undefined) ?? {
        r: 0,
        g: 0,
        b: 0,
        a: 1,
      };
      return (
        <BindableField
          field={field}
          entity={entity}
          bound={boundProp}
        >
          <RgbaColorField
            value={c}
            onChange={next =>
              onPatch(
                field.writeAll ? expandWriteAll(field.writeAll, next) : { [field.path]: next },
              )
            }
          />
        </BindableField>
      );
    }
    case 'texture': {
      // The PBUiBackground `texture` key is a discriminated `TextureUnion`
      // (file / avatar / video variants). `TextureField` owns variant
      // selection, per-variant editing, and file-path validation.
      return (
        <Block
          label={field.label}
          info={field.info}
        >
          <TextureField
            value={componentValue?.texture as TextureUnion | undefined}
            onChange={next => {
              const color = componentValue?.color as
                | { r: number; g: number; b: number; a?: number }
                | undefined;
              const transparent = !color || (color.a ?? 1) === 0;
              // A textured background almost always wants full-opacity display;
              // a transparent tint is only meaningful for a solid color fill.
              const tint = next && transparent ? { color: { r: 1, g: 1, b: 1, a: 1 } } : {};
              onPatch({ texture: next, ...tint });
            }}
          />
        </Block>
      );
    }
    case 'string-array': {
      const arr = (raw as string[] | undefined) ?? [];
      return (
        <BindableField
          field={field}
          entity={entity}
          bound={boundProp}
        >
          <TextArea
            className="ui-designer-string-array"
            aria-label={field.label}
            value={arr.join('\n')}
            onChange={e => onPatch({ [field.path]: e.target.value.split('\n') })}
          />
        </BindableField>
      );
    }
    case 'index': {
      const v = (raw as number | undefined) ?? 0;
      return (
        <BindableField
          field={field}
          entity={entity}
          bound={boundProp}
        >
          <TextField
            type="number"
            value={String(v)}
            onChange={e => onPatch({ [field.path]: clampNumber(e.target.value) })}
          />
        </BindableField>
      );
    }
    case 'callback': {
      return (
        <BindableField
          field={field}
          entity={entity}
          bound={boundProp}
        >
          <span className="ui-designer-callback-hint">Bind an event handler…</span>
        </BindableField>
      );
    }
    case 'position-mode': {
      // Checked = Absolute. Both transitions are mode-preserving: → Absolute bakes
      // the node's on-screen offset so it does not jump, → In flow clears the
      // baked offsets. Shared with the Flow selector's `absolute` cell (flow.ts).
      const absolute = ((raw as number | undefined) ?? YGPT_RELATIVE) === YGPT_ABSOLUTE;
      return (
        <BindableField
          field={field}
          entity={entity}
          bound={boundProp}
        >
          <CheckboxField
            checked={absolute}
            aria-label={field.label}
            onChange={e =>
              onPatch(e.target.checked ? absolutePatch(measureNodeOffset(entity)) : inFlowPatch())
            }
          />
        </BindableField>
      );
    }
    case 'flow': {
      return (
        <Block
          label={field.label}
          info={field.info}
        >
          <FlowField
            value={componentValue}
            entity={entity}
            onPatch={onPatch}
          />
        </Block>
      );
    }
    case 'alignment': {
      // Which prop owns which screen axis depends on the flex direction, so the
      // control reads and writes against the node's CURRENT direction.
      const direction = (componentValue?.flexDirection as number | undefined) ?? 0;
      const current = patchToAlignment(componentValue, direction);
      return (
        <Block
          label={field.label}
          info={field.info}
        >
          <Dropdown
            options={ALIGNMENT_OPTIONS}
            value={current ?? ''}
            aria-label={field.label}
            onChange={e => {
              const next = (e.target as HTMLSelectElement).value as Alignment | '';
              onPatch(next ? alignmentToPatch(next, direction) : clearAlignmentPatch());
            }}
          />
        </Block>
      );
    }
    case 'align-preset': {
      return (
        <Block
          label={field.label}
          info={field.info}
        >
          <AnchorPresetField
            value={componentValue}
            entity={entity}
            disabled={fieldDisabled}
            onPatch={onPatch}
          />
        </Block>
      );
    }
    case 'box-model': {
      return (
        <Block
          label={field.label}
          info={field.info}
        >
          <BoxModelField
            value={componentValue}
            onPatch={onPatch}
          />
        </Block>
      );
    }
    case 'uv-region': {
      const region = uvsToRegion(componentValue?.uvs as number[] | undefined);
      const setField = (key: keyof typeof region, raw: string) =>
        onPatch({ uvs: regionToUvs({ ...region, [key]: clampNumber(raw) }) });
      const rows: { key: keyof typeof region; leftLabel: string }[] = [
        { key: 'uMin', leftLabel: 'U₀' },
        { key: 'vMin', leftLabel: 'V₀' },
        { key: 'uMax', leftLabel: 'U₁' },
        { key: 'vMax', leftLabel: 'V₁' },
      ];
      return (
        <Block
          label={field.label}
          info={field.info}
        >
          {rows.map(r => (
            <TextField
              key={r.key}
              type="number"
              leftLabel={r.leftLabel}
              value={String(region[r.key])}
              onChange={e => setField(r.key, e.target.value)}
            />
          ))}
        </Block>
      );
    }
    case 'border-rect': {
      const rect = (raw as Record<string, number> | undefined) ?? {};
      const setSide = (side: string, v: string) =>
        onPatch({ textureSlices: { ...rect, [side]: clampNumber(v) } });
      const sides: { key: string; leftLabel: string }[] = [
        { key: 'top', leftLabel: 'T' },
        { key: 'right', leftLabel: 'R' },
        { key: 'bottom', leftLabel: 'B' },
        { key: 'left', leftLabel: 'L' },
      ];
      return (
        <Block
          label={field.label}
          info={field.info}
        >
          {sides.map(s => (
            <TextField
              key={s.key}
              type="number"
              leftLabel={s.leftLabel}
              value={String(rect[s.key] ?? 0)}
              onChange={e => setSide(s.key, e.target.value)}
            />
          ))}
        </Block>
      );
    }
    default:
      return null;
  }
});

export const PropertyPanel = React.memo(PropertyPanelComponent);

export default PropertyPanel;
