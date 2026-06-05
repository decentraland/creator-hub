import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Entity, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { UI, UIVariable } from '@dcl/asset-packs';
import { ComponentName, VariableType } from '@dcl/asset-packs';

import { useSdk } from '../../../hooks/sdk/useSdk';
import type { FieldConfig, FieldKind } from '../field-configs';

import './VariablePicker.css';

const KIND_TO_VARIABLE_TYPES: Partial<Record<FieldKind, VariableType[]>> = {
  string: [
    VariableType.STRING,
    VariableType.NUMBER,
    VariableType.BOOLEAN,
    VariableType.COLOR,
    VariableType.STRING_ARRAY,
  ],
  number: [VariableType.NUMBER],
  length: [VariableType.NUMBER],
  index: [VariableType.NUMBER],
  boolean: [VariableType.BOOLEAN],
  color: [VariableType.COLOR],
  'string-array': [VariableType.STRING_ARRAY],
  callback: [VariableType.CALLBACK],
};

// On a string-kind field every non-string variable is shown (it coerces to a
// string at render time). Make that explicit in the row label so the creator
// knows what they're embedding, e.g. "score (number → string)".
function coercionLabel(field: FieldConfig, v: UIVariable): string {
  if (field.kind === 'string' && v.type !== VariableType.STRING) {
    return `${v.name} (${v.type} → string)`;
  }
  return v.name;
}

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
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useLayoutEffect(() => {
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      if (!a) return;
      const MENU_WIDTH = 200;
      const GAP = 4;
      // Prefer left-aligned to the anchor; clamp to the viewport's right edge.
      const left = Math.min(a.left, window.innerWidth - MENU_WIDTH - GAP);
      setPos({ top: a.bottom + GAP, left: Math.max(GAP, left) });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [anchorRef]);

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

  return createPortal(
    <div
      ref={popoverRef}
      className="ui-designer-variable-picker"
      style={{ position: 'fixed', top: pos.top, left: pos.left }}
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
          {coercionLabel(field, v)}
        </button>
      ))}
      <button
        type="button"
        className="ui-designer-variable-picker-add"
        onClick={onAddNew}
      >
        + Add new variable…
      </button>
    </div>,
    document.body,
  );
};

export default VariablePicker;
