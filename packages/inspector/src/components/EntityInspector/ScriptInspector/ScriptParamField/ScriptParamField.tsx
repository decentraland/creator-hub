import { TextField, CheckboxField } from '../../../ui';
import EntityField from '../../../ui/EntityField/EntityField';
import { fromNumber, toNumber, isValidNumber } from '../utils';

import type { Props } from './types';

export function ScriptParamField({ name, param, onUpdate }: Props) {
  switch (param.type) {
    case 'number':
      return (
        <TextField
          type="number"
          label={name}
          value={fromNumber(param.value)}
          onChange={e => onUpdate(toNumber(e.target.value))}
          debounceTime={300}
          error={!isValidNumber(fromNumber(param.value))}
        />
      );

    case 'boolean':
      return (
        <CheckboxField
          label={name}
          checked={param.value}
          onChange={e => onUpdate(e.target.checked)}
        />
      );

    case 'entity':
      return (
        <EntityField
          label={name}
          value={param.value}
          onChange={e => onUpdate(e.target.value)}
        />
      );
    case 'string':
    default:
      return (
        <TextField
          label={name}
          value={param.value}
          onChange={e => onUpdate(e.target.value)}
          debounceTime={300}
        />
      );
  }
}
