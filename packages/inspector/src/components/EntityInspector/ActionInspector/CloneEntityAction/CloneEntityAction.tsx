import React, { useCallback, useMemo, useState } from 'react';
import { type ActionPayload, type ActionType } from '@dcl/asset-packs';
import { type Vector3 } from '@dcl/ecs-math';
import { recursiveCheck } from '../../../../lib/utils/deep-equal';
import { TextField, InfoTooltip } from '../../../ui';
import type { Props } from './types';

import './CloneEntityAction.css';

function isNumeric(value?: number) {
  return value !== undefined && !isNaN(value);
}

function isValid(
  payload: Partial<ActionPayload<ActionType.MOVE_PLAYER>>,
): payload is ActionPayload<ActionType.MOVE_PLAYER> {
  if (
    payload.position !== undefined &&
    isNumeric(payload.position.x) &&
    isNumeric(payload.position.y) &&
    isNumeric(payload.position.z)
  ) {
    if (
      payload.cameraTarget === undefined ||
      (isNumeric(payload.cameraTarget.x) &&
        isNumeric(payload.cameraTarget.y) &&
        isNumeric(payload.cameraTarget.z))
    ) {
      return true;
    }
  }

  return false;
}

const CloneEntityAction: React.FC<Props> = ({ value, onUpdate }: Props) => {
  const [payload, setPayload] = useState<Partial<ActionPayload<ActionType.MOVE_PLAYER>>>({
    ...value,
  });

  const handleUpdate = useCallback(
    (_payload: Partial<ActionPayload<ActionType.MOVE_PLAYER>>) => {
      setPayload(_payload);
      if (!recursiveCheck(_payload, value, 2) || !isValid(_payload)) return;
      onUpdate(_payload);
    },
    [setPayload, value, onUpdate],
  );

  const handleChangePositionX = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
      if (!value) return;
      handleUpdate({
        ...payload,
        position: { ...(payload.position as Vector3), x: parseFloat(value) },
      });
    },
    [payload, handleUpdate],
  );

  const handleChangePositionY = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
      if (!value) return;
      handleUpdate({
        ...payload,
        position: { ...(payload.position as Vector3), y: parseFloat(value) },
      });
    },
    [payload, handleUpdate],
  );

  const handleChangePositionZ = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
      if (!value) return;
      handleUpdate({
        ...payload,
        position: { ...(payload.position as Vector3), z: parseFloat(value) },
      });
    },
    [payload, handleUpdate],
  );

  const renderPositionInfo = useMemo(
    () => (
      <InfoTooltip
        text="Position where the cloned entity will be placed, relative to the scene origin. X: left/right, Y: up/down, Z: forward/backward."
        position="top center"
      />
    ),
    [],
  );

  return (
    <div className="CloneEntityActionContainer">
      <div className="row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
          <div style={{ flex: 1, display: 'flex', gap: '8px' }}>
            <TextField
              leftLabel="X"
              type="number"
              value={payload.position?.x}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChangePositionX(e)}
              autoSelect
            />
            <TextField
              leftLabel="Y"
              type="number"
              value={payload.position?.y}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChangePositionY(e)}
              autoSelect
            />
            <TextField
              leftLabel="Z"
              type="number"
              value={payload.position?.z}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChangePositionZ(e)}
              autoSelect
            />
          </div>
          {renderPositionInfo}
        </div>
      </div>
    </div>
  );
};

export default React.memo(CloneEntityAction);
