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

/**
 * The bind affordance shared by BindableField and BindableSubField: a button that
 * opens a VariablePicker anchored to it. Binding state is owned by the caller's
 * `useFieldBinding`, passed in here, so each parent keeps a single hook instance
 * and the two wrappers (Block vs div) stay distinct.
 *
 * The glyph is a CSS mask rather than an <img> or an icon component, so the
 * button's own resting / hover / focus colours paint it — see BindableField.css.
 */
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
