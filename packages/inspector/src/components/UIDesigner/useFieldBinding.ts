import { useCallback, useRef, useState } from 'react';
import type { Entity } from '@dcl/ecs';

import type { FieldConfig } from './field-configs';
import { bindAttribute, unbindAttribute } from './code/store';

// Shared bind/unbind + picker state for BindableField and BindableSubField.
// Code-as-source: binding a field splices `<El attr={expr} />` into the .tsx
// (bindAttribute) and unbinding removes the attribute (unbindAttribute) — no
// asset-packs::UIBindings write. `field.path` is the JSX attribute name.
export function useFieldBinding(field: FieldConfig, entity: Entity) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const id = entity as unknown as number;

  const onBind = useCallback(
    (expr: string) => {
      void bindAttribute(id, field.path, expr);
      setPickerOpen(false);
    },
    [id, field.path],
  );

  const onUnbind = useCallback(() => {
    void unbindAttribute(id, field.path);
  }, [id, field.path]);

  return { pickerOpen, setPickerOpen, anchorRef, onBind, onUnbind };
}
