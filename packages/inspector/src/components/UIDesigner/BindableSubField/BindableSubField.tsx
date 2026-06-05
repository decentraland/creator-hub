import React from 'react';
import type { Entity } from '@dcl/ecs';

import { Pill } from '../../ui/Pill';
import type { FieldConfig } from '../field-configs';
import { VariablePicker } from '../VariablePicker';
import { useFieldBinding } from '../useFieldBinding';

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
  const { pickerOpen, setPickerOpen, anchorRef, onBind, onUnbind } = useFieldBinding(field, entity);

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
