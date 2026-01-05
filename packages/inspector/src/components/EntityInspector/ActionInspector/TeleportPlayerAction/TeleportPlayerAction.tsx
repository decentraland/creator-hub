import React, { useCallback, useState, useMemo } from 'react';
import { type ActionPayload, type ActionType, TeleportMode } from '@dcl/asset-packs';
import { recursiveCheck } from '../../../../lib/utils/deep-equal';
import { TextField, Dropdown, InfoTooltip } from '../../../ui';
import { Block } from '../../../Block';
import type { Props } from './types';

import './TeleportPlayerAction.css';

function isValid(
  payload: Partial<ActionPayload<ActionType.TELEPORT_PLAYER>>,
): payload is ActionPayload<ActionType.TELEPORT_PLAYER> {
  if (payload.mode === TeleportMode.TO_WORLD) {
    return !!payload.realm && payload.realm.trim().length > 0;
  } else {
    // TO_COORDINATES mode
    return (
      payload.x !== undefined && payload.y !== undefined && !isNaN(payload.x) && !isNaN(payload.y)
    );
  }
}

const TeleportPlayerAction: React.FC<Props> = ({ value, onUpdate }: Props) => {
  const [payload, setPayload] = useState<Partial<ActionPayload<ActionType.TELEPORT_PLAYER>>>({
    mode: TeleportMode.TO_COORDINATES,
    ...value,
  });

  const handleUpdate = useCallback(
    (_payload: Partial<ActionPayload<ActionType.TELEPORT_PLAYER>>) => {
      setPayload(_payload);
      if (!recursiveCheck(_payload, value, 2) || !isValid(_payload)) return;
      onUpdate(_payload);
    },
    [setPayload, value, onUpdate],
  );

  const modeOptions = useMemo(
    () => [
      { label: 'To coordinates', value: TeleportMode.TO_COORDINATES },
      { label: 'To World', value: TeleportMode.TO_WORLD },
    ],
    [],
  );

  const handleChangeMode = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newMode = e.target.value as TeleportMode;
      if (newMode === TeleportMode.TO_WORLD) {
        handleUpdate({ ...payload, mode: newMode, x: undefined, y: undefined });
      } else {
        handleUpdate({ ...payload, mode: newMode, realm: undefined });
      }
    },
    [payload, handleUpdate],
  );

  const handleChangeX = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
      handleUpdate({ ...payload, x: parseInt(value) || undefined });
    },
    [payload, handleUpdate],
  );

  const handleChangeY = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
      handleUpdate({ ...payload, y: parseInt(value) || undefined });
    },
    [payload, handleUpdate],
  );

  const handleChangeRealm = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
      handleUpdate({ ...payload, realm: value || undefined });
    },
    [payload, handleUpdate],
  );

  const isCoordinatesMode = payload.mode === TeleportMode.TO_COORDINATES;

  return (
    <div className="TeleportPlayerActionContainer">
      <Block label="Teleport Mode">
        <div
          className="row"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <div style={{ flex: 1 }}>
            <Dropdown
              options={modeOptions}
              value={payload.mode || TeleportMode.TO_COORDINATES}
              onChange={handleChangeMode}
            />
          </div>
          <InfoTooltip
            text="Teleport players to coordinates in Genesis City or to a different World."
            link="https://docs.decentraland.org/creator/scenes-sdk7/interactivity/external-links#teleports"
            type="info"
          />
        </div>
      </Block>
      {isCoordinatesMode ? (
        <Block label="Coordinates">
          <TextField
            leftLabel="X"
            type="number"
            value={payload.x}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChangeX(e)}
            autoSelect
          />
          <TextField
            leftLabel="Y"
            type="number"
            value={payload.y}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChangeY(e)}
            autoSelect
          />
        </Block>
      ) : (
        <Block label="World Name">
          <TextField
            type="text"
            value={payload.realm || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChangeRealm(e)}
            placeholder="e.g., mannakia.dcl.eth"
            autoSelect
          />
        </Block>
      )}
    </div>
  );
};

export default React.memo(TeleportPlayerAction);
