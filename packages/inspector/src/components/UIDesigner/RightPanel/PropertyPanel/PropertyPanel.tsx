import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  IoClose,
  IoCubeOutline,
  IoDesktopOutline,
  IoEyeOffOutline,
  IoEyeOutline,
  IoOptionsOutline,
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
} from '../../../../lib/sdk/ui-transform-constants';
import { useAppDispatch, useAppSelector } from '../../../../redux/hooks';
import {
  getAspectLockedNodes,
  getCollapsedGroups,
  getHiddenNodes,
  getInteractionLayer,
  getPlatform,
  getSelectedNode,
  setAspectLocked,
  setGroupCollapsed,
  setInteractionLayer,
  setNodeHidden,
  setPlatform,
} from '../../../../redux/ui-designer';
import { Block } from '../../../Block';
import { Container } from '../../../Container';
import { Modal } from '../../../Modal';
import { CheckboxField, Dropdown, RgbaColorField, TextArea, TextField } from '../../../ui';
import { Pill } from '../../../ui/Pill';
import { measureParentBox, axisForPath, convertLength } from '../../shared/measure';
import type { DeviceKind } from '../../shared/safe-areas';
import {
  classifyNode,
  nodeLabelText,
  soleComponentRef,
  type CanvasSegment,
  type UINodeType,
} from '../../shared/tree-model';
import { WIDGET_ICONS } from '../../shared/widget-catalog';
import {
  addInteractionLayer,
  addInteractionStates,
  addPlatformVariant,
  codeComponentValueForLayer,
  findCodeLayoutParent,
  findCodeNode,
  interactionLayerValue,
  removeInteractionLayer,
  removeInteractionStates,
  platformBranchesWithContent,
  removePlatformVariant,
  setInteractionActiveBinding,
  setInteractionField,
  setRootScreenInset,
  spliceComponentPatch,
  useCodeState,
} from '../../code/store';
import type { UiScreenInset } from '../../code/aggregator';
import { INTERACTION_STATES, type InteractionStateKey } from '../../code/interaction-convention';
import { isLayerableComponent } from '../../code/parse-adapter';
import type { CodeUINode } from '../../code/types';
import { clearedCenterMargins } from '../../shared/align-presets';
import { EmptyState } from '../../EmptyState';
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
import { FlowField } from './FlowField';
import { MixedContentField } from './MixedContentField';
import { seedSegments } from './MixedContentField/segments';
import { CallbackField } from './CallbackField';
import { ResizeField } from './ResizeField';
import { FillField } from './FillField';
import { TextAlignField } from './TextAlignField';
import { regionToUvs, uvsToRegion } from './uv-region';
import {
  bindPathFor,
  buildGroups,
  POSITION_MODE_FIELD,
  TRANSFORM,
  type FieldConfig,
} from './field-configs';

import './PropertyPanel.css';

type Color4 = { r: number; g: number; b: number; a?: number };

const TW_WRAP = 0;
const TW_NO_WRAP = 1;

function clampNumber(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

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

const UNIT_OPTIONS = [
  { value: YGU_POINT, label: 'px' },
  { value: YGU_PERCENT, label: '%' },
];

const ALIGNMENT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Default' },
  ...ALIGNMENTS.map(a => {
    const [v, h] = a.split('-');
    return { value: a, label: `${v[0].toUpperCase()}${v.slice(1)} ${h}` };
  }),
];

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

function isTogglable(field: FieldConfig): boolean {
  return !field.core && TOGGLABLE_KINDS.has(field.kind);
}

const CHECKBOX_KINDS = new Set([
  'boolean',
  'position-mode',
  'overflow-scroll',
  'overflow-clip',
  'text-wrap',
]);

function fieldSetPaths(field: FieldConfig): string[] {
  if (field.writeAll) return field.writeAll;
  if (field.subFields) return field.subFields.map(s => s.path);
  return field.path ? [field.path] : [];
}

function isFieldSet(field: FieldConfig, value: Record<string, unknown> | null): boolean {
  if (!value) return false;
  return fieldSetPaths(field).some(p => p in value);
}

