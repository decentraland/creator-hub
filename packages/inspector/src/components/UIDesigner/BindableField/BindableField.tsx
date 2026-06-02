import React, { useCallback, useRef, useState } from 'react';
import type { Entity } from '@dcl/ecs';

import { Block } from '../../Block';
import { Pill } from '../../ui/Pill';
import { useSdk } from '../../../hooks/sdk/useSdk';
import type { FieldConfig } from '../field-configs';
import { VariablePicker } from '../VariablePicker';

import './BindableField.css';

interface BindableFieldProps {
  field: FieldConfig;
  entity: Entity;
  selectedRoot: Entity;
  bound?: { variable: string };
  children: React.ReactNode;
}

export const BindableField: React.FC<BindableFieldProps> = ({
  field,
  entity,
  selectedRoot,
  bound,
  children,
}) => {
  const sdk = useSdk();
  const [pickerOpen, setPickerOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const isBindable = field.bindable !== false;
  const pathKey = `${field.componentId}.${field.path}`;

  const onBind = useCallback(
    (variableName: string) => {
      if (!sdk) return;
      sdk.operations.bindField(entity, pathKey, variableName);
      void sdk.operations.dispatch();
      setPickerOpen(false);
    },
    [sdk, entity, pathKey],
  );
  const onUnbind = useCallback(() => {
    if (!sdk) return;
    sdk.operations.unbindField(entity, pathKey);
    void sdk.operations.dispatch();
  }, [sdk, entity, pathKey]);

  if (!isBindable) {
    return <Block label={field.label}>{children}</Block>;
  }

  if (bound) {
    return (
      <Block label={field.label}>
        <Pill
          content={bound.variable}
          onRemove={onUnbind}
        />
      </Block>
    );
  }

  return (
    <Block label={field.label}>
      <div className="ui-designer-bindable-row">
        <div className="ui-designer-bindable-content">{children}</div>
        <button
          ref={anchorRef}
          type="button"
          className="ui-designer-bindable-link"
          onClick={() => setPickerOpen(true)}
          aria-label="Bind to variable"
        >
          {'\u{1F517}'}
        </button>
        {pickerOpen && (
          <VariablePicker
            field={field}
            selectedRoot={selectedRoot}
            anchorRef={anchorRef}
            onPick={onBind}
            onDismiss={() => setPickerOpen(false)}
          />
        )}
      </div>
    </Block>
  );
};

export default BindableField;
