import React, { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { isValidIdentifier } from '../../../lib/sdk/operations/validators';
import { usePopoverPosition } from '../../ui/usePopoverPosition';
import type { FieldConfig, FieldKind } from '../field-configs';
import type { BindVariable } from '../code/bindings';
import { addBindVariable, useCodeState } from '../code/store';

import './VariablePicker.css';

// Which code-mode variable types a field kind can bind to. A string field takes
// any (it coerces to text at render); numeric fields take numbers; booleans take
// booleans. Fields with no compatible code type (color / arrays) offer none.
const KIND_TO_CODE_TYPES: Partial<Record<FieldKind, string[]>> = {
  string: ['string', 'number', 'boolean'],
  number: ['number'],
  length: ['number'],
  index: ['number'],
  boolean: ['boolean'],
};

// On a string-kind field every non-string variable is shown (it coerces to a
// string at render time). Make that explicit in the row label, e.g.
// "score (number → string)".
function coercionLabel(field: FieldConfig, v: BindVariable): string {
  if (field.kind === 'string' && v.type !== 'string') {
    return `${v.name} (${v.type} → string)`;
  }
  return v.name;
}

interface PickItem {
  key: string;
  label: string;
  // The expression spliced into the attribute: `state.score` (variable) or a
  // bare handler name (callback).
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
  // Mounted only while open (the parent gates with `pickerOpen`), so `open` is true.
  const pos = usePopoverPosition({ anchorRef, popoverRef, open: true, onDismiss, width: 200 });

  const suggested = field.path.replace(/[^A-Za-z0-9_$]/g, '_') || 'variable';
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(suggested);
  const [error, setError] = useState<string | undefined>(undefined);

  // Events are NOT listed here — they pick a handler through CallbackField's own
  // dropdown. This is variables only: the typed-state / marker values compatible
  // with the field kind.
  const items = useMemo<PickItem[]>(() => {
    // `strictTypes` (e.g. a typed component prop) lists exact-type matches
    // only — the render-time string coercion that makes any variable valid on
    // a text FIELD does not apply to a TS-typed prop.
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
    // MUST await: the add splices + reparses (shifting byte offsets); binding
    // before that lands would splice with stale AST spans and corrupt the file.
    const type = (KIND_TO_CODE_TYPES[field.kind] ?? ['string'])[0];
    await addBindVariable(trimmed, type);
    onPick(`state.${trimmed}`); // a new variable is seeded into the typed `state` object
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
          {/* Deliberately a raw <input>, not ui/TextField: a transient inline
              editor (autoFocus + Enter/Escape lifecycle) where TextField's
              chrome (InputContainer, Message slot) adds noise, not value. */}
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
            className="ui-designer-variable-picker-confirm"
            onClick={() => void commitNew()}
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
