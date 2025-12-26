import React, { useCallback } from 'react';
import { ActionPayload, ActionType } from '@dcl/asset-packs';
import { Color4 } from '@dcl/ecs-math';
import { Block } from '../../../Block';
import { ColorField, TextField } from '../../../ui';
import { toHex, toColor4 } from '../../../ui/ColorField/utils';
import { Props } from './types';

const ChangeTextAction: React.FC<Props> = ({ value, onUpdate }) => {
  const handleChangeText = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate({ ...value, text: e.target.value } as ActionPayload<ActionType.CHANGE_TEXT>);
    },
    [value, onUpdate],
  );

  const handleChangeFontSize = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fontSize = parseFloat(e.target.value);
      if (!isNaN(fontSize)) {
        onUpdate({
          ...value,
          fontSize,
          text: value.text ?? '',
        } as ActionPayload<ActionType.CHANGE_TEXT>);
      }
    },
    [value, onUpdate],
  );

  const handleChangeColor = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const color = toColor4(e.target.value);
      onUpdate({
        ...value,
        color,
        text: value.text ?? '',
      } as ActionPayload<ActionType.CHANGE_TEXT>);
    },
    [value, onUpdate],
  );

  return (
    <Block className="ChangeTextActionContainer">
      <div className="row">
        <div className="field">
          <TextField
            label="Text"
            value={value.text ?? ''}
            onChange={handleChangeText}
          />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <TextField
            label="Font Size"
            type="number"
            value={value.fontSize ?? 10}
            onChange={handleChangeFontSize}
          />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <ColorField
            label="Color"
            value={toHex(value.color as Color4)}
            onChange={handleChangeColor}
          />
        </div>
      </div>
    </Block>
  );
};

export default React.memo(ChangeTextAction);
