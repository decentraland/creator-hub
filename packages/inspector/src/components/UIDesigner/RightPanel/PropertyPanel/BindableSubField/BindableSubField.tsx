import React from 'react';
import type { Entity } from '@dcl/ecs';

import { Pill } from '../../../../ui/Pill';
import { isBindableProp, type FieldConfig } from '../field-configs';
import { BindAffordance } from '../BindAffordance';
import { useFieldBinding } from '../useFieldBinding';

import './BindableSubField.css';

interface BindableSubFieldProps {
  field: FieldConfig;
  entity: Entity;
  bound?: string;
  children: React.ReactNode;
}

export const BindableSubField: React.FC<BindableSubFieldProps> = ({
  field,
  entity,
  bound,
  children,
}) => {
  const { pickerOpen, setPickerOpen, anchorRef, onBind, onUnbind } = useFieldBinding(field, entity);

  if (bound) {
    return (
      <div className="ui-designer-bindable-subfield">
        <Pill
          content={bound}
          removeLabel={`Unbind ${bound} from ${field.path}`}
          onRemove={onUnbind}
        />
      </div>
    );
  }

  if (!isBindableProp(field)) {
    return <div className="ui-designer-bindable-subfield">{children}</div>;
  }

  return (
    <div className="ui-designer-bindable-subfield">
      <div className="ui-designer-bindable-subfield-content">{children}</div>
      <BindAffordance
        field={field}
        anchorRef={anchorRef}
        pickerOpen={pickerOpen}
        setPickerOpen={setPickerOpen}
        onBind={onBind}
      />
    </div>
  );
};

export default BindableSubField;
