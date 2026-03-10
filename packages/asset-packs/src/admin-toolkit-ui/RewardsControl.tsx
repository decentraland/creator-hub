import { Entity, IEngine } from '@dcl/ecs';
import ReactEcs, { UiEntity, Label, Dropdown } from '@dcl/react-ecs';
import { Color4 } from '@dcl/sdk/math';
import { AdminTools, getActionEvents, getComponents, getPayload, Action } from '../definitions';
import { Button } from './Button';
import { CONTENT_URL } from './constants';
import { State } from './types';

const ICONS = {
  REWARDS_CONTROL: `${CONTENT_URL}/admin_toolkit/assets/icons/rewards-control.png`,
  SEND: `${CONTENT_URL}/admin_toolkit/assets/icons/rewards-send.png`,
} as const;

// Helper Functions
function getAdminToolkitRewardsControl(engine: IEngine) {
  const { AdminTools } = getComponents(engine);
  const adminToolkitEntities = Array.from(engine.getEntitiesWith(AdminTools));
  return adminToolkitEntities.length > 0 ? adminToolkitEntities[0][1].rewardsControl : null;
}

function getRewardItems(engine: IEngine): NonNullable<AdminTools['rewardsControl']['rewardItems']> {
  const adminToolkitRewardsControl = getAdminToolkitRewardsControl(engine);

  if (
    !adminToolkitRewardsControl ||
    !adminToolkitRewardsControl.rewardItems ||
    adminToolkitRewardsControl.rewardItems.length === 0
  )
    return [];

  return Array.from(adminToolkitRewardsControl.rewardItems);
}

export function RewardsControl({ engine, state }: { engine: IEngine; state: State }) {
  const rewardItems = getRewardItems(engine);

  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <UiEntity
        uiTransform={{
          flexDirection: 'row',
          margin: { bottom: 32 },
          height: 30,
        }}
      >
        <UiEntity
          uiTransform={{ width: 30, height: 30 }}
          uiBackground={{
            color: Color4.White(),
            textureMode: 'stretch',
            texture: { src: ICONS.REWARDS_CONTROL },
          }}
        />
        <Label
          value="<b>AIRDROPS</b>"
          fontSize={24}
          color={Color4.White()}
        />
      </UiEntity>

      <UiEntity
        uiTransform={{
          flexDirection: 'column',
          margin: { bottom: 32 },
        }}
      >
        <Label
          value="<b>Selected Airdrop</b>"
          fontSize={16}
          color={Color4.White()}
          uiTransform={{ margin: { bottom: 16 } }}
        />

        <Dropdown
          key="RewardsItemSelector"
          acceptEmpty
          emptyLabel="Select your airdrop"
          options={[
            ...rewardItems.map(
              (item: NonNullable<AdminTools['rewardsControl']['rewardItems']>[0]) =>
                item.customName,
            ),
          ]}
          selectedIndex={state.rewardsControl.selectedRewardItem ?? -1}
          onChange={idx => (state.rewardsControl.selectedRewardItem = idx)}
          textAlign="middle-left"
          fontSize={14}
          uiTransform={{
            width: '100%',
            height: 40,
          }}
          uiBackground={{ color: Color4.White() }}
          color={Color4.Black()}
        />
      </UiEntity>

      <UiEntity uiTransform={{ flexDirection: 'column' }}>
        <Label
          value="<b>Actions</b>"
          fontSize={16}
          color={Color4.White()}
          uiTransform={{ margin: { bottom: 16 } }}
        />

        <UiEntity uiTransform={{ flexDirection: 'row' }}>
          <Button
            id="rewards_control_release"
            value="<b>Release</b>"
            fontSize={16}
            uiTransform={{
              margin: { right: 16 },
              alignItems: 'center',
              justifyContent: 'center',
            }}
            icon={ICONS.SEND}
            iconTransform={{
              height: 25,
              width: 25,
            }}
            onMouseDown={() => handleRelease(engine, state)}
            disabled={state.rewardsControl.selectedRewardItem === undefined}
          />
          <Button
            id="rewards_control_clear"
            value="<b>Clear</b>"
            fontSize={16}
            onMouseDown={() => handleClear(engine, state)}
            disabled={state.rewardsControl.selectedRewardItem === undefined}
          />
        </UiEntity>

        {/* TODO: Get supply values from rewards-server, it required a signedFetch but the one sent by the explorer is rejected */}
        {/* <Label
          value={`Redeemed: ${state.rewardsControl.redeemedCount}/`}
          fontSize={14}
          color={Color4.create(187 / 255, 187 / 255, 187 / 255, 1)}
        /> */}
      </UiEntity>
    </UiEntity>
  );
}

function handleRelease(engine: IEngine, state: State) {
  const { Actions, Rewards } = getComponents(engine);
  const rewardItems = getRewardItems(engine);
  const selectedRewardItem = rewardItems[state.rewardsControl.selectedRewardItem!];
  const rewardItem = Rewards.getOrNull(selectedRewardItem.entity as Entity);

  if (!rewardItem) return;

  const action = Actions.getOrNull(selectedRewardItem.entity as Entity)?.value.find(
    ($: Action) => $.name === 'Airdrop',
  );
  if (action) {
    const actionEvents = getActionEvents(selectedRewardItem.entity as Entity);
    actionEvents.emit(action.name, getPayload(action));
  }
}

function handleClear(engine: IEngine, state: State) {
  const { Actions, Rewards } = getComponents(engine);
  const rewardItems = getRewardItems(engine);
  const selectedRewardItem = rewardItems[state.rewardsControl.selectedRewardItem!];
  const rewardItem = Rewards.getOrNull(selectedRewardItem.entity as Entity);
  if (!rewardItem) return;

  const action = Actions.getOrNull(selectedRewardItem.entity as Entity)?.value.find(
    ($: Action) => $.name === 'Invisible',
  );

  if (action) {
    const actionEvents = getActionEvents(selectedRewardItem.entity as Entity);
    actionEvents.emit(action.name, getPayload(action));
  }
}
