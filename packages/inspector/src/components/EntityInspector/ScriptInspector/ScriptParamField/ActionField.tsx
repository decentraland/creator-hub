import React, { useCallback, useMemo } from 'react';
import type { Entity } from '@dcl/ecs';
import type { ActionRef } from '@dcl/asset-packs';

import { withSdk, type WithSdkProps } from '../../../../hoc/withSdk';
import { useComponentsWith } from '../../../../hooks/sdk/useComponentsWith';
import type { Component } from '../../../../lib/sdk/components';
import { EntityField, Dropdown } from '../../../ui';

import './ActionField.css';

type Props = {
  label: React.ReactNode;
  value: ActionRef;
  onChange: (value: ActionRef) => void;
};

const ActionField: React.FC<WithSdkProps & Props> = ({ sdk, label, value, onChange }) => {
  const [_entitiesWithAction, _getActionEntity, getActionValue] = useComponentsWith(
    components => components.Actions,
  );

  const availableActions = useMemo(() => {
    if (!value.entity) return [];
    const actionsComponent = getActionValue(value.entity);
    if (!actionsComponent?.value) return [];
    return actionsComponent.value.map((action: { name: string }) => ({
      value: action.name,
      label: action.name,
    }));
  }, [value.entity, getActionValue]);

  const handleEntityChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newEntity = parseInt(e.target.value) as Entity;
      onChange({
        entity: newEntity,
        action: '',
      });
    },
    [onChange],
  );

  const handleActionChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange({
        ...value,
        action: e.target.value,
      });
    },
    [value, onChange],
  );

  return (
    <div className="ActionField">
      <label className="ActionFieldLabel">{label}</label>
      <div className="ActionFieldInputs">
        <EntityField
          components={[sdk.components.Actions] as Component[]}
          value={value.entity}
          onChange={handleEntityChange}
        />
        <Dropdown
          placeholder="Select an Action"
          disabled={!value.entity || availableActions.length === 0}
          options={availableActions}
          value={value.action}
          searchable
          onChange={handleActionChange}
        />
      </div>
    </div>
  );
};

export default React.memo(withSdk(ActionField));
