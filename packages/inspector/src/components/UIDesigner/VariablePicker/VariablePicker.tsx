import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Entity, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { UI, UIVariable } from '@dcl/asset-packs';
import { ComponentName, VariableType } from '@dcl/asset-packs';

import { useSdk } from '../../../hooks/sdk/useSdk';
import type { FieldConfig, FieldKind } from '../field-configs';

import './VariablePicker.css';

const KIND_TO_VARIABLE_TYPES: Partial<Record<FieldKind, VariableType[]>> = {
  string: [VariableType.STRING],
  number: [VariableType.NUMBER],
  boolean: [VariableType.BOOLEAN],
  color: [VariableType.COLOR],
  'string-array': [VariableType.STRING_ARRAY],
  callback: [VariableType.CALLBACK],
};

interface VariablePickerProps {
  field: FieldConfig;
  selectedRoot: Entity;
  anchorRef: React.RefObject<HTMLElement>;
  onPick: (name: string) => void;
  onDismiss: () => void;
}

export const VariablePicker: React.FC<VariablePickerProps> = ({
  field,
  selectedRoot,
  anchorRef,
  onPick,
  onDismiss,
}) => {
  const sdk = useSdk();
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onDismiss();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onDismiss, anchorRef]);

  const compatible = useMemo<UIVariable[]>(() => {
    if (!sdk) return [];
    const UIComp = sdk.engine.getComponentOrNull(
      ComponentName.UI,
    ) as LastWriteWinElementSetComponentDefinition<UI> | null;
    if (!UIComp) return [];
    const marker = UIComp.getOrNull(selectedRoot);
    if (!marker) return [];
    const allowed = KIND_TO_VARIABLE_TYPES[field.kind] ?? [];
    return marker.variables.filter(v => allowed.includes(v.type));
  }, [sdk, selectedRoot, field.kind]);

  const onAddNew = useCallback(() => {
    if (!sdk) return;
    const UIComp = sdk.engine.getComponentOrNull(
      ComponentName.UI,
    ) as LastWriteWinElementSetComponentDefinition<UI> | null;
    if (!UIComp) return;
    const marker = UIComp.getOrNull(selectedRoot);
    if (!marker) return;
    const allowed = KIND_TO_VARIABLE_TYPES[field.kind] ?? [VariableType.STRING];
    const base = field.path.replace(/[^A-Za-z0-9_$]/g, '_') || 'variable';
    let name = base;
    let n = 1;
    while (marker.variables.some(v => v.name === name)) {
      n += 1;
      name = `${base}_${n}`;
    }
    sdk.operations.declareVariable(selectedRoot, {
      name,
      type: allowed[0],
      defaultValue: '',
    });
    void sdk.operations.dispatch();
    onPick(name);
  }, [sdk, selectedRoot, field, onPick]);

  return (
    <div
      ref={popoverRef}
      className="ui-designer-variable-picker"
    >
      {compatible.length === 0 && (
        <div className="ui-designer-variable-picker-empty">No compatible variables.</div>
      )}
      {compatible.map(v => (
        <button
          key={v.name}
          type="button"
          className="ui-designer-variable-picker-row"
          onClick={() => onPick(v.name)}
        >
          {v.name}
        </button>
      ))}
      <button
        type="button"
        className="ui-designer-variable-picker-add"
        onClick={onAddNew}
      >
        + Add new variable…
      </button>
    </div>
  );
};

export default VariablePicker;
