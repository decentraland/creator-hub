import React, { useCallback } from 'react';

import { Block } from '../../Block';
import { Button } from '../../Button';
import { AddButton } from '../../EntityInspector/AddButton';
import MoreOptionsMenu from '../../EntityInspector/MoreOptionsMenu';
import { InfoTooltip } from '../InfoTooltip';
import { Label } from '../Label';
import { WalletField } from '../WalletField';
import type { Props } from './types';

import './WalletList.css';

/**
 * Controlled list of wallet addresses.
 *
 * `onChange` fires on blur with the whole list, and only when the edited row
 * holds a valid address or is empty. It is a commit, not a keystroke — do not
 * debounce it.
 */
const WalletList: React.FC<Props> = ({ label, info, addLabel, removeLabel, value, onChange }) => {
  const handleAdd = useCallback(() => onChange([...value, '']), [value, onChange]);

  const handleUpdate = useCallback(
    (index: number) => (event: React.ChangeEvent<HTMLInputElement>) =>
      onChange(value.map((address, idx) => (idx === index ? event.target.value : address))),
    [value, onChange],
  );

  const handleRemove = useCallback(
    (index: number) => () => onChange(value.filter((_, idx) => idx !== index)),
    [value, onChange],
  );

  return (
    <Block className="WalletList">
      <div className="label-with-info">
        <Label text={label} />
        {info ? (
          <InfoTooltip
            text={info}
            type="help"
          />
        ) : null}
      </div>
      {value.map((address, index) => (
        <div
          className="row"
          key={`${index}-${address}`}
        >
          <WalletField
            aria-label={`Wallet address ${index + 1}`}
            value={address}
            onChange={handleUpdate(index)}
          />
          <MoreOptionsMenu>
            <Button
              aria-label={`${removeLabel} ${index + 1}`}
              onClick={handleRemove(index)}
            >
              {removeLabel}
            </Button>
          </MoreOptionsMenu>
        </div>
      ))}
      <AddButton onClick={handleAdd}>{addLabel}</AddButton>
    </Block>
  );
};

export default React.memo(WalletList);