/** Whether a field belongs in its group's `+ Add property` menu. */
export function isAddableField(
  field: FieldConfig,
  value: Record<string, unknown> | null,
  boundFields: ReadonlySet<string>,
): boolean {
  return (
    isTogglable(field) &&
    !field.inlineAdd &&
    !isFieldSet(field, value) &&
    !boundFields.has(`${field.componentId}.${field.path}`)
  );
}

/** Whether an inline-addable field shows its `+` stub rather than its control. */
export function isInlineStub(field: FieldConfig, value: Record<string, unknown> | null): boolean {
  return !!field.inlineAdd && !isFieldSet(field, value);
}

const isAbsolute = (value: Record<string, unknown> | null | undefined): boolean =>
  ((value?.positionType as number | undefined) ?? YGPT_RELATIVE) === YGPT_ABSOLUTE;

function hiddenOnRoot(
  field: FieldConfig,
  isGuiRoot: boolean,
  value: Record<string, unknown> | null,
): boolean {
  if (!field.hideOnRoot || !isGuiRoot) return false;
  return !isAbsolute(value);
}

/** Whether to drop "Ignore Layout Flow" because the node's PARENT is itself absolutely positioned. */
export function hiddenUnderAbsoluteParent(
  parentInFlow: boolean,
  value: Record<string, unknown> | null,
): boolean {
  return !parentInFlow && !isAbsolute(value);
}

/** Seed patch written when the user ADDS an optional prop — a sensible default plus whatever `addAlso` declares. */
export function buildAddPatch(field: FieldConfig): Record<string, unknown> {
  return { ...seedPatch(field), ...field.addAlso };
}

function seedPatch(field: FieldConfig): Record<string, unknown> {
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

function buildRemovePatch(field: FieldConfig): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const p of fieldSetPaths(field)) {
    patch[p] = undefined;
    patch[`${p}Unit`] = undefined;
  }
  for (const p of Object.keys(field.addAlso ?? {})) patch[p] = undefined;
  return patch;
}

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

const LAYER_LABELS: Record<InteractionStateKey, string> = {
  base: 'Default',
  hover: 'Hover',
  press: 'Pressed',
  active: 'Selected',
};

const LAYER_HINTS: Record<InteractionStateKey, string> = {
  base: 'The resting style.',
  hover: 'While the pointer is over this node.',
  press: 'While the pointer is held down on this node.',
  active: 'While the bound condition below is true — a selected tab, a checked toggle.',
};

const STATES_INFO =
  'Style this node differently while the pointer is over it, while it is held down, or while a bound condition is true.';

const StatesBar: React.FC<{
  node: CodeUINode;
  entity: Entity;
  layer: InteractionStateKey;
  onPick: (layer: InteractionStateKey) => void;
}> = ({ node, entity, layer, onPick }) => {
  const id = entity as unknown as number;
  const interaction = node.interaction;

  const addLayer = (key: InteractionStateKey) => {
    void addInteractionLayer(id, key);
    onPick(key);
  };

  return (
    <div className="ui-designer-states-bar">
      <Block
        label="Interaction States"
        info={STATES_INFO}
        className="ui-designer-section-header"
      >
        {interaction ? (
          <button
            type="button"
            className="ui-designer-prop-remove"
            aria-label={
              layer === 'base'
                ? 'Remove interaction states'
                : `Remove the ${LAYER_LABELS[layer]} state`
            }
            title={
              layer === 'base'
                ? 'Remove interaction states — keeps the Default style, drops the overrides'
                : `Remove the ${LAYER_LABELS[layer]} state`
            }
            onClick={() => {
              if (layer === 'base') {
                void removeInteractionStates(id);
              } else {
                void removeInteractionLayer(id, layer);
                onPick('base');
              }
            }}
          >
            <VscTrash aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            className="ui-designer-prop-add"
            aria-label="Add interaction states"
            title={STATES_INFO}
            onClick={() => void addInteractionStates(id)}
          >
            <AiOutlinePlus aria-hidden />
          </button>
        )}
      </Block>
      {interaction ? (
        <>
          <div
            className="ui-designer-states-tabs"
            role="tablist"
            aria-label="Interaction state"
          >
            {INTERACTION_STATES.map(key => {
              const present = key === 'base' || !!interaction.states[key];
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={present && key === layer}
                  aria-disabled={!present}
                  className={cx('ui-designer-states-tab', {
                    selected: present && key === layer,
                    absent: !present,
                  })}
                  title={
                    present
                      ? LAYER_HINTS[key]
                      : `Add a ${LAYER_LABELS[key]} state — ${LAYER_HINTS[key]}`
                  }
                  onClick={() => (present ? onPick(key) : addLayer(key))}
                >
                  {LAYER_LABELS[key]}
                </button>
              );
            })}
          </div>
          <p className="ui-designer-states-hint">{LAYER_HINTS[layer]}</p>
        </>
      ) : null}
    </div>
  );
};

