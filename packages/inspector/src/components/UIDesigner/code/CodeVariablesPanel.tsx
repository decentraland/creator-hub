import React, { useEffect, useState } from 'react';
import { IoListOutline } from 'react-icons/io5';

import { isValidIdentifier } from '../../../lib/sdk/operations/validators';
import { CheckboxField, Dropdown, TextField } from '../../ui';
import { EmptyState } from '../EmptyState';
import type { BindVariable } from './bindings';
import {
  addBindVariable,
  removeStateVariable,
  retypeStateVariable,
  setStateVariableValue,
  useCodeState,
} from './store';

import './CodeVariablesPanel.css';

const TYPES = ['string', 'number', 'boolean'];
const TYPE_OPTIONS = TYPES.map(t => ({ value: t, label: t }));

// One editable row for a typed-state variable: type (retype), default value
// (buffered — commits on blur so a mid-edit reparse can't clobber the caret; see
// docs/coding-standards.md), and delete. Booleans use an immediate checkbox.
const CodeVariableRow: React.FC<{ v: BindVariable }> = ({ v }) => {
  const current = String(v.value ?? '');
  const [local, setLocal] = useState(current);
  const [focused, setFocused] = useState(false);

  // Re-sync from source when the underlying value changes, but never while the
  // user owns the field (an in-flight reparse must not overwrite what they typed).
  useEffect(() => {
    if (!focused) setLocal(current);
  }, [current, focused]);

  const commit = () => {
    if (local !== current) void setStateVariableValue(v.name, v.type, local);
  };

  return (
    <div className="ui-designer-code-variable-row">
      <span className="ui-designer-code-variable-name">{v.name}</span>
      <Dropdown
        aria-label={`Type of ${v.name}`}
        options={TYPE_OPTIONS}
        value={v.type}
        onChange={e => void retypeStateVariable(v.name, String(e.target.value))}
      />
      {v.type === 'boolean' ? (
        <CheckboxField
          aria-label={`Default of ${v.name}`}
          checked={v.value === true || v.value === 'true'}
          onChange={e =>
            void setStateVariableValue(v.name, 'boolean', e.target.checked ? 'true' : 'false')
          }
        />
      ) : (
        <TextField
          className="ui-designer-code-variable-default"
          aria-label={`Default of ${v.name}`}
          type={v.type === 'number' ? 'number' : 'text'}
          value={local}
          placeholder="default"
          onChange={e => setLocal(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
        />
      )}
      <button
        type="button"
        className="ui-designer-code-variable-delete"
        title={`Delete ${v.name}`}
        aria-label={`Delete ${v.name}`}
        onClick={() => void removeStateVariable(v.name)}
      >
        ✕
      </button>
    </div>
  );
};

// Per-root variable manager for the active UI file's typed `state` object — the
// primary binding surface (see code/state-convention.ts). Lists each state
// variable (name + type + default + delete) and declares new ones; Properties >
// the per-field 🔗 then binds a node's field to one. Hand-authored
// /** @ui-bind */ markers (foreign code, bound bare) are shown read-only.
const CodeVariablesPanelComponent: React.FC = () => {
  const { filename, bindingSurface } = useCodeState();
  const [name, setName] = useState('');
  const [type, setType] = useState('string');
  const [def, setDef] = useState('');

  if (!filename) {
    return (
      <EmptyState
        icon={<IoListOutline />}
        title="No GUI selected"
        message="Create or select a GUI to declare state variables you can bind fields to."
      />
    );
  }

  // The binding surface has three kinds: imported vars (declared in another file,
  // read-only here), local state vars (`expr === state.<name>`, fully editable),
  // and local /** @ui-bind */ marker vars (bare expr, read-only). See
  // store.buildBindingSurface / augmentWithImports.
  const importedVars = bindingSurface.variables.filter(v => v.imported);
  const stateVars = bindingSurface.variables.filter(
    v => !v.imported && v.expr === `state.${v.name}`,
  );
  // Markers exclude props (`props.x`) — those are managed by CodePropsPanel.
  const markerVars = bindingSurface.variables.filter(
    v => !v.imported && v.expr !== `state.${v.name}` && !v.expr.startsWith('props.'),
  );
  const taken = new Set(bindingSurface.variables.map(v => v.name));
  const trimmed = name.trim();
  const canAdd = isValidIdentifier(trimmed) && !taken.has(trimmed);

  const add = () => {
    if (!canAdd) return;
    void addBindVariable(trimmed, type, def);
    setName('');
    setDef('');
  };

  return (
    <div className="ui-designer-code-variables">
      <div className="ui-designer-code-variables-title">State</div>
      <div className="ui-designer-code-variables-hint">
        This GUI's own data · <code>{filename.split('/').pop()}</code>
      </div>

      {stateVars.length === 0 && markerVars.length === 0 && importedVars.length === 0 ? (
        <div className="ui-designer-code-variables-empty">No state variables yet.</div>
      ) : null}

      {stateVars.map(v => (
        <CodeVariableRow
          key={v.name}
          v={v}
        />
      ))}

      {markerVars.map(v => (
        <div
          key={v.name}
          className="ui-designer-code-variable-row is-readonly"
          title="Declared with a /** @ui-bind */ marker — edit in code"
        >
          <span className="ui-designer-code-variable-name">{v.name}</span>
          <em className="ui-designer-code-variable-source">{v.type} · @ui-bind</em>
        </div>
      ))}

      {importedVars.map(v => (
        <div
          key={`import:${v.name}`}
          className="ui-designer-code-variable-row is-readonly"
          title={`Imported from ${v.imported} — edit it there`}
        >
          <span className="ui-designer-code-variable-name">{v.name}</span>
          <em className="ui-designer-code-variable-source">
            {v.type} · from {v.imported?.split('/').pop()}
          </em>
        </div>
      ))}

      <div className="ui-designer-code-variables-add">
        <TextField
          aria-label="New variable name"
          value={name}
          placeholder="new variable"
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') add();
          }}
        />
        <Dropdown
          aria-label="New variable type"
          options={TYPE_OPTIONS}
          value={type}
          onChange={e => setType(String(e.target.value))}
        />
        <TextField
          className="ui-designer-code-variable-default"
          aria-label="New variable default"
          value={def}
          placeholder="default"
          onChange={e => setDef(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') add();
          }}
        />
        <button
          type="button"
          disabled={!canAdd}
          onClick={add}
        >
          + Add
        </button>
      </div>
    </div>
  );
};

export const CodeVariablesPanel = React.memo(CodeVariablesPanelComponent);
export default CodeVariablesPanel;
