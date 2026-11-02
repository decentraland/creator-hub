import { useCallback, useRef, useState } from 'react';
import type { Entity } from '@dcl/ecs';

import { bindAttribute, unbindAttribute } from '../../code/store';
import { bindPathFor, type FieldConfig } from './field-configs';

/** `field.path` names the prop; `field.componentId` says where it lives, letting the store splice a top-level attribute or an object key. */
export function useFieldBinding(field: FieldConfig, entity: Entity) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const id = entity as unknown as number;
  const path = bindPathFor(field);

  const onBind = useCallback(
    (expr: string) => {
      void bindAttribute(id, path, expr, field.componentId);
      setPickerOpen(false);
    },
    [id, path, field.componentId],
  );

  const onUnbind = useCallback(() => {
    void unbindAttribute(id, path, field.componentId);
  }, [id, path, field.componentId]);

  return { pickerOpen, setPickerOpen, anchorRef, onBind, onUnbind };
}
