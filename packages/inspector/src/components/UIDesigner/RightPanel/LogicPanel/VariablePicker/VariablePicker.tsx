import React, { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { isValidIdentifier } from '../../../../../lib/sdk/operations/validators';
import { DiamondPlus } from '../../DiamondPlus';
import { usePopoverPosition } from '../../../../ui/usePopoverPosition';
import { KIND_TO_CODE_TYPES, type FieldConfig } from '../../PropertyPanel/field-configs';
import type { BindVariable } from '../../../code/bindings';
import { addBindVariable, useCodeState } from '../../../code/store';

import './VariablePicker.css';

function coercionLabel(field: FieldConfig, v: BindVariable): string {
  if (field.kind === 'string' && v.type !== 'string') {
    return `${v.name} (${v.type} → string)`;
  }
  return v.name;
}

interface PickItem {
  key: string;
  label: string;
  expr: string;
}

interface VariablePickerProps {
  field: FieldConfig;
  anchorRef: React.RefObject<HTMLElement>;
  onPick: (expr: string) => void;
  onDismiss: () => void;
}

export const VariablePicker: React.FC<VariablePickerProps> = ({
  field,
  anchorRef,
  onPick,
  onDismiss,
}) => {
  const { bindingSurface } = useCodeState();
  const popoverRef = useRef<HTMLDivElement>(null);
  const pos = usePopoverPosition({ anchorRef, popoverRef, open: true, onDismiss, width: 200 });

  const suggested = field.path.replace(/[^A-Za-z0-9_$]/g, '_') || 'variable';
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(suggested);
  const [error, setError] = useState<string | undefined>(undefined);

  const items = useMemo<PickItem[]>(() => {
    const allowed = field.strictTypes ?? KIND_TO_CODE_TYPES[field.kind] ?? [];
    return bindingSurface.variables
      .filter(v => allowed.includes(v.type))
      .map(v => ({ key: v.name, label: coercionLabel(field, v), expr: v.expr }));
  }, [bindingSurface, field]);

  const commitNew = useCallback(async () => {
    const trimmed = name.trim();
    if (!isValidIdentifier(trimmed)) {
      setError('Not a valid name (letters, digits, _ ; no leading digit)');
      return;
    }
    if (bindingSurface.variables.some(v => v.name === trimmed)) {
      setError('Name already in use');
      return;
    }
    const type = (KIND_TO_CODE_TYPES[field.kind] ?? ['string'])[0];
    await addBindVariable(trimmed, type);
    onPick(`state.${trimmed}`);
  }, [bindingSurface, field, name, onPick]);

  return createPortal(
    <div
      ref={popoverRef}
      className="ui-designer-variable-picker"
      style={{ position: 'fixed', top: pos.top, left: pos.left }}
    >
      {items.length === 0 ? (
        <div className="ui-designer-variable-picker-empty">No compatible variables.</div>
      ) : null}
      {items.map(item => (
        <button
          key={item.key}
          type="button"
          className="ui-designer-variable-picker-row"
          onClick={() => onPick(item.expr)}
        >
          {item.label}
        </button>
      ))}
      {adding ? (
        <div className="ui-designer-variable-picker-new">
          {}
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
              if (e.key === 'Enter') void commitNew();
              if (e.key === 'Escape') setAdding(false);
            }}
          />
          <button
            type="button"
            className={`ui-designer-variable-picker-confirm${
              isValidIdentifier(name.trim()) &&
              !bindingSurface.variables.some(v => v.name === name.trim())
                ? ' is-ready'
                : ''
            }`}
            onClick={() => void commitNew()}
          >
            ADD
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
          <DiamondPlus />
          Add new variable
        </button>
      )}
    </div>,
    document.body,
  );
};

export default VariablePicker;
