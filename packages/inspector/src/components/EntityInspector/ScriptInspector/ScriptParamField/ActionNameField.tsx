import React from 'react';
import type { Entity } from '@dcl/ecs';

import { useSdk } from '../../../../hooks/sdk/useSdk';
import { Dropdown } from '../../../ui/Dropdown';

type Props = {
  label: React.ReactNode;
  value: string;
  entity: Entity | undefined;
  onChange: (action: string) => void;
};

// The name of one of `entity`'s actions (a string param tagged `@actionsOf <key>`). A stored name
// that isn't one of them (typed by hand before this was a dropdown, or left over from another
// item) stays visible and flagged until a real action is picked, instead of silently vanishing.
export function ActionNameField({ label, value, entity, onChange }: Props) {
  const sdk = useSdk();
  const actions = (entity && sdk?.components.Actions.getOrNull(entity)?.value) || [];
  const names = actions.map(action => action.name);
  const isStale = !!value && !names.includes(value);

  const options = names.map(name => ({ value: name, label: name }));
  if (isStale) options.unshift({ value, label: `${value} (not an action of this item)` });

  return (
    <Dropdown
      label={label}
      placeholder={entity ? 'Select an action' : 'Select an item first'}
      empty="This item has no actions."
      disabled={!entity}
      options={options}
      value={value}
      error={isStale ? `"${value}" is not one of this item's actions.` : undefined}
      onChange={e => onChange(String(e.target.value))}
    />
  );
}
