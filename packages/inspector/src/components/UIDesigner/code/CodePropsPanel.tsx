import React, { useState } from 'react';

import { isValidIdentifier } from '../../../lib/sdk/operations/validators';
import { Dropdown, TextField } from '../../ui';
import type { BindVariable } from './bindings';
import { addBindProp, removeProp, retypeProp, useCodeState } from './store';

import './CodeVariablesPanel.css';

// 'callback' declares a function-typed prop (`(value?: string | number) =>
// void`) — the instance binds an @ui-action handler to it via the 🔗.
const TYPES = ['string', 'number', 'boolean', 'callback'];
const TYPE_OPTIONS = TYPES.map(t => ({ value: t, label: t }));

// Per-component props manager (the functional analog of the state-variable editor
// — see props-convention.ts). Declares the props the active root exposes; a field
// inside the component then binds to `props.<name>` via the per-field 🔗, and a
// nested instance sets values in the Properties panel. Props carry no default
// (they're instance-provided), so a row is just name + type + delete.
const CodePropsPanelComponent: React.FC = () => {
  const { filename, bindingSurface } = useCodeState();
  const [name, setName] = useState('');
  const [type, setType] = useState('string');

  if (!filename) return null;

  const propVars = bindingSurface.variables.filter(v => v.expr.startsWith('props.'));
  const taken = new Set(bindingSurface.variables.map(v => v.name));
  const trimmed = name.trim();
  const canAdd = isValidIdentifier(trimmed) && !taken.has(trimmed);

  const add = () => {
    if (!canAdd) return;
    void addBindProp(trimmed, type);
    setName('');
  };

  return (
    <div className="ui-designer-code-variables ui-designer-code-props">
      <div className="ui-designer-code-variables-title">Inputs</div>
      <div className="ui-designer-code-variables-hint">
        Values this component receives when nested. Bind a field to <code>props.name</code>.
      </div>

      {propVars.length === 0 ? (
        <div className="ui-designer-code-variables-empty">No inputs yet.</div>
      ) : null}

      {propVars.map((v: BindVariable) => (
        <div
          key={v.name}
          className="ui-designer-code-variable-row"
        >
          <span className="ui-designer-code-variable-name">{v.name}</span>
          <Dropdown
            aria-label={`Type of ${v.name}`}
            options={
              TYPES.includes(v.type)
                ? TYPE_OPTIONS
                : // A hand-authored non-primitive type — shown as-is, edit in code.
                  [...TYPE_OPTIONS, { value: v.type, label: v.type, disabled: true }]
            }
            value={v.type}
            onChange={e => void retypeProp(v.name, String(e.target.value))}
          />
          <button
            type="button"
            className="ui-designer-code-variable-delete"
            title={`Delete ${v.name}`}
            aria-label={`Delete ${v.name}`}
            onClick={() => void removeProp(v.name)}
          >
            ✕
          </button>
        </div>
      ))}

      <div className="ui-designer-code-variables-add">
        <TextField
          aria-label="New input name"
          value={name}
          placeholder="new input"
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') add();
          }}
        />
        <Dropdown
          aria-label="New input type"
          options={TYPE_OPTIONS}
          value={type}
          onChange={e => setType(String(e.target.value))}
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

export const CodePropsPanel = React.memo(CodePropsPanelComponent);
export default CodePropsPanel;
