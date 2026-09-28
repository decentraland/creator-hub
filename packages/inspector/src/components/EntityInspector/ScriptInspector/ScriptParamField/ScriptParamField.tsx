import type { ActionRef } from '@dcl/asset-packs';

import { TextField, CheckboxField, RangeField } from '../../../ui';
import { Dropdown } from '../../../ui/Dropdown';
import EntityField from '../../../ui/EntityField/EntityField';
import InfoTooltip from '../../../ui/InfoTooltip/InfoTooltip';
import { fromNumber, toNumber, isValidNumber } from '../utils';
import ActionField from './ActionField';

import type { Props } from './types';

// The param's identifier is what the creator sees, so present it readably:
// camelCase / snake_case / kebab-case -> spaced, first letter capitalized
// (e.g. `activatedBy` -> "Activated By", `audioClipUrl` -> "Audio Clip Url").
function formatLabel(name: string): string {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function labelWithTooltip(name: string, tooltip?: string) {
  const label = formatLabel(name);
  if (!tooltip) return label;
  return (
    <>
      {label} <InfoTooltip text={tooltip} />
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

    case 'enum':
      return (
        <Dropdown
          label={labelWithTooltip(name, param.tooltip)}
          value={param.value}
          options={param.options.map(option => ({ value: option, label: option }))}
          onChange={e => onUpdate(String(e.target.value))}
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
