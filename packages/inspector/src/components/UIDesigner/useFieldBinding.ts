import { useCallback, useRef, useState } from 'react';
import type { Entity } from '@dcl/ecs';

import { useSdk } from '../../hooks/sdk/useSdk';
import type { FieldConfig } from './field-configs';

// Shared bind/unbind + picker state for BindableField and BindableSubField.
// Extracted because both components had a verbatim copy of this logic
// (review.md §2 — "Consolidate BindableField and BindableSubField").
export function useFieldBinding(field: FieldConfig, entity: Entity) {
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

  return { pickerOpen, setPickerOpen, anchorRef, onBind, onUnbind };
}
