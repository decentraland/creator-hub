import { Entity, IEngine } from '@dcl/ecs';
import ReactEcs, { Dropdown, Label, UiEntity } from '@dcl/react-ecs';
import { Color4 } from '@dcl/sdk/math';
import { Action, AdminTools, getActionEvents, getComponents, getPayload } from '../definitions';
import { getExplorerComponents } from '../components';
import { getScaleUIFactor } from '../ui';
import { Button } from './Button';
import { CONTENT_URL } from './constants';
import { State } from './types';
import { Header } from './Header';
import { Card } from './Card';
import { getSmartItems } from '.';

// Constants
const ICONS = {
  SMART_ITEM_CONTROL: `${CONTENT_URL}/admin_toolkit/assets/icons/smart-item-control.png`,
} as const;

function getSmartItemActions(
  engine: IEngine,
  smartItem: NonNullable<AdminTools['smartItemsControl']['smartItems']>[0],
) {
  const { Actions } = getComponents(engine);
  if (!smartItem || !Actions.has(smartItem.entity as Entity)) return [];

  const actions = Array.from(Actions.get(smartItem.entity as Entity).value);
  return actions;
}

// Event Handlers
function handleExecuteAction(
  smartItem: NonNullable<AdminTools['smartItemsControl']['smartItems']>[0],
  action: Action,
) {
  const actionEvents = getActionEvents(smartItem.entity as Entity);
  actionEvents.emit(action.name, getPayload(action));
}

function handleSelectSmartItem(
  state: State,
  smartItems: NonNullable<AdminTools['smartItemsControl']['smartItems']>,
  idx: number,
) {
  state.smartItemsControl.selectedSmartItem = idx;
  const smartItem = smartItems[idx];

  if (!state.smartItemsControl.smartItems.has(smartItem.entity as Entity)) {
    const stateSmartItems = new Map(state.smartItemsControl.smartItems);
    stateSmartItems.set(smartItem.entity as Entity, {
      visible: true,
      selectedAction: smartItem.defaultAction,
    });
    state.smartItemsControl = {
      ...state.smartItemsControl,
      smartItems: new Map(stateSmartItems),
    };
  }
}

function handleSelectAction(
  state: State,
  smartItem: NonNullable<AdminTools['smartItemsControl']['smartItems']>[0],
  action: Action,
) {
  const stateSmartItems = new Map(state.smartItemsControl.smartItems);
  stateSmartItems.set(smartItem.entity as Entity, {
    ...stateSmartItems.get(smartItem.entity as Entity)!,
    selectedAction: action.name,
  });

  state.smartItemsControl = {
    ...state.smartItemsControl,
    smartItems: new Map(stateSmartItems),
  };
}

function handleHideShowEntity(
  engine: IEngine,
  state: State,
  smartItems: NonNullable<AdminTools['smartItemsControl']['smartItems']>,
) {
  const { VisibilityComponent } = getExplorerComponents(engine);

  const smartItemEntity = smartItems[state.smartItemsControl.selectedSmartItem!].entity as Entity;
  const smartItem = state.smartItemsControl.smartItems.get(smartItemEntity);

  const toggleVisibility = !smartItem!.visible;
  state.smartItemsControl.smartItems.get(smartItemEntity)!.visible = toggleVisibility;

  const visibility = VisibilityComponent.getOrCreateMutable(smartItemEntity);
  visibility.visible = toggleVisibility;
}

function SmartItemSelector({
  engine,
  smartItems,
  selectedIndex,
  onSelect,
}: {
  engine: IEngine;
  smartItems: NonNullable<AdminTools['smartItemsControl']['smartItems']>;
  selectedIndex: number | undefined;
  onSelect: (idx: number) => void;
}) {
  const scaleFactor = getScaleUIFactor(engine);

  return (
    <UiEntity
      key="SmartItemsControlDropdownWrapper"
      uiTransform={{
        flexDirection: 'column',
        margin: { bottom: 32 * scaleFactor },
      }}
    >
      <Label
        value="<b>Selected Smart Item</b>"
        fontSize={16 * scaleFactor}
        color={Color4.White()}
        uiTransform={{
          margin: { bottom: 16 * scaleFactor },
        }}
      />
      <Dropdown
        key="SmartItemsControlDropdownSelector"
        acceptEmpty
        emptyLabel="Select Smart Item"
        options={smartItems.map(item => item.customName)}
        selectedIndex={selectedIndex ?? -1}
        onChange={onSelect}
        textAlign="middle-left"
        fontSize={14 * scaleFactor}
        uiTransform={{
          height: 40 * scaleFactor,
          width: '100%',
        }}
        uiBackground={{ color: Color4.White() }}
        color={Color4.Black()}
      />
    </UiEntity>
  );
}

