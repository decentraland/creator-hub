import React, { useCallback, useMemo } from 'react';
import type { Entity } from '@dcl/ecs';
import { ActionPayload, ActionType } from '@dcl/asset-packs';
import { Dropdown, Label } from '../../../ui';
import { withSdk } from '../../../../hoc/withSdk';
import { Props } from './types';

const ChangeCameraAction: React.FC<Props & { sdk: any }> = ({ value, onUpdate, sdk, entity }) => {
  const { engine } = sdk;
  const { Name } = sdk.components;
  const VirtualCamera = sdk.components.VirtualCamera;

  const hasVirtualCamera = VirtualCamera ? VirtualCamera.has(entity) : false;
  const entityName = useMemo(() => {
    return Name.getOrNull(entity)?.value ?? entity.toString();
  }, [entity, Name]);

  const options = useMemo(() => {
    const cameraOptions: Array<{ label: string; value: string }> = [
      { label: 'This Entity', value: '' },
    ];

    if (VirtualCamera) {
      const entities = engine.getEntitiesWith(VirtualCamera);
      if (entities) {
        for (const [camEntity, _component] of entities) {
          if (
            camEntity !== engine.RootEntity &&
            camEntity !== engine.PlayerEntity &&
            camEntity !== engine.CameraEntity &&
            camEntity !== entity
          ) {
            const camEntityName = Name.getOrNull(camEntity)?.value ?? camEntity.toString();
            cameraOptions.push({
              label: camEntityName,
              value: camEntity.toString(),
            });
          }
        }
      }
    }

    return cameraOptions;
  }, [engine, VirtualCamera, Name, entity]);

  const handleChangeEntity = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedValue = e.target.value;
      const entityId = selectedValue === '' ? undefined : (parseInt(selectedValue, 10) as Entity);
      onUpdate({ ...value, virtualCameraEntity: entityId });
    },
    [value, onUpdate],
  );

  const currentValue = value.virtualCameraEntity?.toString() ?? '';

  return (
    <div className="ChangeCameraActionContainer">
      {hasVirtualCamera && !value.virtualCameraEntity && (
        <div className="row">
          <Label text={`Will use this entity's camera (${entityName})`} />
        </div>
      )}
      <div className="row">
        <Dropdown
          label="Camera"
          options={options}
          value={currentValue}
          onChange={handleChangeEntity}
          placeholder="Select Camera"
        />
      </div>
    </div>
  );
};

export default React.memo(withSdk(ChangeCameraAction));
