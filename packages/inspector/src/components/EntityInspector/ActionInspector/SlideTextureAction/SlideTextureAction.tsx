import React, { useCallback } from 'react';
import { ActionPayload, ActionType, TextureMovementType } from '@dcl/asset-packs';
import { Dropdown, TextField } from '../../../ui';
import { Props } from './types';
import { Block } from '../../../Block';

const MOVEMENT_TYPE_OPTIONS = [
  { value: TextureMovementType.TMT_OFFSET, label: 'Offset' },
  { value: TextureMovementType.TMT_TILING, label: 'Tiling' },
];

const SlideTextureAction: React.FC<Props> = ({ value, onUpdate }) => {
  const handleChangeDirectionX = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const x = parseFloat(e.target.value);
      if (!isNaN(x)) {
        onUpdate({
          ...value,
          direction: { x, y: value.direction?.y ?? 0 },
          speed: value.speed ?? 1,
        } as ActionPayload<ActionType.SLIDE_TEXTURE>);
      }
    },
    [value, onUpdate],
  );

  const handleChangeDirectionY = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const y = parseFloat(e.target.value);
      if (!isNaN(y)) {
        onUpdate({
          ...value,
          direction: { x: value.direction?.x ?? 0, y },
          speed: value.speed ?? 1,
        } as ActionPayload<ActionType.SLIDE_TEXTURE>);
      }
    },
    [value, onUpdate],
  );

  const handleChangeSpeed = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const speed = parseFloat(e.target.value);
      if (!isNaN(speed)) {
        onUpdate({
          ...value,
          speed,
          direction: value.direction ?? { x: 0, y: 0 },
        } as ActionPayload<ActionType.SLIDE_TEXTURE>);
      }
    },
    [value, onUpdate],
  );

  const handleChangeDuration = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const duration = parseFloat(e.target.value);
      if (!isNaN(duration)) {
        onUpdate({
          ...value,
          duration,
          direction: value.direction ?? { x: 0, y: 0 },
          speed: value.speed ?? 1,
        } as ActionPayload<ActionType.SLIDE_TEXTURE>);
      }
    },
    [value, onUpdate],
  );

  const handleChangeMovementType = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onUpdate({
        ...value,
        movementType: parseInt(e.target.value),
        direction: value.direction ?? { x: 0, y: 0 },
        speed: value.speed ?? 1,
      } as ActionPayload<ActionType.SLIDE_TEXTURE>);
    },
    [value, onUpdate],
  );

  return (
    <Block className="SlideTextureActionContainer">
      <div className="row">
        <TextField
          label="Direction X"
          type="number"
          value={value.direction?.x ?? 0}
          onChange={handleChangeDirectionX}
        />
        <TextField
          label="Direction Y"
          type="number"
          value={value.direction?.y ?? 0}
          onChange={handleChangeDirectionY}
        />
      </div>
      <div className="row">
        <TextField
          label="Speed"
          type="number"
          value={value.speed ?? 1}
          onChange={handleChangeSpeed}
        />
      </div>
      <div className="row">
        <Dropdown
          label="Movement Type"
          options={MOVEMENT_TYPE_OPTIONS}
          value={value.movementType ?? TextureMovementType.TMT_OFFSET}
          onChange={handleChangeMovementType}
        />
      </div>
      <div className="row">
        <TextField
          label="Duration"
          type="number"
          value={value.duration ?? -1}
          onChange={handleChangeDuration}
        />
      </div>
    </Block>
  );
};

export default React.memo(SlideTextureAction);
