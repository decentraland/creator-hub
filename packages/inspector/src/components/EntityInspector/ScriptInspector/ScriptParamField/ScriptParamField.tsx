import type { Entity } from '@dcl/ecs';
import type { ActionRef } from '@dcl/asset-packs';

import { TextField, CheckboxField, RangeField } from '../../../ui';
import { ColorPicker } from '../../../ui/ColorPicker';
import { toColor3, toHex } from '../../../ui/ColorField/utils';
import { Dropdown } from '../../../ui/Dropdown';
import { WalletField } from '../../../ui/WalletField';
import { toColorOfKind } from '../parser';
import type { ScriptColor } from '../types';
import { fromNumber, toNumber, isValidNumber } from '../utils';
import ActionField from './ActionField';
import { ObjectField } from './ObjectField';
import { ArrayField } from './ArrayField';
import { EntityParamField } from './EntityParamField';
import { ActionNameField } from './ActionNameField';
import { FileParamField } from './FileParamField';
import { labelWithTooltip } from './labels';

import type { Props } from './types';

import './ScriptParamField.css';

const asEntity = (value: unknown) =>
  typeof value === 'number' && value > 0 ? (value as Entity) : undefined;

// the picker only edits RGB, so a Color4 keeps the alpha it already had
const fromHex = (hex: string, previous: ScriptColor): ScriptColor =>
  toColorOfKind({ ...toColor3(hex), a: previous.a }, previous.a !== undefined);

// `@enabledIf key` reads the sibling's current value, `@enabledIf !key` its opposite.
export function isParamEnabled(enabledIf: string | undefined, siblings?: Record<string, unknown>) {
  if (!enabledIf) return true;
  const negated = enabledIf.startsWith('!');
  const on = !!siblings?.[negated ? enabledIf.slice(1) : enabledIf];
  return negated ? !on : on;
}

export function ScriptParamField(props: Props) {
  if (isParamEnabled(props.param.enabledIf, props.siblings)) return <ParamInput {...props} />;
  // The fieldset natively disables every control inside, including the nested editors that take
  // no `disabled` prop; the prop gives the plain fields their own disabled look.
  return (
    <fieldset
      className="ScriptParamField disabled"
      disabled
    >
      <ParamInput
        {...props}
        disabled
      />
    </fieldset>
  );
}

function ParamInput({
  name,
  param,
  siblings,
  getError,
  onUpdate,
  disabled,
}: Props & { disabled?: boolean }) {
  switch (param.type) {
    case 'number':
      return (
        <TextField
          type="number"
          disabled={disabled}
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
          disabled={disabled}
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
          disabled={disabled}
          label={labelWithTooltip(name, param.tooltip)}
          checked={param.value}
          onChange={e => onUpdate(e.target.checked)}
        />
      );

    case 'enum':
      return (
        <Dropdown
          disabled={disabled}
          label={labelWithTooltip(name, param.tooltip)}
          value={param.value}
          options={param.options.map(option => ({ value: option, label: option }))}
          onChange={e => onUpdate(String(e.target.value))}
        />
      );

    case 'color':
      return (
        <ColorPicker
          disabled={disabled}
          label={labelWithTooltip(name, param.tooltip)}
          value={toHex(param.value)}
          onChange={e => onUpdate(fromHex((e.target as HTMLInputElement).value, param.value))}
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
      if (param.type === 'string' && param.format && param.format !== 'wallet') {
        return (
          <FileParamField
            label={labelWithTooltip(name, param.tooltip)}
            value={param.value}
            format={param.format}
            disabled={disabled}
            onChange={onUpdate}
          />
        );
      }
      return (
        <TextField
          disabled={disabled}
          label={labelWithTooltip(name, param.tooltip)}
          value={param.value}
          onChange={e => onUpdate(e.target.value)}
          debounceTime={300}
          error={getError?.(param)}
        />
      );
  }
}
