import React, { useEffect, useState } from 'react';
import { IoListOutline } from 'react-icons/io5';
import { VscTrash } from 'react-icons/vsc';

import { Container } from '../../../Container';
import { isValidIdentifier } from '../../../../lib/sdk/operations/validators';
import { CheckboxField, Dropdown, TextField } from '../../../ui';
import { EmptyState } from '../../EmptyState';
import type { BindVariable } from '../../code/bindings';
import {
  addBindVariable,
  removeStateVariable,
  retypeStateVariable,
  setStateVariableValue,
  useCodeState,
} from '../../code/store';

import './CodeVariablesPanel.css';

const TYPES = ['string', 'number', 'boolean', 'Color4', 'string[]'];
const TYPE_OPTIONS = TYPES.map(t => ({ value: t, label: t }));

const CodeVariableRow: React.FC<{ v: BindVariable }> = ({ v }) => {
  const current = String(v.value ?? '');
  const [local, setLocal] = useState(current);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setLocal(current);
  }, [current, focused]);

  const commit = () => {
    if (local !== current) void setStateVariableValue(v.name, v.type, local);
  };

  return (
    <div className="ui-designer-code-variable-row">
      <span
        className="ui-designer-code-variable-name"
        title={v.name}
      >
        {v.name}
      </span>
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
          placeholder="Value"
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
        <VscTrash aria-hidden />
      </button>
    </div>
  );
};

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
        message="Create or select a GUI to declare variables you can bind fields to."
      />
    );
  }

  const importedVars = bindingSurface.variables.filter(v => v.imported);
  const stateVars = bindingSurface.variables.filter(
    v => !v.imported && v.expr === `state.${v.name}`,
  );
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
    <Container
      label="Variables"
      initialOpen
    >
      <div className="ui-designer-code-variables">
        <div className="ui-designer-code-variables-hint">
          GUI's data · <code>{filename.split('/').pop()}</code>
        </div>

        {stateVars.length === 0 && markerVars.length === 0 && importedVars.length === 0 ? (
          <div className="ui-designer-code-variables-empty">No variables yet.</div>
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
            placeholder="Name"
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
            placeholder="Value"
            onChange={e => setDef(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') add();
            }}
          />
          <button
            type="button"
            className="ui-designer-code-add"
            aria-label="Add variable"
            disabled={!canAdd}
            onClick={add}
          >
            +
          </button>
        </div>
      </div>
    </Container>
  );
};

export const CodeVariablesPanel = React.memo(CodeVariablesPanelComponent);
export default CodeVariablesPanel;
