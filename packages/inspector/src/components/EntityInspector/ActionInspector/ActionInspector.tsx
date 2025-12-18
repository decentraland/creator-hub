import { useCallback, useEffect, useMemo, useState } from 'react';
import { VscTrash as RemoveIcon } from 'react-icons/vsc';
import cx from 'classnames';
import { AvatarAnchorPointType } from '@dcl/ecs';
import type { Action, ActionPayload } from '@dcl/asset-packs';
import {
  ActionType,
  getActionTypes,
  getJson,
  getActionSchema,
  ComponentName,
} from '@dcl/asset-packs';
import { ReadWriteByteBuffer } from '@dcl/ecs/dist/serialization/ByteBuffer';

import { withSdk } from '../../../hoc/withSdk';
import { useAllEntitiesHaveComponent, useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { useComponentValue } from '../../../hooks/sdk/useComponentValue';
import { useGltfAnimations } from '../../../hooks/sdk/useGltfAnimations';
import { analytics, Event } from '../../../lib/logic/analytics';
import { getAssetByModel } from '../../../lib/logic/catalog';
import { MIXED_VALUE } from '../../ui/utils';

import { Block } from '../../Block';
import { Container } from '../../Container';
import { Dropdown, TextField } from '../../ui';
import MoreOptionsMenu from '../MoreOptionsMenu';
import { AddButton } from '../AddButton';
import { Button } from '../../Button';
import { InfoTooltip } from '../../ui/InfoTooltip';

import { PlaySoundAction } from './PlaySoundAction';
import { TweenAction } from './TweenAction';
import { isValidTween } from './TweenAction/utils';
import { PlayAnimationAction } from './PlayAnimationAction';
import { SetVisibilityAction } from './SetVisibilityAction';
import { PlayVideoStreamAction } from './PlayVideoStreamAction';
import { PlayAudioStreamAction } from './PlayAudioStreamAction';
import { TeleportPlayerAction } from './TeleportPlayerAction';
import { MovePlayerAction } from './MovePlayerAction';
import { PlayDefaultEmoteAction } from './PlayDefaultEmoteAction';
import { PlayCustomEmoteAction } from './PlayCustomEmoteAction';
import { OpenLinkAction } from './OpenLinkAction';
import { ShowTextAction } from './ShowTextAction';
import { DelayAction } from './DelayAction';
import { LoopAction } from './LoopAction';
import { CloneEntityAction } from './CloneEntityAction';
import { ShowImageAction } from './ShowImageAction';
import { FollowPlayerAction } from './FollowPlayerAction';
import TriggerProximityAction from './TriggerProximityAction/TriggerProximityAction';
import SetPositionAction from './SetPositionAction/SetPositionAction';
import { SetRotationAction } from './SetRotationAction';
import { SetScaleAction } from './SetScaleAction';
import { RandomAction } from './RandomAction';
import { BatchAction } from './BatchAction';
import {
  getDefaultPayload,
  getPartialPayload,
  getEntityValuesMap,
  computeActionItems,
} from './utils';
import type { Props } from './types';

import './ActionInspector.css';

const ActionMapOption: Record<string, string> = {
  [ActionType.PLAY_ANIMATION]: 'Play Animation',
  [ActionType.STOP_ANIMATION]: 'Stop Animation',
  [ActionType.SET_STATE]: 'Set State',
  [ActionType.START_TWEEN]: 'Start Tween',
  [ActionType.SET_COUNTER]: 'Set Counter',
  [ActionType.INCREMENT_COUNTER]: 'Increment Counter',
  [ActionType.DECREASE_COUNTER]: 'Decrease Counter',
  [ActionType.PLAY_SOUND]: 'Play Sound',
  [ActionType.STOP_SOUND]: 'Stop Sound',
  [ActionType.SET_VISIBILITY]: 'Set Visibility',
  [ActionType.ATTACH_TO_PLAYER]: 'Attach to Player',
  [ActionType.DETACH_FROM_PLAYER]: 'Detach from Player',
  [ActionType.TELEPORT_PLAYER]: 'Teleport Player',
  [ActionType.MOVE_PLAYER]: 'Move Player',
  [ActionType.PLAY_DEFAULT_EMOTE]: 'Play Emote',
  [ActionType.PLAY_CUSTOM_EMOTE]: 'Play Custom Emote',
  [ActionType.OPEN_LINK]: 'Open Link',
  [ActionType.PLAY_AUDIO_STREAM]: 'Play Audio Stream',
  [ActionType.STOP_AUDIO_STREAM]: 'Stop Audio Stream',
  [ActionType.PLAY_VIDEO_STREAM]: 'Play Video',
  [ActionType.STOP_VIDEO_STREAM]: 'Stop Video',
  [ActionType.SHOW_TEXT]: 'Show Text',
  [ActionType.HIDE_TEXT]: 'Hide Text',
  [ActionType.START_DELAY]: 'Start Delay',
  [ActionType.STOP_DELAY]: 'Stop Delay',
  [ActionType.START_LOOP]: 'Start Loop',
  [ActionType.STOP_LOOP]: 'Stop Loop',
  [ActionType.CLONE_ENTITY]: 'Clone',
  [ActionType.REMOVE_ENTITY]: 'Remove',
  [ActionType.SHOW_IMAGE]: 'Show Image',
  [ActionType.HIDE_IMAGE]: 'Hide Image',
  [ActionType.FOLLOW_PLAYER]: 'Follow Player',
  [ActionType.STOP_FOLLOWING_PLAYER]: 'Stop Following Player',
  [ActionType.MOVE_PLAYER_HERE]: 'Move Player Here',
  [ActionType.DAMAGE]: 'Damage',
  [ActionType.PLACE_ON_PLAYER]: 'Place On Player',
  [ActionType.ROTATE_AS_PLAYER]: 'Rotate As Player',
  [ActionType.PLACE_ON_CAMERA]: 'Place On Camera',
  [ActionType.ROTATE_AS_CAMERA]: 'Rotate As Camera',
  [ActionType.SET_POSITION]: 'Set Position',
  [ActionType.SET_ROTATION]: 'Set Rotation',
  [ActionType.SET_SCALE]: 'Set Scale',
  [ActionType.RANDOM]: 'Random Action',
  [ActionType.BATCH]: 'Batch Actions',
  [ActionType.HEAL_PLAYER]: 'Heal Player',
  [ActionType.CLAIM_AIRDROP]: 'Claim Airdrop',
};

const AVATAR_ANCHOR_POINT_OPTIONS = [
  { value: AvatarAnchorPointType.AAPT_POSITION, label: 'Avatar Position' },
  { value: AvatarAnchorPointType.AAPT_NAME_TAG, label: 'Name Tag' },
  { value: AvatarAnchorPointType.AAPT_NECK, label: 'Neck' },
  { value: AvatarAnchorPointType.AAPT_SPINE, label: 'Spine' },
  { value: AvatarAnchorPointType.AAPT_SPINE1, label: 'Spine 1' },
  { value: AvatarAnchorPointType.AAPT_SPINE2, label: 'Spine 2' },
  { value: AvatarAnchorPointType.AAPT_HIP, label: 'Hip' },
  { value: AvatarAnchorPointType.AAPT_LEFT_SHOULDER, label: 'Left Shoulder' },
  { value: AvatarAnchorPointType.AAPT_LEFT_ARM, label: 'Left Arm' },
  { value: AvatarAnchorPointType.AAPT_LEFT_FOREARM, label: 'Left Forearm' },
  { value: AvatarAnchorPointType.AAPT_LEFT_HAND, label: 'Left Hand' },
  { value: AvatarAnchorPointType.AAPT_LEFT_HAND_INDEX, label: 'Left Hand Index' },
  { value: AvatarAnchorPointType.AAPT_RIGHT_SHOULDER, label: 'Right Shoulder' },
  { value: AvatarAnchorPointType.AAPT_RIGHT_ARM, label: 'Right Arm' },
  { value: AvatarAnchorPointType.AAPT_RIGHT_FOREARM, label: 'Right Forearm' },
  { value: AvatarAnchorPointType.AAPT_RIGHT_HAND, label: 'Right Hand' },
  { value: AvatarAnchorPointType.AAPT_LEFT_UP_LEG, label: 'Left Up Leg' },
  { value: AvatarAnchorPointType.AAPT_LEFT_LEG, label: 'Left Leg' },
  { value: AvatarAnchorPointType.AAPT_LEFT_FOOT, label: 'Left Foot' },
  { value: AvatarAnchorPointType.AAPT_LEFT_TOE_BASE, label: 'Left Toe Base' },
  { value: AvatarAnchorPointType.AAPT_RIGHT_UP_LEG, label: 'Right Up Leg' },
  { value: AvatarAnchorPointType.AAPT_RIGHT_LEG, label: 'Right Leg' },
  { value: AvatarAnchorPointType.AAPT_RIGHT_FOOT, label: 'Right Foot' },
  { value: AvatarAnchorPointType.AAPT_RIGHT_TOE_BASE, label: 'Right Toe Base' },
];

export default withSdk<Props>(({ sdk, entities, initialOpen = true }) => {
  const { Actions, States, Counter, GltfContainer, Rewards } = sdk.components;

  // Memoize entities by content to prevent unnecessary re-renders
  const entitiesKey = entities.join(',');
  const stableEntities = useMemo(() => entities, [entitiesKey]);

  const entityId = stableEntities[0];

  // Get entity values map
  const [entityValuesMap, setEntityValuesMap] = useState(() =>
    getEntityValuesMap(stableEntities, Actions),
  );

  // Sync entity values map when entities change
  useEffect(() => {
    setEntityValuesMap(getEntityValuesMap(stableEntities, Actions));
  }, [stableEntities, Actions]);

  // Compute action items (common and partial)
  const actionItems = useMemo(
    () => computeActionItems(entityValuesMap, stableEntities.length),
    [entityValuesMap, stableEntities.length],
  );

  const [_isFocused, setIsFocused] = useState(false);
  const [statesComponent] = useComponentValue(entityId, States);
  const states = statesComponent?.value ?? [];
  const animations = useGltfAnimations(entityId);

  const hasActions = useAllEntitiesHaveComponent(stableEntities, Actions);
  const hasStates = useHasComponent(entityId, States);
  const hasCounter = useHasComponent(entityId, Counter);
  const hasRewards = useHasComponent(entityId, Rewards);

  // Refresh entity values map
  const refreshEntityValuesMap = useCallback(() => {
    setEntityValuesMap(getEntityValuesMap(stableEntities, Actions));
  }, [stableEntities, Actions]);

  // Validate action has valid payload data
  // Used when updating payload fields to ensure data integrity before saving
  const isValidAction = useCallback(
    (action: Action) => {
      // Allow empty type during type selection phase
      if (!action.type) return true;

      switch (action.type) {
        case ActionType.PLAY_ANIMATION: {
          const payload = getPartialPayload<ActionType.PLAY_ANIMATION>(action);
          return !!payload.animation;
        }
        case ActionType.SET_STATE: {
          const payload = getPartialPayload<ActionType.SET_STATE>(action);
          return !!payload.state;
        }
        case ActionType.START_TWEEN: {
          const payload = getPartialPayload<ActionType.START_TWEEN>(action);
          return !!payload && isValidTween(payload);
        }
        case ActionType.SET_COUNTER: {
          const payload = getPartialPayload<ActionType.SET_COUNTER>(action);
          return !!payload.counter && !isNaN(payload.counter);
        }
        case ActionType.INCREMENT_COUNTER: {
          const payload = getPartialPayload<ActionType.INCREMENT_COUNTER>(action);
          return !!payload;
        }
        case ActionType.DECREASE_COUNTER: {
          const payload = getPartialPayload<ActionType.DECREASE_COUNTER>(action);
          return !!payload;
        }
        case ActionType.TELEPORT_PLAYER: {
          const payload = getPartialPayload<ActionType.TELEPORT_PLAYER>(action);
          return (
            !!payload &&
            typeof payload.x === 'number' &&
            !isNaN(payload.x) &&
            typeof payload.y === 'number' &&
            !isNaN(payload.y)
          );
        }
        case ActionType.MOVE_PLAYER: {
          const payload = getPartialPayload<ActionType.MOVE_PLAYER>(action);
          return (
            !!payload &&
            typeof payload.position?.x === 'number' &&
            !isNaN(payload.position?.x) &&
            typeof payload.position?.y === 'number' &&
            !isNaN(payload.position?.y) &&
            typeof payload.position?.z === 'number' &&
            !isNaN(payload.position?.z)
          );
        }
        case ActionType.PLAY_DEFAULT_EMOTE: {
          const payload = getPartialPayload<ActionType.PLAY_DEFAULT_EMOTE>(action);
          return !!payload && typeof payload.emote === 'string' && payload.emote.length > 0;
        }
        case ActionType.PLAY_CUSTOM_EMOTE: {
          const payload = getPartialPayload<ActionType.PLAY_CUSTOM_EMOTE>(action);
          return !!payload && typeof payload.src === 'string' && payload.src.length > 0;
        }
        case ActionType.OPEN_LINK: {
          const payload = getPartialPayload<ActionType.OPEN_LINK>(action);
          return !!payload && typeof payload.url === 'string' && payload.url.length > 0;
        }
        case ActionType.CLONE_ENTITY: {
          const payload = getPartialPayload<ActionType.CLONE_ENTITY>(action);
          return (
            !!payload &&
            typeof payload.position?.x === 'number' &&
            !isNaN(payload.position?.x) &&
            typeof payload.position?.y === 'number' &&
            !isNaN(payload.position?.y) &&
            typeof payload.position?.z === 'number' &&
            !isNaN(payload.position?.z)
          );
        }
        default: {
          try {
            const payload = getPartialPayload(action);
            const schema = getActionSchema(sdk.engine, action.type);
            const buffer = new ReadWriteByteBuffer();
            schema.serialize(payload, buffer);
            schema.deserialize(buffer);
            return true;
          } catch {
            return false;
          }
        }
      }
    },
    [sdk],
  );

  const hasAnimations = useMemo(() => {
    return animations.length > 0;
  }, [animations]);

  // Actions that may only be available under certain circumstances
  const conditionalActions: Partial<Record<string, () => boolean>> = useMemo(
    () => ({
      [ActionType.PLAY_ANIMATION]: () => hasAnimations,
      [ActionType.STOP_ANIMATION]: () => hasAnimations,
      [ActionType.SET_STATE]: () => hasStates,
      [ActionType.INCREMENT_COUNTER]: () => hasCounter,
      [ActionType.DECREASE_COUNTER]: () => hasCounter,
      [ActionType.SET_COUNTER]: () => hasCounter,
      [ActionType.CLAIM_AIRDROP]: () => hasRewards,
    }),
    [hasAnimations, hasStates, hasCounter, hasRewards],
  );

  const allActions = useMemo(() => {
    const actions = getActionTypes(sdk.engine);
    return actions;
  }, [sdk]);

  const availableActions = useMemo(() => {
    return allActions.filter(action => {
      if (action in conditionalActions) {
        const isAvailable = conditionalActions[action]!;
        return isAvailable();
      }
      return true;
    });
  }, [conditionalActions, allActions]);

  // Update action across all entities that have it
  const handleModifyActionByName = useCallback(
    (actionName: string, updater: (action: Action) => Action) => {
      for (const ent of stableEntities) {
        const component = entityValuesMap.get(ent);
        if (!component) continue;

        const actionIndex = component.value.findIndex(a => a.name === actionName);
        if (actionIndex === -1) continue;

        const currentAction = component.value[actionIndex];
        const updatedAction = updater(currentAction);

        const newActions = [...component.value];
        newActions[actionIndex] = updatedAction;
        sdk.operations.updateValue(Actions, ent, { ...component, value: newActions });
      }
      void sdk.operations.dispatch();
      refreshEntityValuesMap();
    },
    [stableEntities, entityValuesMap, sdk, Actions, refreshEntityValuesMap],
  );

  // Remove container from all entities
  const handleRemove = useCallback(async () => {
    for (const ent of stableEntities) {
      sdk.operations.removeComponent(ent, Actions);
    }
    await sdk.operations.dispatch();
    refreshEntityValuesMap();

    // Safe analytics - GltfContainer might not exist
    const gltfContainer = GltfContainer.getOrNull(entityId);
    const asset = gltfContainer?.src ? getAssetByModel(gltfContainer.src) : undefined;
    analytics.track(Event.REMOVE_COMPONENT, {
      componentName: ComponentName.ACTIONS,
      itemId: asset?.id,
      itemPath: gltfContainer?.src,
    });
  }, [sdk, stableEntities, entityId, Actions, GltfContainer, refreshEntityValuesMap]);

  // Add new action to all entities
  const handleAddNewAction = useCallback(() => {
    const newAction: Action = { type: '', name: '', jsonPayload: '{}' };
    for (const ent of stableEntities) {
      const component = entityValuesMap.get(ent);
      if (!component) continue;

      const newActions = [...component.value, newAction];
      sdk.operations.updateValue(Actions, ent, { ...component, value: newActions });
    }
    void sdk.operations.dispatch();
    refreshEntityValuesMap();
  }, [stableEntities, entityValuesMap, sdk, Actions, refreshEntityValuesMap]);

  // Remove action by name from all entities
  const handleRemoveAction = useCallback(
    (actionName: string) => {
      for (const ent of stableEntities) {
        const component = entityValuesMap.get(ent);
        if (!component) continue;

        const newActions = component.value.filter(a => a.name !== actionName);
        sdk.operations.updateValue(Actions, ent, { ...component, value: newActions });
      }
      void sdk.operations.dispatch();
      refreshEntityValuesMap();
    },
    [stableEntities, entityValuesMap, sdk, Actions, refreshEntityValuesMap],
  );

  // Handler for changing action name
  const handleChangeName = useCallback(
    (e: React.ChangeEvent<HTMLElement>, oldName: string) => {
      const { value: newName } = e.target as HTMLInputElement;
      handleModifyActionByName(oldName, action => ({
        ...action,
        name: newName,
      }));
    },
    [handleModifyActionByName],
  );

  // Handler for changing action type
  const handleChangeType = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLSelectElement>, actionName: string) => {
      handleModifyActionByName(actionName, action => ({
        ...action,
        type: value,
        jsonPayload: getDefaultPayload(value),
      }));
    },
    [handleModifyActionByName],
  );

  // Generic handler factory for updating action payloads
  // This eliminates the need for individual handlers per action type
  // Validates payload before saving to ensure data integrity
  const createPayloadHandler = useCallback(
    <T extends ActionType>(actionName: string) =>
      (value: ActionPayload<T>) => {
        handleModifyActionByName(actionName, action => {
          const updatedAction = {
            ...action,
            jsonPayload: getJson<T>(value),
          };

          // Only update if payload is valid
          if (!isValidAction(updatedAction)) {
            return action; // Return unchanged if invalid
          }

          return updatedAction;
        });
      },
    [handleModifyActionByName, isValidAction],
  );

  const handleFocusInput = useCallback(
    ({ type }: React.FocusEvent<HTMLInputElement>) => {
      if (type === 'focus') {
        setIsFocused(true);
      } else {
        setIsFocused(false);
      }
    },
    [setIsFocused],
  );

  if (!hasActions) {
    return null;
  }

  // Get all local actions for reference (for Delay/Loop/Random/Batch actions)
  const allLocalActions = actionItems.map(item => item.action);

  const renderAction = (
    action: Action,
    actionName: string,
    mergedPayload: Record<string, unknown>,
  ) => {
    // Create handler for this action - sub-components call this with the full payload
    const onUpdate = createPayloadHandler(actionName);

    switch (action.type) {
      case ActionType.PLAY_ANIMATION: {
        const payload = mergedPayload as ActionPayload<ActionType.PLAY_ANIMATION>;
        return hasAnimations ? (
          <PlayAnimationAction
            value={payload}
            animations={animations}
            onUpdate={onUpdate}
          />
        ) : null;
      }
      case ActionType.SET_STATE: {
        const payload = mergedPayload as ActionPayload<ActionType.SET_STATE>;
        return hasStates ? (
          <div className="row">
            <div className="field">
              <Dropdown
                label="Select State"
                placeholder="Select a State"
                options={[...states.map(state => ({ label: state, value: state }))]}
                value={payload?.state}
                onChange={e => onUpdate({ state: e.target.value })}
              />
            </div>
          </div>
        ) : null;
      }
      case ActionType.START_TWEEN: {
        const payload = mergedPayload as ActionPayload<ActionType.START_TWEEN>;
        return (
          <TweenAction
            tween={payload}
            onUpdateTween={onUpdate}
          />
        );
      }
      case ActionType.SET_COUNTER: {
        const payload = mergedPayload as ActionPayload<ActionType.SET_COUNTER>;
        return hasCounter ? (
          <div className="row">
            <div className="field">
              <TextField
                label="Counter Value"
                type="number"
                value={payload?.counter}
                onChange={e => onUpdate({ counter: parseInt(e.target.value) })}
                autoSelect
              />
            </div>
          </div>
        ) : null;
      }
      case ActionType.INCREMENT_COUNTER:
      case ActionType.DECREASE_COUNTER: {
        const payload = mergedPayload as ActionPayload<ActionType.INCREMENT_COUNTER>;
        return hasCounter ? (
          <div className="row">
            <div className="field">
              <TextField
                label="Amount"
                type="number"
                value={payload?.amount}
                onChange={e => onUpdate({ amount: parseInt(e.target.value) })}
                autoSelect
              />
            </div>
          </div>
        ) : null;
      }
      case ActionType.PLAY_SOUND: {
        const payload = mergedPayload as ActionPayload<ActionType.PLAY_SOUND>;
        return (
          <PlaySoundAction
            value={payload}
            onUpdate={onUpdate}
          />
        );
      }
      case ActionType.SET_VISIBILITY: {
        const payload = mergedPayload as ActionPayload<ActionType.SET_VISIBILITY>;
        return (
          <SetVisibilityAction
            value={payload}
            onUpdate={onUpdate}
          />
        );
      }
      case ActionType.ATTACH_TO_PLAYER: {
        const payload = mergedPayload as ActionPayload<ActionType.ATTACH_TO_PLAYER>;
        return (
          <div className="row">
            <div className="field">
              <Dropdown
                label="Select an Anchor Point"
                placeholder="Select an Anchor Point"
                options={AVATAR_ANCHOR_POINT_OPTIONS}
                value={payload?.anchorPointId}
                onChange={e => onUpdate({ anchorPointId: parseInt(e.target.value) })}
              />
            </div>
          </div>
        );
      }
      case ActionType.TELEPORT_PLAYER: {
        const payload = mergedPayload as ActionPayload<ActionType.TELEPORT_PLAYER>;
        return (
          <TeleportPlayerAction
            value={payload}
            onUpdate={onUpdate}
          />
        );
      }
      case ActionType.MOVE_PLAYER: {
        const payload = mergedPayload as ActionPayload<ActionType.MOVE_PLAYER>;
        return (
          <MovePlayerAction
            value={payload}
            onUpdate={onUpdate}
          />
        );
      }
      case ActionType.PLAY_DEFAULT_EMOTE: {
        const payload = mergedPayload as ActionPayload<ActionType.PLAY_DEFAULT_EMOTE>;
        return (
          <PlayDefaultEmoteAction
            value={payload}
            onUpdate={onUpdate}
          />
        );
      }
      case ActionType.PLAY_CUSTOM_EMOTE: {
        const payload = mergedPayload as ActionPayload<ActionType.PLAY_CUSTOM_EMOTE>;
        return (
          <PlayCustomEmoteAction
            value={payload}
            onUpdate={onUpdate}
          />
        );
      }
      case ActionType.OPEN_LINK: {
        const payload = mergedPayload as ActionPayload<ActionType.OPEN_LINK>;
        return (
          <OpenLinkAction
            value={payload}
            onUpdate={onUpdate}
          />
        );
      }
      case ActionType.PLAY_VIDEO_STREAM: {
        const payload = mergedPayload as ActionPayload<ActionType.PLAY_VIDEO_STREAM>;
        return (
          <PlayVideoStreamAction
            value={payload}
            onUpdate={onUpdate}
          />
        );
      }
      case ActionType.PLAY_AUDIO_STREAM: {
        const payload = mergedPayload as ActionPayload<ActionType.PLAY_AUDIO_STREAM>;
        return (
          <PlayAudioStreamAction
            value={payload}
            onUpdate={onUpdate}
          />
        );
      }
      case ActionType.SHOW_TEXT: {
        const payload = mergedPayload as ActionPayload<ActionType.SHOW_TEXT>;
        return (
          <ShowTextAction
            value={payload}
            onUpdate={onUpdate}
          />
        );
      }
      case ActionType.START_DELAY:
      case ActionType.STOP_DELAY: {
        const payload = mergedPayload as ActionPayload<typeof action.type>;
        return (
          <DelayAction<ActionPayload<typeof action.type>>
            availableActions={allLocalActions}
            value={payload}
            onUpdate={onUpdate}
          />
        );
      }
      case ActionType.START_LOOP:
      case ActionType.STOP_LOOP: {
        const payload = mergedPayload as ActionPayload<typeof action.type>;
        return (
          <LoopAction<ActionPayload<typeof action.type>>
            availableActions={allLocalActions}
            value={payload}
            onUpdate={onUpdate}
          />
        );
      }
      case ActionType.CLONE_ENTITY: {
        const payload = mergedPayload as ActionPayload<ActionType.CLONE_ENTITY>;
        return (
          <CloneEntityAction
            value={payload}
            onUpdate={onUpdate}
          />
        );
      }
      case ActionType.SHOW_IMAGE: {
        const payload = mergedPayload as ActionPayload<ActionType.SHOW_IMAGE>;
        return (
          <ShowImageAction
            value={payload}
            onUpdate={onUpdate}
          />
        );
      }
      case ActionType.FOLLOW_PLAYER: {
        const payload = mergedPayload as ActionPayload<ActionType.FOLLOW_PLAYER>;
        return (
          <FollowPlayerAction
            value={payload}
            onUpdate={onUpdate}
          />
        );
      }
      case ActionType.DAMAGE: {
        const payload = mergedPayload as ActionPayload<ActionType.DAMAGE>;
        return (
          <TriggerProximityAction
            value={payload}
            onUpdate={onUpdate}
          />
        );
      }
      case ActionType.SET_POSITION: {
        const payload = mergedPayload as ActionPayload<ActionType.SET_POSITION>;
        return (
          <SetPositionAction
            value={payload}
            onUpdate={onUpdate}
          />
        );
      }
      case ActionType.SET_ROTATION: {
        const payload = mergedPayload as ActionPayload<ActionType.SET_ROTATION>;
        return (
          <SetRotationAction
            value={payload}
            onUpdate={onUpdate}
          />
        );
      }
      case ActionType.SET_SCALE: {
        const payload = mergedPayload as ActionPayload<ActionType.SET_SCALE>;
        return (
          <SetScaleAction
            value={payload}
            onUpdate={onUpdate}
          />
        );
      }
      case ActionType.RANDOM: {
        const payload = mergedPayload as ActionPayload<ActionType.RANDOM>;
        return (
          <RandomAction
            value={payload}
            availableActions={allLocalActions}
            onUpdate={onUpdate}
          />
        );
      }
      case ActionType.BATCH: {
        const payload = mergedPayload as ActionPayload<ActionType.BATCH>;
        return (
          <BatchAction
            value={payload}
            availableActions={allLocalActions}
            onUpdate={onUpdate}
          />
        );
      }
      case ActionType.HEAL_PLAYER: {
        const payload = mergedPayload as ActionPayload<ActionType.HEAL_PLAYER>;
        return (
          <div className="row">
            <div className="field">
              <TextField
                label="Multiplier"
                type="number"
                value={payload?.multiplier || 1}
                onChange={e => onUpdate({ multiplier: parseInt(e.target.value) })}
              />
            </div>
          </div>
        );
      }
      default: {
        return null;
      }
    }
  };

  return (
    <Container
      label="Action"
      className="ActionInspector"
      initialOpen={initialOpen}
      rightContent={
        <InfoTooltip
          text="Actions list the capabilities of entities, from playing animations to changing visibility. Customize or add new actions, which are activated by triggers."
          link="https://docs.decentraland.org/creator/editor/smart-items-advanced/"
          type="help"
        />
      }
      onRemoveContainer={handleRemove}
    >
      {actionItems.map(({ action, isPartial, hasTypeMismatch, mergedPayload }, idx) => {
        const actionName = action.name;
        const displayType = hasTypeMismatch ? MIXED_VALUE : action.type;

        return (
          <Block
            key={`action-${actionName}-${idx}`}
            className={cx({ partial: isPartial })}
          >
            <div className="row">
              <TextField
                type="text"
                label="Name"
                value={actionName}
                onChange={e => handleChangeName(e, actionName)}
                onFocus={handleFocusInput}
                onBlur={handleFocusInput}
                debounceTime={500}
                autoSelect={!isPartial}
                disabled={isPartial}
              />
              <Dropdown
                label="Select an Action"
                placeholder="Select an Action"
                disabled={isPartial || availableActions.length === 0}
                options={[
                  ...availableActions.map(availableAction => ({
                    label: ActionMapOption[availableAction],
                    value: availableAction,
                  })),
                ]}
                value={hasTypeMismatch ? MIXED_VALUE : displayType}
                searchable
                onChange={e => handleChangeType(e, actionName)}
              />
            </div>
            {!hasTypeMismatch && renderAction(action, actionName, mergedPayload)}
            <MoreOptionsMenu>
              <Button
                className="RemoveButton"
                onClick={() => handleRemoveAction(actionName)}
              >
                <RemoveIcon /> Remove Action
              </Button>
            </MoreOptionsMenu>
          </Block>
        );
      })}
      <AddButton onClick={handleAddNewAction}>Add New Action</AddButton>
    </Container>
  );
});
