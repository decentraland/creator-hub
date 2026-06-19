import React from 'react';
import { IoLinkOutline } from 'react-icons/io5';
import type { Entity } from '@dcl/ecs';

import type { FieldConfig } from './field-configs';
import { VariablePicker } from './VariablePicker';

interface BindAffordanceProps {
  field: FieldConfig;
  selectedRoot: Entity;
  anchorRef: React.RefObject<HTMLButtonElement>;
  pickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
  onBind: (variable: string) => void;
}

// The 🔗 affordance shared by BindableField and BindableSubField: a link button
// that opens a VariablePicker anchored to it. Binding state is owned by the
// caller's `useFieldBinding`, passed in here, so each parent keeps a single hook
// instance and the two wrappers (Block vs div) stay distinct.
export const BindAffordance: React.FC<BindAffordanceProps> = ({
  field,
  selectedRoot,
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
    >
      <IoLinkOutline aria-hidden="true" />
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
  </>
);

export default BindAffordance;
