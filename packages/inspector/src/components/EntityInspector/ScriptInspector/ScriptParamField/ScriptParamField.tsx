import type { Entity } from '@dcl/ecs';
import type { ActionRef } from '@dcl/asset-packs';

import { TextField, CheckboxField, RangeField } from '../../../ui';
import { Dropdown } from '../../../ui/Dropdown';
import { WalletField } from '../../../ui/WalletField';
import { fromNumber, toNumber, isValidNumber } from '../utils';
import ActionField from './ActionField';
import { ObjectField } from './ObjectField';
import { ArrayField } from './ArrayField';
import { EntityParamField } from './EntityParamField';
import { ActionNameField } from './ActionNameField';
import { labelWithTooltip } from './labels';

import type { Props } from './types';

const asEntity = (value: unknown) =>
  typeof value === 'number' && value > 0 ? (value as Entity) : undefined;

export function ScriptParamField({ name, param, siblings, getError, onUpdate }: Props) {
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
        <EntityParamField
          label={labelWithTooltip(name, param.tooltip)}
          value={param.value}
          components={param.components}
          onChange={onUpdate}
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

    case 'object':
      return (
        <ObjectField
          name={name}
          param={param}
          getError={getError}
          onUpdate={onUpdate}
        />
      );

    case 'array':
      return (
        <ArrayField
          name={name}
          param={param}
          getError={getError}
          onUpdate={onUpdate}
        />
      );

    case 'string':
    default:
      if (param.type === 'string' && param.actionsOf) {
        return (
          <ActionNameField
            label={labelWithTooltip(name, param.tooltip)}
            value={param.value}
            entity={asEntity(siblings?.[param.actionsOf])}
            onChange={onUpdate}
          />
        );
      }
      if (param.type === 'string' && param.format === 'wallet') {
        return (
          <WalletField
            // WalletField keeps its own text, so remount it when the stored address changes
            // (a commit, or a row above it removed).
            key={param.value}
            label={labelWithTooltip(name, param.tooltip)}
            value={param.value}
            onChange={e => onUpdate(e.target.value)}
          />
        );
      }
      return (
        <TextField
          label={labelWithTooltip(name, param.tooltip)}
          value={param.value}
          onChange={e => onUpdate(e.target.value)}
          debounceTime={300}
          error={getError?.(param)}
        />
      );
  }
}
