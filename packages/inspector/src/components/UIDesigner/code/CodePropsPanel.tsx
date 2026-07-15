import React, { useState } from 'react';

import { isValidIdentifier } from '../../../lib/sdk/operations/validators';
import type { BindVariable } from './bindings';
import { addBindProp, removeProp, retypeProp, useCodeState } from './store';

import './CodeVariablesPanel.css';

// 'callback' declares a function-typed prop (`(value?: string | number) =>
// void`) — the instance binds an @ui-action handler to it via the 🔗.
const TYPES = ['string', 'number', 'boolean', 'callback'];

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
      <div className="ui-designer-code-variables-title">Props</div>
      <div className="ui-designer-code-variables-hint">
        Inputs this component receives when nested. Bind a field to <code>props.name</code>.
      </div>

      {propVars.length === 0 ? (
        <div className="ui-designer-code-variables-empty">No props yet.</div>
      ) : null}

      {propVars.map((v: BindVariable) => (
        <div
          key={v.name}
          className="ui-designer-code-variable-row"
        >
          <span className="ui-designer-code-variable-name">{v.name}</span>
          <select
            aria-label={`Type of ${v.name}`}
            value={v.type}
            onChange={e => void retypeProp(v.name, e.target.value)}
          >
            {TYPES.map(t => (
              <option
                key={t}
                value={t}
              >
                {t}
              </option>
            ))}
            {!TYPES.includes(v.type) ? (
              // A hand-authored non-primitive type — shown as-is, edit in code.
              <option
                value={v.type}
                disabled
              >
                {v.type}
              </option>
            ) : null}
          </select>
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
        <input
          value={name}
          placeholder="new prop"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') add();
          }}
        />
        <select
          value={type}
          onChange={e => setType(e.target.value)}
        >
          {TYPES.map(t => (
            <option
              key={t}
              value={t}
            >
              {t}
            </option>
          ))}
        </select>
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
