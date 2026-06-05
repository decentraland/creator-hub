import React, { useCallback, useRef, useState } from 'react';
import type { Entity } from '@dcl/ecs';

import { Pill } from '../../ui/Pill';
import { useSdk } from '../../../hooks/sdk/useSdk';
import type { FieldConfig } from '../field-configs';
import { VariablePicker } from '../VariablePicker';

import './BindableSubField.css';

interface BindableSubFieldProps {
  field: FieldConfig; // synthetic: { componentId, path, kind, label }
  entity: Entity;
  selectedRoot: Entity;
  bound?: string;
  children: React.ReactNode;
}

export const BindableSubField: React.FC<BindableSubFieldProps> = ({
  field,
  entity,
  selectedRoot,
  bound,
  children,
}) => {
  const sdk = useSdk();
  const [pickerOpen, setPickerOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
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

  if (bound) {
    return (
      <div className="ui-designer-bindable-subfield">
        <Pill
          content={bound}
          onRemove={onUnbind}
        />
      </div>
    );
  }

  return (
    <div className="ui-designer-bindable-subfield">
      <div className="ui-designer-bindable-subfield-content">{children}</div>
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
  );
};

export default BindableSubField;
