import React, { useState } from 'react';

import { useAppSelector } from '../../../redux/hooks';
import { getSelectedNode } from '../../../redux/ui-designer';
import { isValidIdentifier } from '../../../lib/sdk/operations/validators';
import { addBindVariable, bindAttribute, useCodeState } from './store';

import './CodeBindingsSection.css';

const TYPES = ['string', 'number', 'boolean'];

// Code-mode binding UI: surfaces the /** @ui-bind */ variables and
// /** @ui-action */ handlers parsed from the source, and lets the selected node
// reference one (value={var} / onMouseDown={handler}) or declare a new variable.
export const CodeBindingsSection: React.FC = () => {
  const { bindingSurface } = useCodeState();
  const selected = useAppSelector(getSelectedNode);
  const [name, setName] = useState('');
  const [type, setType] = useState('string');

  if (selected === null) return null;
  const id = selected as unknown as number;

  const canAdd =
    isValidIdentifier(name.trim()) && !bindingSurface.variables.some(v => v.name === name.trim());

  return (
    <div className="ui-designer-code-bindings">
      <div className="ui-designer-code-bindings-title">Bindings (code)</div>

      {bindingSurface.variables.length > 0 ? (
        <div className="ui-designer-code-bindings-row">
          <span className="ui-designer-code-bindings-label">value →</span>
          {bindingSurface.variables.map(v => (
            <button
              key={v.name}
              type="button"
              title={`Bind value to {${v.expr}}`}
              onClick={() => void bindAttribute(id, 'value', v.expr)}
            >
              {v.name}
              <em>{v.type}</em>
            </button>
          ))}
        </div>
      ) : null}

      {bindingSurface.actions.length > 0 ? (
        <div className="ui-designer-code-bindings-row">
          <span className="ui-designer-code-bindings-label">onMouseDown →</span>
          {bindingSurface.actions.map(a => (
            <button
              key={a.name}
              type="button"
              title={`Set onMouseDown={${a.name}}`}
              onClick={() => void bindAttribute(id, 'onMouseDown', a.name)}
            >
              {a.name}()
            </button>
          ))}
        </div>
      ) : null}

      <div className="ui-designer-code-bindings-add">
        <input
          value={name}
          placeholder="new variable"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          onChange={e => setName(e.target.value)}
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
          onClick={() => {
            void addBindVariable(name.trim(), type);
            setName('');
          }}
        >
          + Add variable
        </button>
      </div>
    </div>
  );
};
