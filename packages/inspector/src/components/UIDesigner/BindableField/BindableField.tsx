import React from 'react';
import type { Entity } from '@dcl/ecs';

import { Block } from '../../Block';
import { Pill } from '../../ui/Pill';
import type { FieldConfig } from '../field-configs';
import { BindAffordance } from '../BindAffordance';
import { useFieldBinding } from '../useFieldBinding';

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
  const isBindable = field.bindable !== false;
  const { pickerOpen, setPickerOpen, anchorRef, onBind, onUnbind } = useFieldBinding(field, entity);

  if (!isBindable) {
    return (
      <Block
        label={field.label}
        info={field.info}
      >
        {children}
      </Block>
    );
  }

  if (bound) {
    return (
      <Block
        label={field.label}
        info={field.info}
      >
        <Pill
          content={bound.variable}
          onRemove={onUnbind}
        />
      </Block>
    );
  }

  return (
    <Block
      label={field.label}
      info={field.info}
    >
      <div className="ui-designer-bindable-row">
        <div className="ui-designer-bindable-content">{children}</div>
        <BindAffordance
          field={field}
          selectedRoot={selectedRoot}
          anchorRef={anchorRef}
          pickerOpen={pickerOpen}
          setPickerOpen={setPickerOpen}
          onBind={onBind}
        />
      </div>
    </Block>
  );
};

export default BindableField;
