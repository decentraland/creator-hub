import React, { useEffect } from 'react';
import type { Entity } from '@dcl/ecs';
import { withSdk, type WithSdkProps } from '../../../../hoc/withSdk';
import { useEntitiesWith } from '../../../../hooks/sdk/useEntitiesWith';
import type { Component, EditorComponentsTypes } from '../../../../lib/sdk/components';
import { addSyncComponentsToEntities } from '../../../../lib/sdk/operations/entitySyncUtils';

import { TextField, Dropdown, EntityField } from '../../../ui';
import { AddButton } from '../../AddButton';
import { AdminListRow } from '../AdminListRow';
import { useAdminTools } from '../useAdminTools';

import './SmartItemControl.css';

type Props = {
  entity: Entity;
};

type SmartItems = NonNullable<
  EditorComponentsTypes['AdminTools']['smartItemsControl']['smartItems']
>;

const SmartItemControl: React.FC<WithSdkProps & Props> = ({ sdk, entity }) => {
  const {
    AdminTools,
    Actions,
    Animator,
    Transform,
    Tween,
    VisibilityComponent,
    VideoPlayer,
    AudioSource,
    AudioStream,
  } = sdk.components;
  const [adminComponent, updateControl] = useAdminTools(entity, AdminTools);
  const entitiesWithAction: Entity[] = useEntitiesWith(components => components.Actions);

  const smartItems = adminComponent?.smartItemsControl.smartItems ?? [];
  const pickedEntities = smartItems.map(smartItem => smartItem.entity as Entity);

  useEffect(() => {
    addSyncComponentsToEntities(sdk, pickedEntities, [
      AudioSource.componentId,
      AudioStream.componentId,
      Animator.componentId,
      Transform.componentId,
      Tween.componentId,
      VideoPlayer.componentId,
      VisibilityComponent.componentId,
    ]);
  }, [pickedEntities.join(), entitiesWithAction]);

  if (!adminComponent) return null;

  const setSmartItems = (next: SmartItems) =>
    updateControl('smartItemsControl', { smartItems: next });

  const isRemoved = (smartItemEntity: number) =>
    smartItemEntity !== 0 && !Actions.has(smartItemEntity as Entity);

  const actionOptions = (smartItemEntity: number) =>
    (Actions.getOrNull(smartItemEntity as Entity)?.value ?? []).map(({ name }) => ({
      value: name,
      label: name,
    }));

  return (
    <div className="SmartItemControl">
      {smartItems.map((smartItem, idx) => (
        <AdminListRow
          key={idx}
          index={idx}
          onRemove={() => setSmartItems(smartItems.toSpliced(idx, 1))}
        >
          <EntityField
            label="Smart Item"
            components={[Actions] as Component[]}
            value={smartItem.entity}
            error={isRemoved(smartItem.entity) && 'Smart item was removed'}
            onChange={e =>
              setSmartItems(smartItems.with(idx, { ...smartItem, entity: Number(e.target.value) }))
            }
          />
          <TextField
            label="Custom Name"
            value={smartItem.customName}
            onBlur={e => {
              if (e.target.value === smartItem.customName) return;
              setSmartItems(smartItems.with(idx, { ...smartItem, customName: e.target.value }));
            }}
          />
          <Dropdown
            label="Default Action"
            placeholder="Default Action"
            disabled={!smartItem.entity}
            options={actionOptions(smartItem.entity)}
            value={smartItem.defaultAction}
            onChange={e =>
              setSmartItems(smartItems.with(idx, { ...smartItem, defaultAction: e.target.value }))
            }
          />
        </AdminListRow>
      ))}
      <AddButton
        onClick={() =>
          setSmartItems([...smartItems, { entity: 0, defaultAction: '', customName: '' }])
        }
        disabled={
          entitiesWithAction.length === 0 || entitiesWithAction.length === smartItems.length
        }
      >
        Add Smart Item
      </AddButton>
    </div>
  );
};

export default React.memo(withSdk(SmartItemControl));
