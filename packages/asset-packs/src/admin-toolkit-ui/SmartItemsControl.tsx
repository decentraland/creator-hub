import type { Entity, IEngine } from '@dcl/ecs';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import ReactEcs, { Dropdown, Label, UiEntity } from '@dcl/react-ecs';
import {
  getActionEvents,
  getComponents,
  getPayload,
  type Action,
  type AdminTools,
} from '../definitions';
import { getExplorerComponents } from '../components';
import { type State } from './types';
import { COLORS, RADIUS, SPACING, TYPE } from './theme';
import { FieldLabel } from './Primitives';
import { PillButton } from './Controls';
import { getSmartItems } from '.';

type SmartItemList = NonNullable<AdminTools['smartItemsControl']['smartItems']>;

function getSmartItemActions(engine: IEngine, smartItem: SmartItemList[0]) {
  const { Actions } = getComponents(engine);
  if (!smartItem || !Actions.has(smartItem.entity as Entity)) return [];
  return Array.from(Actions.get(smartItem.entity as Entity).value);
}

function handleExecuteAction(smartItem: SmartItemList[0], action: Action) {
  const actionEvents = getActionEvents(smartItem.entity as Entity);
  actionEvents.emit(action.name, getPayload(action));
}

function handleSelectSmartItem(state: State, smartItems: SmartItemList, idx: number) {
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

function handleSelectAction(state: State, smartItem: SmartItemList[0], action: Action) {
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

function handleHideShowEntity(engine: IEngine, state: State, smartItems: SmartItemList) {
  const { VisibilityComponent } = getExplorerComponents(engine);
  const smartItemEntity = smartItems[state.smartItemsControl.selectedSmartItem!].entity as Entity;
  const smartItem = state.smartItemsControl.smartItems.get(smartItemEntity);
  const toggleVisibility = !smartItem!.visible;
  state.smartItemsControl.smartItems.get(smartItemEntity)!.visible = toggleVisibility;
  const visibility = VisibilityComponent.getOrCreateMutable(smartItemEntity);
  visibility.visible = toggleVisibility;
}

const DROPDOWN_TRANSFORM = {
  width: '100%' as const,
  height: 40,
  borderRadius: RADIUS.md,
  borderWidth: 1,
  borderColor: COLORS.inputBorder,
};

export function SmartItemsControl({ engine, state }: { engine: IEngine; state: State }) {
  const smartItems = getSmartItems(engine);
  const selectedIndex = state.smartItemsControl.selectedSmartItem;
  const hasSelection = selectedIndex !== undefined;
  const actions = hasSelection ? getSmartItemActions(engine, smartItems[selectedIndex]) : [];

  const selectedActionIndex = hasSelection
    ? actions.findIndex((action: Action) => {
        const smartItem = smartItems[selectedIndex];
        const stateSelectedAction = state.smartItemsControl.smartItems.get(
          smartItem.entity as Entity,
        )?.selectedAction;
        return action.name === (stateSelectedAction ?? smartItem.defaultAction);
      })
    : -1;

  const selectedAction = selectedActionIndex >= 0 ? actions[selectedActionIndex] : undefined;
  const selectedSmartItem = hasSelection ? smartItems[selectedIndex] : undefined;
  const isVisible =
    selectedSmartItem &&
    state.smartItemsControl.smartItems.get(selectedSmartItem.entity as Entity)?.visible;

  return (
    <UiEntity
      key="SmartItemsControl"
      uiTransform={{ flexDirection: 'column', width: '100%', padding: SPACING.xxl }}
    >
      <Label
        value="<b>Smart item actions</b>"
        fontSize={TYPE.title}
        color={COLORS.textPrimary}
        uiTransform={{ margin: { bottom: SPACING.xl } }}
      />

      <UiEntity
        uiTransform={{ flexDirection: 'column', width: '100%', margin: { bottom: SPACING.xl } }}
      >
        <FieldLabel text="Smart item" />
        <Dropdown
          acceptEmpty
          emptyLabel="Select smart item"
          options={smartItems.map((item: SmartItemList[0]) => item.customName)}
          selectedIndex={selectedIndex ?? -1}
          onChange={idx => handleSelectSmartItem(state, smartItems, idx)}
          textAlign="middle-left"
          fontSize={TYPE.body}
          color={COLORS.inputText}
          uiTransform={DROPDOWN_TRANSFORM}
          uiBackground={{ color: COLORS.inputBackground }}
        />
      </UiEntity>

      <UiEntity
        uiTransform={{ flexDirection: 'column', width: '100%', margin: { bottom: SPACING.xl } }}
      >
        <FieldLabel text="Action" />
        <Dropdown
          acceptEmpty
          emptyLabel="Select action"
          options={actions.map((action: Action) => action.name)}
          selectedIndex={selectedActionIndex}
          disabled={!hasSelection}
          onChange={idx => {
            if (hasSelection) handleSelectAction(state, smartItems[selectedIndex], actions[idx]);
          }}
          textAlign="middle-left"
          fontSize={TYPE.body}
          color={COLORS.inputText}
          uiTransform={DROPDOWN_TRANSFORM}
          uiBackground={{
            color: hasSelection ? COLORS.inputBackground : COLORS.disabledBackground,
          }}
        />
      </UiEntity>

      <UiEntity uiTransform={{ flexDirection: 'row', width: '100%' }}>
        <PillButton
          id="smart_items_control_restart"
          label="Play action"
          iconName="play"
          variant="filled"
          disabled={!selectedSmartItem || !selectedAction}
          uiTransform={{ flexGrow: 1, flexBasis: 0, margin: { right: SPACING.md } }}
          onClick={() => {
            if (selectedSmartItem && selectedAction) {
              handleExecuteAction(selectedSmartItem, selectedAction);
            }
          }}
        />
        <PillButton
          id="smart_items_control_hide_show"
          label={`${isVisible ? 'Hide' : 'Show'} entity`}
          iconName="eyeoff"
          variant="outlined"
          disabled={!selectedSmartItem}
          uiTransform={{ flexGrow: 1, flexBasis: 0 }}
          onClick={() => handleHideShowEntity(engine, state, smartItems)}
        />
      </UiEntity>
    </UiEntity>
  );
}
