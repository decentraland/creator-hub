import React, { useCallback, useState } from 'react';
import { type ActionPayload, type ActionType } from '@dcl/asset-packs';
import { recursiveCheck } from '../../../../lib/utils/deep-equal';
import { CheckboxField, TextField, InfoTooltip } from '../../../ui';
import { Block } from '../../../Block';
import type { Props } from './types';

import './FollowPlayerAction.css';

function isValid(
  payload: Partial<ActionPayload<ActionType.FOLLOW_PLAYER>>,
): payload is ActionPayload<ActionType.FOLLOW_PLAYER> {
  return (
    typeof payload.speed === 'number' &&
    !isNaN(payload.speed) &&
    typeof payload.minDistance === 'number' &&
    !isNaN(payload.minDistance)
  );
}

const FollowPlayerAction: React.FC<Props> = ({ value, onUpdate }: Props) => {
  const [payload, setPayload] = useState<Partial<ActionPayload<ActionType.FOLLOW_PLAYER>>>({
    ...value,
  });

  const handleUpdate = useCallback(
    (_payload: Partial<ActionPayload<ActionType.FOLLOW_PLAYER>>) => {
      setPayload(_payload);
      if (!recursiveCheck(_payload, value, 2) || !isValid(_payload)) return;
      onUpdate(_payload);
    },
    [setPayload, value, onUpdate],
  );

  const handleChangeSpeed = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
      handleUpdate({ ...payload, speed: parseFloat(value) });
    },
    [payload, handleUpdate],
  );

  const handleChangeMinDistance = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        handleUpdate({ ...payload, minDistance: parsed });
      }
    },
    [payload, handleUpdate],
  );

  const handleChangeX = useCallback(
    ({ target: { checked } }: React.ChangeEvent<HTMLInputElement>) => {
      handleUpdate({ ...payload, x: checked });
    },
    [payload, handleUpdate],
  );

  const handleChangeY = useCallback(
    ({ target: { checked } }: React.ChangeEvent<HTMLInputElement>) => {
      handleUpdate({ ...payload, y: checked });
    },
    [payload, handleUpdate],
  );

  const handleChangeZ = useCallback(
    ({ target: { checked } }: React.ChangeEvent<HTMLInputElement>) => {
      handleUpdate({ ...payload, z: checked });
    },
    [payload, handleUpdate],
  );

  const renderSpeedInfo = () => {
    return (
      <InfoTooltip
        text="The speed at which the entity moves towards the player, in meters per second."
        position="top center"
      />
    );
  };

  const renderMinDistanceInfo = () => {
    return (
      <InfoTooltip
        text="The minimum distance the entity will maintain from the player. Once this distance is reached, the entity stops moving closer."
        position="top center"
      />
    );
  };

  const renderAxesInfo = () => {
    return (
      <InfoTooltip
        text="Select which axes the entity should follow the player on. X: horizontal, Y: vertical, Z: depth."
        position="top center"
      />
    );
  };

  return (
    <div className="FollowPlayerActionContainer">
      <Block>
        <TextField
          label={<>Speed {renderSpeedInfo()}</>}
          type="text"
          value={payload.speed}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChangeSpeed(e)}
          autoSelect
        />
        <TextField
          label={<>Min. Distance {renderMinDistanceInfo()}</>}
          type="text"
          value={payload.minDistance}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChangeMinDistance(e)}
          autoSelect
        />
      </Block>
      <Block label={<>Axes {renderAxesInfo()}</>}>
        <CheckboxField
          label="X"
          checked={payload.x}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChangeX(e)}
        />
        <CheckboxField
          label="Y"
          checked={payload.y}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChangeY(e)}
        />
        <CheckboxField
          label="Z"
          checked={payload.z}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChangeZ(e)}
        />
      </Block>
    </div>
  );
};

export default React.memo(FollowPlayerAction);