function ActionSelector({
  engine,
  actions,
  selectedIndex,
  disabled,
  onChange,
}: {
  engine: IEngine;
  actions: Action[];
  selectedIndex: number | undefined;
  disabled: boolean;
  onChange: (idx: number) => void;
}) {
  const scaleFactor = getScaleUIFactor(engine);

  return (
    <UiEntity
      uiTransform={{
        flexDirection: 'column',
        margin: { bottom: 32 * scaleFactor },
      }}
    >
      <Label
        value="<b>Actions</b>"
        fontSize={16 * scaleFactor}
        color={Color4.White()}
        uiTransform={{
          margin: { bottom: 16 * scaleFactor },
        }}
      />
      {actions.length ? (
        <Dropdown
          acceptEmpty
          emptyLabel="Select Action"
          options={actions.map(action => action.name)}
          selectedIndex={selectedIndex}
          onChange={onChange}
          disabled={disabled}
          textAlign="middle-left"
          fontSize={14 * scaleFactor}
          uiTransform={{
            height: 40 * scaleFactor,
            width: '100%',
          }}
          uiBackground={{
            color: disabled ? Color4.Gray() : Color4.White(),
          }}
          color={Color4.Black()}
        />
      ) : (
        <UiEntity />
      )}
    </UiEntity>
  );
}

function ActionButtons({
  engine,
  state,
  smartItems,
  actions,
  selectedAction,
}: {
  engine: IEngine;
  state: State;
  smartItems: NonNullable<AdminTools['smartItemsControl']['smartItems']>;
  actions: Action[];
  selectedAction: Action | undefined;
}) {
  const scaleFactor = getScaleUIFactor(engine);

  const selectedSmartItem =
    state.smartItemsControl.selectedSmartItem !== undefined
      ? smartItems[state.smartItemsControl.selectedSmartItem]
      : undefined;

  const isVisible =
    selectedSmartItem &&
    state.smartItemsControl.smartItems.get(selectedSmartItem.entity as Entity)?.visible;

  return (
    <UiEntity
      uiTransform={{
        flexDirection: 'row',
      }}
    >
      <Button
        id="smart_items_control_restart"
        value="<b>Play Action</b>"
        variant="text"
        fontSize={16 * scaleFactor}
        color={Color4.White()}
        uiTransform={{
          margin: { right: 8 * scaleFactor },
          height: 40 * scaleFactor,
        }}
        labelTransform={{
          margin: { left: 10 * scaleFactor, right: 10 * scaleFactor },
        }}
        disabled={!selectedSmartItem || !selectedAction}
        onMouseDown={() => {
          if (selectedSmartItem && selectedAction) {
            handleExecuteAction(selectedSmartItem, selectedAction);
          }
        }}
      />
      <Button
        id="smart_items_control_hide_show"
        value={`<b>${isVisible ? 'Hide' : 'Show'} Entity</b>`}
        variant="text"
        fontSize={16 * scaleFactor}
        color={Color4.White()}
        onMouseDown={() => handleHideShowEntity(engine, state, smartItems)}
        disabled={!selectedSmartItem}
        uiTransform={{ margin: { right: 8 * scaleFactor } }}
        labelTransform={{
          margin: { left: 10 * scaleFactor, right: 10 * scaleFactor },
        }}
      />
    </UiEntity>
  );
}

// Main Component
export function SmartItemsControl({ engine, state }: { engine: IEngine; state: State }) {
  const smartItems = getSmartItems(engine);
  const actions =
    state.smartItemsControl.selectedSmartItem !== undefined
      ? getSmartItemActions(engine, smartItems[state.smartItemsControl.selectedSmartItem])
      : [];

  const selectedActionIndex =
    state.smartItemsControl.selectedSmartItem !== undefined
      ? actions.findIndex(action => {
          const selectedSmartItem = smartItems[state.smartItemsControl.selectedSmartItem!];
          const stateSelectedAction = state.smartItemsControl.smartItems.get(
            selectedSmartItem.entity as Entity,
          )?.selectedAction;

          return action.name === (stateSelectedAction ?? selectedSmartItem.defaultAction);
        })
      : undefined;
  const scaleFactor = getScaleUIFactor(engine);

  return (
    <Card scaleFactor={scaleFactor}>
      <UiEntity
        key="SmartItemsControl"
        uiTransform={{
          height: '100%',
          width: '100%',
          flexDirection: 'column',
        }}
      >
        <Header
          iconSrc={ICONS.SMART_ITEM_CONTROL}
          title="SMART ITEM ACTIONS"
          scaleFactor={scaleFactor}
        />

        <SmartItemSelector
          engine={engine}
          smartItems={smartItems}
          selectedIndex={state.smartItemsControl.selectedSmartItem}
          onSelect={idx => {
            handleSelectSmartItem(state, smartItems, idx);
          }}
        />

        <ActionSelector
          engine={engine}
          actions={actions}
          selectedIndex={selectedActionIndex}
          disabled={state.smartItemsControl.selectedSmartItem === undefined}
          onChange={idx => {
            if (state.smartItemsControl.selectedSmartItem !== undefined) {
              handleSelectAction(
                state,
                smartItems[state.smartItemsControl.selectedSmartItem],
                actions[idx],
              );
            }
          }}
        />

        <ActionButtons
          engine={engine}
          state={state}
          smartItems={smartItems}
          actions={actions}
          selectedAction={
            selectedActionIndex !== undefined ? actions[selectedActionIndex] : undefined
          }
        />
      </UiEntity>
    </Card>
  );
}
