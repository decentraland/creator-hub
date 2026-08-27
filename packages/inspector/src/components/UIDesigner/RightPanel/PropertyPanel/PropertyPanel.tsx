import React from 'react';
import { useCallback } from 'react';
import { useMemo } from 'react';
import { useRef } from 'react';
import { useState } from 'react';
import { AiOutlinePlus } from 'react-icons/ai';
import { IoClose } from 'react-icons/io5';
import { IoCubeOutline } from 'react-icons/io5';
import { IoDesktopOutline } from 'react-icons/io5';
import { IoEyeOffOutline } from 'react-icons/io5';
import { IoEyeOutline } from 'react-icons/io5';
import { IoOptionsOutline } from 'react-icons/io5';
import { IoPhoneLandscapeOutline } from 'react-icons/io5';
import { IoWarningOutline } from 'react-icons/io5';
import { VscTrash } from 'react-icons/vsc';
import cx from 'classnames';
import type { Entity } from '@dcl/ecs';
import { classifyNode } from '../../shared/tree-model';
import { codeComponentValueForLayer } from '../../code/store';
import { addPlatformVariant } from '../../code/store';
import { addInteractionStates } from '../../code/store';
import { addInteractionLayer } from '../../code/store';
import { YGD_NONE } from '../../../../lib/sdk/ui-transform-constants';
import { YGD_FLEX } from '../../../../lib/sdk/ui-transform-constants';
import { WIDGET_ICONS } from '../../shared/widget-catalog';
import type { UiScreenInset } from '../../code/aggregator';
import type { UINodeType } from '../../shared/tree-model';
import { Pill } from '../../../ui/Pill';
import { Modal } from '../../../Modal';
import type { InteractionStateKey } from '../../code/interaction-convention';
import { INTERACTION_STATES } from '../../code/interaction-convention';
import { EmptyState } from '../../EmptyState';
import { Dropdown } from '../../../ui';
import type { DeviceKind } from '../../shared/safe-areas';
import { Container } from '../../../Container';
import type { CodeUINode } from '../../code/types';
import { CheckboxField } from '../../../ui';
import type { CanvasSegment } from '../../shared/tree-model';
import { Block } from '../../../Block';
import { findCodeLayoutParent } from '../../code/store';
import { findCodeNode } from '../../code/store';
import { getCollapsedGroups } from '../../../../redux/ui-designer';
import { getHiddenNodes } from '../../../../redux/ui-designer';
import { getInteractionLayer } from '../../../../redux/ui-designer';
import { getPlatform } from '../../../../redux/ui-designer';
import { getSelectedNode } from '../../../../redux/ui-designer';
import { interactionLayerValue } from '../../code/store';
import { isLayerableComponent } from '../../code/parse-adapter';
import { nodeLabelText } from '../../shared/tree-model';
import { platformBranchesWithContent } from '../../code/store';
import { removeInteractionLayer } from '../../code/store';
import { removeInteractionStates } from '../../code/store';
import { removePlatformVariant } from '../../code/store';
import { setGroupCollapsed } from '../../../../redux/ui-designer';
import { setInteractionActiveBinding } from '../../code/store';
import { setInteractionField } from '../../code/store';
import { setInteractionLayer } from '../../../../redux/ui-designer';
import { setNodeHidden } from '../../../../redux/ui-designer';
import { setPlatform } from '../../../../redux/ui-designer';
import { setRootScreenInset } from '../../code/store';
import { soleComponentRef } from '../../shared/tree-model';
import { spliceComponentPatch } from '../../code/store';
import { useAppDispatch } from '../../../../redux/hooks';
import { useAppSelector } from '../../../../redux/hooks';
import { useCodeState } from '../../code/store';
import { buildRemovePatch } from './field-helpers';
import { buildGroups } from './field-configs';
import { buildAddPatch } from './field-helpers';
import { bindPathFor } from './field-configs';
import { TRANSFORM } from './field-configs';
import { POSITION_MODE_FIELD } from './field-configs';
import { FieldRow } from './FieldRow';
import type { FieldConfig } from './field-configs';
import { isTogglable } from './field-helpers';
import { isInlineStub } from './field-helpers';
import { isFieldSet } from './field-helpers';
import { isAddableField } from './field-helpers';
import { isAbsolute } from './field-helpers';
import { hiddenUnderAbsoluteParent } from './field-helpers';
import { fillOwnsProp } from './resize-modes';
import { CHECKBOX_KINDS } from './field-helpers';
import { hiddenOnRoot } from './field-helpers';
import { BindAffordance } from './BindAffordance';
import './PropertyPanel.css';

export {
  buildAddPatch,
  hiddenUnderAbsoluteParent,
  isAddableField,
  isInlineStub,
} from './field-helpers';

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

export const PropertyPanel = React.memo(PropertyPanelComponent);

export default PropertyPanel;
