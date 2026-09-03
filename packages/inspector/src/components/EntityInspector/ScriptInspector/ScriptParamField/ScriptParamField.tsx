import type { ActionRef } from '@dcl/asset-packs';

import { TextField, CheckboxField, RangeField } from '../../../ui';
import EntityField from '../../../ui/EntityField/EntityField';
import InfoTooltip from '../../../ui/InfoTooltip/InfoTooltip';
import { fromNumber, toNumber, isValidNumber } from '../utils';
import ActionField from './ActionField';

import type { Props } from './types';

function labelWithTooltip(name: string, tooltip?: string) {
  if (!tooltip) return name;
  return (
    <>
      {name} <InfoTooltip text={tooltip} />
    </>
  );
}

export function ScriptParamField({ name, param, onUpdate }: Props) {
  switch (param.type) {
    case 'number':
      return (
        <TextField
          type="number"
          label={labelWithTooltip(name, param.tooltip)}
          value={fromNumber(param.value)}
          onChange={e => onUpdate(toNumber(e.target.value))}
          debounceTime={300}
          error={!isValidNumber(fromNumber(param.value))}
        />
      );

    case 'slider':
      return (
        <RangeField
          label={labelWithTooltip(name, param.tooltip)}
          value={param.value}
          min={param.min}
          max={param.max}
          step={param.step}
          onChange={e => onUpdate(toNumber((e.target as HTMLInputElement).value))}
        />
      );

    case 'boolean':
      return (
        <CheckboxField
          label={labelWithTooltip(name, param.tooltip)}
          checked={param.value}
          onChange={e => onUpdate(e.target.checked)}
        />
      );

    case 'entity':
      return (
        <EntityField
          label={labelWithTooltip(name, param.tooltip)}
          value={param.value}
          onChange={e => onUpdate(Number(e.target.value))}
        />
      );

    case 'action':
      return (
        <ActionField
          label={labelWithTooltip(name, param.tooltip)}
          value={param.value}
          onChange={(value: ActionRef) => onUpdate(value)}
        />
      );

    case 'string':
    default:
      return (
        <TextField
          label={labelWithTooltip(name, param.tooltip)}
          value={param.value}
          onChange={e => onUpdate(e.target.value)}
          debounceTime={300}
        />
      );
  }
}
