import React, { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Entity, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { UI, UIVariable } from '@dcl/asset-packs';
import { ComponentName, VariableType } from '@dcl/asset-packs';

import { useSdk } from '../../../hooks/sdk/useSdk';
import { isValidIdentifier } from '../../../lib/sdk/operations/validators';
import { usePopoverPosition } from '../../ui/usePopoverPosition';
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
  // Mounted only while open (the parent gates with `pickerOpen`), so `open` is true.
  const pos = usePopoverPosition({ anchorRef, popoverRef, open: true, onDismiss, width: 200 });

  const suggested = field.path.replace(/[^A-Za-z0-9_$]/g, '_') || 'variable';
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(suggested);
  const [error, setError] = useState<string | undefined>(undefined);

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

  const commitNew = useCallback(() => {
    if (!sdk) return;
    const UIComp = sdk.engine.getComponentOrNull(
      ComponentName.UI,
    ) as LastWriteWinElementSetComponentDefinition<UI> | null;
    if (!UIComp) return;
    const marker = UIComp.getOrNull(selectedRoot);
    if (!marker) return;
    const trimmed = name.trim();
    if (!isValidIdentifier(trimmed)) {
      setError('Not a valid name (letters, digits, _ ; no leading digit)');
      return;
    }
    if (marker.variables.some(v => v.name === trimmed)) {
      setError('Name already in use');
      return;
    }
    const allowed = KIND_TO_VARIABLE_TYPES[field.kind] ?? [VariableType.STRING];
    sdk.operations.declareVariable(selectedRoot, {
      name: trimmed,
      type: allowed[0],
      defaultValue: '',
    });
    void sdk.operations.dispatch();
    onPick(trimmed);
  }, [sdk, selectedRoot, field, name, onPick]);

  return createPortal(
    <div
      ref={popoverRef}
      className="ui-designer-variable-picker"
      style={{ position: 'fixed', top: pos.top, left: pos.left }}
    >
      {compatible.length === 0 ? (
        <div className="ui-designer-variable-picker-empty">No compatible variables.</div>
      ) : null}
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
      {adding ? (
        <div className="ui-designer-variable-picker-new">
          <input
            className="ui-designer-variable-picker-name"
            autoFocus
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            value={name}
            placeholder="Variable name"
            onChange={e => {
              setName(e.target.value);
              setError(undefined);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') commitNew();
              if (e.key === 'Escape') setAdding(false);
            }}
          />
          <button
            type="button"
            className="ui-designer-variable-picker-confirm"
            onClick={commitNew}
          >
            Add
          </button>
          {error ? <div className="ui-designer-variable-picker-error">{error}</div> : null}
        </div>
      ) : (
        <button
          type="button"
          className="ui-designer-variable-picker-add"
          onClick={() => {
            setName(suggested);
            setError(undefined);
            setAdding(true);
          }}
        >
          + Add new variable…
        </button>
      )}
    </div>,
    document.body,
  );
};

export default VariablePicker;
