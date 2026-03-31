import { useCallback, useEffect, useState } from 'react';

import { Button } from '../../../../Button';
import { Block } from '../../../../Block';
import { TextField } from '../../../../ui';

import type { Props } from './types';

export function ModeAdvanced({ value, disabled: isDisabled, onSubmit, onGoBack }: Props) {
  const [coords, setCoords] = useState(value.coords);
  const [base, setBase] = useState(value.base);

  useEffect(() => {
    setCoords(value.coords);
    setBase(value.base);
  }, [value]);

  const handleCoordsChange: React.ChangeEventHandler<HTMLInputElement> = useCallback(e => {
    setCoords(e.target.value.trim());
  }, []);

  const handleBaseParcelChange: React.ChangeEventHandler<HTMLInputElement> = useCallback(e => {
    setBase(e.target.value.trim());
  }, []);

  const handleSubmit = useCallback(() => {
    onSubmit({ coords, base });
  }, [onSubmit, coords, base]);

  const hasNoChanges = coords === value.coords && base === value.base;
  const disabled = isDisabled || !coords.length || !base.length || hasNoChanges;

  return (
    <Block className="advanced">
      <TextField
        autoSelect
        label="Custom Coordinates"
        value={coords}
        onChange={handleCoordsChange}
      />
      <TextField
        autoSelect
        label="Origin Point"
        value={base}
        onChange={handleBaseParcelChange}
      />
      <Block>
        <Button
          type="dark"
          onClick={onGoBack}
        >
          Back
        </Button>
        <Button
          type="blue"
          onClick={handleSubmit}
          disabled={disabled}
        >
          Confirm
        </Button>
      </Block>
    </Block>
  );
}