const PLATFORM_TABS: { key: DeviceKind; label: string; icon: React.ReactNode }[] = [
  { key: 'desktop', label: 'Desktop', icon: <IoDesktopOutline aria-hidden /> },
  { key: 'mobile', label: 'Mobile', icon: <IoPhoneLandscapeOutline aria-hidden /> },
];

const VARIANTS_INFO =
  'Give this GUI a separate mobile layout — each device gets its own tree, and the scene picks one at runtime.';

const VariantsBar: React.FC<{
  node: CodeUINode;
  entity: Entity;
  variantEntity?: Entity;
}> = ({ node, entity, variantEntity }) => {
  const dispatch = useAppDispatch();
  const platform = useAppSelector(getPlatform);
  const other: DeviceKind = platform === 'mobile' ? 'desktop' : 'mobile';
  const id = entity as unknown as number;
  const removeTarget = (variantEntity ?? entity) as unknown as number;
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleRemove = () => {
    const branches = platformBranchesWithContent(removeTarget);
    if (branches[platform]) setConfirmOpen(true);
    else void removePlatformVariant(removeTarget, other);
  };

  const confirmDelete = () => {
    setConfirmOpen(false);
    void removePlatformVariant(removeTarget, other);
  };

  return (
    <div className="ui-designer-states-bar">
      <Block
        label="Device Variants"
        info={VARIANTS_INFO}
        className="ui-designer-section-header"
      >
        {node.platform ? (
          <button
            type="button"
            className="ui-designer-prop-remove"
            aria-label="Remove device variants"
            title="Remove device variants — the layout you're editing becomes the only one"
            onClick={handleRemove}
          >
            <VscTrash aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            className="ui-designer-prop-add"
            aria-label="Add device variants"
            title={VARIANTS_INFO}
            onClick={() => void addPlatformVariant(id)}
          >
            <AiOutlinePlus aria-hidden />
          </button>
        )}
      </Block>
      {node.platform ? (
        <>
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
          <p className="ui-designer-states-hint">
            This GUI has a separate layout per device. Editing the{' '}
            {platform === 'mobile' ? 'Mobile' : 'Desktop'} tree.
          </p>
        </>
      ) : null}
      <Modal
        isOpen={confirmOpen}
        onRequestClose={() => setConfirmOpen(false)}
        className="ui-designer-variant-remove-modal"
      >
        <button
          type="button"
          className="close"
          aria-label="Close"
          onClick={() => setConfirmOpen(false)}
        >
          <IoClose />
        </button>
        <div className="content">
          <h2 className="title">Delete {platform === 'mobile' ? 'Mobile' : 'Desktop'} Variant</h2>
          <div className="description">
            Deleting the {platform === 'mobile' ? 'Mobile' : 'Desktop'} layout will delete its
            device specific settings. Your {other === 'mobile' ? 'Mobile' : 'Desktop'} layout will
            remain unchanged.
          </div>
        </div>
        <div className="actions">
          <button
            type="button"
            className="ui-designer-modal-btn"
            onClick={() => setConfirmOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ui-designer-modal-btn danger"
            onClick={confirmDelete}
          >
            Delete {platform === 'mobile' ? 'Mobile' : 'Desktop'}
          </button>
        </div>
      </Modal>
    </div>
  );
};

const ACTIVE_FLAG_FIELD: FieldConfig = {
  label: 'Selected when',
  componentId: 'ui::interaction',
  path: 'active',
  kind: 'boolean',
  info: 'While this is true, the Selected style applies. Bind it to a boolean variable — a selected tab, a checked toggle.',
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
            removeLabel={`Unbind ${expr} from ${ACTIVE_FLAG_FIELD.label}`}
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
      {node.opaque ? (
        <IoWarningOutline />
      ) : node.componentRef || soleComponentRef(node) ? (
        <IoCubeOutline />
      ) : (
        WIDGET_ICONS[classifyNode(node)]
      )}
    </span>
    <span className="ui-designer-panel-header-name">{nodeLabelText(node)}</span>
    {node.opaque ? null : (
      <button
        type="button"
        className="ui-designer-panel-header-eye"
        aria-pressed={hidden}
        aria-label={hidden ? 'Show this node on the canvas' : 'Hide this node on the canvas'}
        title={
          hidden
            ? 'Show this node on the canvas'
            : 'Hide this node on the canvas — it still renders in the scene. Use Visibility is Active to remove it from the scene.'
        }
        onClick={onToggle}
      >
        {hidden ? <IoEyeOffOutline /> : <IoEyeOutline />}
      </button>
    )}
  </div>
);

/** The `display` value meaning "visible" for the layer being edited. */
export function visibleDisplayValue(layer: InteractionStateKey): number | undefined {
  return layer === 'base' ? undefined : YGD_FLEX;
}

const VisibleRow: React.FC<{ visible: boolean; onToggle: (visible: boolean) => void }> = ({
  visible,
  onToggle,
}) => (
  <div className="ui-designer-property-row checkbox">
    <Block
      label="Visibility is Active"
      info="Off removes the node from the scene entirely — it stops rendering and stops taking up layout space. The eye above only hides it on the canvas."
    >
      <CheckboxField
        checked={visible}
        aria-label="Visibility is Active"
        onChange={e => onToggle(e.target.checked)}
      />
    </Block>
  </div>
);

const SCENE_INSET_OPTIONS: { value: UiScreenInset; label: string }[] = [
  { value: 'device', label: 'Device Safe Area' },
  { value: 'interactable', label: 'Gameplay Safe Area' },
  { value: 'none', label: 'Full Screen' },
];

const SCENE_INSET_INFO =
  'Which screen area this GUI is placed in. Full Screen uses the entire renderable screen. Gameplay Safe Area excludes game-native UI such as chat, minimap and HUD indicators. Device Safe Area (mobile only) excludes physical constraints such as the notch, Dynamic Island and system bars. Requires @dcl/react-ecs 7.26.0+ in your scene.';

/** Screen area the whole GUI is placed in — a root-only, per-scene-root choice. */
const SceneInsetRow: React.FC<{
  value: UiScreenInset;
  onChange: (value: UiScreenInset) => void;
}> = ({ value, onChange }) => {
  const isMobile = useAppSelector(getPlatform) === 'mobile';
  const options = isMobile
    ? SCENE_INSET_OPTIONS
    : SCENE_INSET_OPTIONS.filter(o => o.value !== 'device');
  const deviceEqualsFullScreen = !isMobile && value === 'device';
  const displayValue = deviceEqualsFullScreen ? 'none' : value;
  return (
    <div className="ui-designer-property-row">
      <Block
        label="Scene Inset"
        info={SCENE_INSET_INFO}
      >
        <Dropdown
          options={options}
          value={displayValue}
          aria-label="Scene Inset"
          onChange={e => onChange(e.target.value as UiScreenInset)}
        />
      </Block>
    </div>
  );
};

const PropertyPanelComponent: React.FC = () => {
  const dispatch = useAppDispatch();
  const selected = useAppSelector(getSelectedNode);
  const collapsed = useAppSelector(getCollapsedGroups);
  const hiddenNodes = useAppSelector(getHiddenNodes);
  const interactionLayer = useAppSelector(getInteractionLayer);

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

  const isGuiRoot = useMemo(() => {
    const parsedRoot = codeState.parsed?.root;
    if (!parsedRoot || !codeNode) return false;
    if (codeNode === parsedRoot) return true;
    return !!parsedRoot.platformVariant && parsedRoot.children.includes(codeNode);
  }, [codeState, codeNode]);

  const activeRoot = useMemo(
    () => codeState.roots.find(r => r.filename === codeState.filename),
    [codeState.roots, codeState.filename],
  );

  const parentTransform = useMemo(() => {
    const parent = findCodeLayoutParent(
      codeState.parsed?.root as CodeUINode | undefined,
      selected as unknown as number,
    );
    return codeComponentValueForLayer(parent, TRANSFORM, 'base');
  }, [codeState, selected]);

  const parentFlexDirection = (parentTransform?.flexDirection as number | undefined) ?? 0;
  const parentInFlow = !isAbsolute(parentTransform);

  const activeLayer: InteractionStateKey = useMemo(
    () =>
      codeNode?.interaction &&
      (interactionLayer === 'base' || codeNode.interaction.states[interactionLayer])
        ? interactionLayer
        : 'base',
    [codeNode, interactionLayer],
  );

  const { bindingsByField, mixedByField, boundFields } = useMemo(() => {
    const byField: Record<string, string> = {};
    const mixed: Record<string, CanvasSegment[]> = {};
    for (const row of codeNode?.bindings ?? []) {
      if (row.segments && row.segments.length > 0) mixed[row.field] = row.segments;
      else byField[row.field] = row.variable;
    }
    return {
      bindingsByField: byField,
      mixedByField: mixed,
      boundFields: new Set([...Object.keys(byField), ...Object.keys(mixed)]),
    };
  }, [codeNode]);

  const hasInteraction = !!codeNode?.interaction;
  const writeAndDispatch = useCallback(
    (componentId: string, patch: Record<string, unknown>) => {
      if (selected === null) return;
      const id = selected as unknown as number;
      if (hasInteraction && isLayerableComponent(componentId)) {
        void setInteractionField(id, activeLayer, componentId, patch);
      } else {
        void spliceComponentPatch(id, componentId, patch);
      }
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
        message={
          <>
            Select a <strong>node</strong> to start editing its properties.
          </>
        }
      />
    );
  }

  if (codeNode?.componentRef) {
    return (
      <EmptyState
        icon={<IoCubeOutline />}
        title={codeNode.componentRef.name ?? 'Component'}
      />
    );
  }

  if (codeNode?.platformVariant) {
    return (
      <EmptyState
        icon={<IoOptionsOutline />}
        title="Device variants"
        message="This node renders a different subtree per device. Pick the Desktop or Mobile branch in the tree — or flip the canvas device toggle — to edit one."
      />
    );
  }

  const allGroups = buildGroups(type);
  const transform = readComponentValue(TRANSFORM) as Record<string, unknown> | null;
  const displayNone = (transform?.display as number | undefined) === YGD_NONE;
  const canvasHidden = !!hiddenNodes[selected as unknown as number];

  const renderRow = (field: FieldConfig, value: Record<string, unknown> | null) => {
    const overriding = activeLayer !== 'base' && isLayerableComponent(field.componentId);
    const overridden =
      overriding &&
      isFieldSet(field, interactionLayerValue(codeNode, field.componentId, activeLayer));
    const removable = overriding ? overridden : isTogglable(field);
    return (
      <div
        className={cx('ui-designer-property-row', {
          half: field.half,
          checkbox: CHECKBOX_KINDS.has(field.kind),
          overridden: overriding && overridden,
          inherited: overriding && !overridden,
        })}
        key={`${field.componentId}:${field.path}:${field.label}`}
      >
        <FieldRow
          field={field}
          componentValue={value}
          entity={selected as Entity}
          bound={bindingsByField[`${field.componentId}.${bindPathFor(field)}`]}
          bindings={bindingsByField}
          mixed={mixedByField[`${field.componentId}.${field.path}`]}
          parentFlexDirection={parentFlexDirection}
          overriding={overriding}
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

  const renderStub = (field: FieldConfig) => (
    <div
      className="ui-designer-property-row stub"
      key={`${field.componentId}:${field.path}:${field.label}`}
    >
      <Block
        label={field.label}
        info={field.info}
        className="ui-designer-prop-stub"
      >
        <button
          type="button"
          className="ui-designer-prop-add"
          aria-label={`Add ${field.label ?? 'property'}`}
          title={`Add ${field.label ?? 'property'}`}
          onClick={() => writeAndDispatch(field.componentId, buildAddPatch(field))}
        >
          <AiOutlinePlus aria-hidden />
        </button>
      </Block>
    </div>
  );

  return (
    <div className="ui-designer-property-panel">
      {codeNode ? (
        <div className="ui-designer-panel-header-block">
          <PanelHeader
            node={codeNode}
            hidden={canvasHidden}
            onToggle={() =>
              dispatch(setNodeHidden({ entity: selected as Entity, hidden: !canvasHidden }))
            }
          />
          {codeNode.opaque ? null : (
            <div className="ui-designer-panel-header-checks">
              <VisibleRow
                visible={!displayNone}
                onToggle={visible =>
                  writeAndDispatch(TRANSFORM, {
                    display: visible ? visibleDisplayValue(activeLayer) : YGD_NONE,
                  })
                }
              />
              {isGuiRoot && activeRoot?.topLevel && codeState.filename ? (
                <SceneInsetRow
                  value={activeRoot.screenInset}
                  onChange={inset => setRootScreenInset(codeState.filename as string, inset)}
                />
              ) : null}
              {hiddenOnRoot(POSITION_MODE_FIELD, isGuiRoot, transform) ||
              hiddenUnderAbsoluteParent(parentInFlow, transform)
                ? null
                : renderRow(POSITION_MODE_FIELD, transform)}
            </div>
          )}
        </div>
      ) : null}
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
      {allGroups.map(group => {
        const rows: React.ReactNode[] = [];
        const addable: FieldConfig[] = [];
        for (const field of group.fields as FieldConfig[]) {
          const value = readComponentValue(field.componentId) as Record<string, unknown> | null;
          if (hiddenOnRoot(field, isGuiRoot, value)) continue;
          if (isAddableField(field, value, boundFields)) {
            addable.push(field);
            continue;
          }
          if (isInlineStub(field, value)) {
            rows.push(renderStub(field));
            continue;
          }
          if (field.hiddenWhen?.((value ?? {}) as Record<string, unknown>)) continue;
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
  const subs = field.facadeSubFields?.(componentValue) ?? field.subFields ?? [];

  const firstUnitKey = subs[0] ? `${subs[0].path}Unit` : '';
  const firstUnitRaw = (componentValue?.[firstUnitKey] as number | undefined) ?? YGU_UNDEFINED;
  const unit = firstUnitRaw === YGU_UNDEFINED ? YGU_POINT : firstUnitRaw;
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
          />
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
  parentFlexDirection: number;
  overriding: boolean;
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
  overriding,
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

  const bindable = (control: React.ReactNode) => (
    <BindableField
      field={field}
      entity={entity}
      bound={boundProp}
    >
      {control}
    </BindableField>
  );

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
      return bindable(
        <TextField
          value={v}
          onChange={e =>
            onPatch({
              [field.path]: field.sanitize ? field.sanitize(e.target.value) : e.target.value,
            })
          }
        />,
      );
    }
    case 'number': {
      const v = (raw as number | undefined) ?? field.defaultValue ?? 0;
      return bindable(
        <TextField
          type="number"
          rightLabel={field.suffix}
          value={String(field.toDisplay ? field.toDisplay(v) : v)}
          onChange={e => {
            const next = clampNumber(e.target.value);
            onPatch({ [field.path]: field.fromDisplay ? field.fromDisplay(next) : next });
          }}
        />,
      );
    }
    case 'boolean': {
      const v = !!raw;
      return bindable(
        <CheckboxField
          checked={v}
          aria-label={field.label}
          onChange={e => onPatch({ [field.path]: e.target.checked })}
        />,
      );
    }
    case 'enum': {
      const v = (raw as number | undefined) ?? field.defaultValue ?? 0;
      return bindable(
        <Dropdown
          options={field.options ?? []}
          value={v}
          aria-label={field.label}
          onChange={e => onPatch({ [field.path]: Number(e.target.value) })}
        />,
      );
    }
    case 'length': {
      const unitKey = `${field.path}Unit`;
      const numeric = (componentValue?.[field.path] as number | undefined) ?? 0;
      const unitRaw = (componentValue?.[unitKey] as number | undefined) ?? YGU_UNDEFINED;
      const unit = unitRaw === YGU_UNDEFINED ? YGU_POINT : unitRaw;
      return bindable(
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
        </div>,
      );
    }
    case 'resize': {
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
            overriding={overriding}
            onPatch={onPatch}
          />
        </Block>
      );
    }
    case 'overflow-scroll':
    case 'overflow-clip': {
      const flag: OverflowFlag = field.kind === 'overflow-scroll' ? 'scroll' : 'clip';
      const flags = overflowFlags(componentValue);
      return bindable(
        <CheckboxField
          checked={flags[flag]}
          disabled={fieldDisabled || (flag === 'clip' && flags.clipLocked)}
          aria-label={field.label}
          onChange={e => onPatch(overflowPatch(flag, e.target.checked, componentValue))}
        />,
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
      return bindable(
        <RgbaColorField
          value={c}
          onChange={next =>
            onPatch(field.writeAll ? expandWriteAll(field.writeAll, next) : { [field.path]: next })
          }
        />,
      );
    }
    case 'fill': {
      return bindable(
        <FillField
          key={entity}
          color={componentValue?.color as Color4 | undefined}
          texture={componentValue?.texture as TextureUnion | undefined}
          entity={entity}
          bindings={bindings}
          onPatch={onPatch}
        />,
      );
    }
    case 'text-align': {
      return bindable(
        <TextAlignField
          value={raw as number | undefined}
          onChange={mode => onPatch({ [field.path]: mode })}
        />,
      );
    }
    case 'text-wrap': {
      return bindable(
        <CheckboxField
          checked={((raw as number | undefined) ?? TW_WRAP) === TW_WRAP}
          aria-label={field.label}
          onChange={e => onPatch({ [field.path]: e.target.checked ? TW_WRAP : TW_NO_WRAP })}
        />,
      );
    }
    case 'string-array': {
      const arr = (raw as string[] | undefined) ?? [];
      return bindable(
        <TextArea
          className="ui-designer-string-array"
          aria-label={field.label}
          value={arr.join('\n')}
          onChange={e => onPatch({ [field.path]: e.target.value.split('\n') })}
        />,
      );
    }
    case 'index': {
      const v = (raw as number | undefined) ?? 0;
      return bindable(
        <TextField
          type="number"
          value={String(v)}
          onChange={e => onPatch({ [field.path]: clampNumber(e.target.value) })}
        />,
      );
    }
    case 'callback': {
      return (
        <CallbackField
          field={field}
          entity={entity}
          bound={bound}
        />
      );
    }
    case 'position-mode': {
      const absolute = ((raw as number | undefined) ?? YGPT_RELATIVE) === YGPT_ABSOLUTE;
      return bindable(
        <CheckboxField
          checked={absolute}
          aria-label={field.label}
          onChange={e =>
            onPatch(
              e.target.checked
                ? absolutePatch()
                : { ...inFlowPatch(), ...clearedCenterMargins(componentValue) },
            )
          }
        />,
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
            onPatch={onPatch}
          />
        </Block>
      );
    }
    case 'alignment': {
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
            componentId={field.componentId}
            entity={entity}
            box={field.box ?? 'padding'}
            bindings={bindings}
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
