import React from 'react';

import { VariablePicker } from '../LogicPanel/VariablePicker';
import type { FieldConfig } from './field-configs';

interface BindAffordanceProps {
  field: FieldConfig;
  anchorRef: React.RefObject<HTMLButtonElement>;
  pickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
  onBind: (expr: string) => void;
}

/** The bind affordance shared by BindableField and BindableSubField: a button opening a VariablePicker. */
export const BindAffordance: React.FC<BindAffordanceProps> = ({
  field,
  anchorRef,
  pickerOpen,
  setPickerOpen,
  onBind,
}) => (
  <>
    <button
      ref={anchorRef}
      type="button"
      className="ui-designer-bindable-link"
      onClick={() => setPickerOpen(true)}
      aria-label="Bind to variable"
      title="Bind this field to a variable"
    />
    {pickerOpen && (
      <VariablePicker
        field={field}
        anchorRef={anchorRef}
        onPick={onBind}
        onDismiss={() => setPickerOpen(false)}
      />
    )}
  </>
);

export default BindAffordance;
