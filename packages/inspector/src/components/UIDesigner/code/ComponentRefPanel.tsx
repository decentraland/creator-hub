import React, { useEffect, useState } from 'react';

import type { PropVar } from './props-convention';
import { selectRootFile, spliceInstanceProp, unsetInstanceProp, useCodeState } from './store';
import type { CodeUINode, ComponentRefProp } from './types';

import './CodeVariablesPanel.css';

// One editable instance-prop row: the value passed to THIS `<Name … />`. Buffered
// (commits on blur) so a mid-edit reparse can't clobber the caret; booleans use a
// checkbox. A prop bound to an expression in code (`x={state.on}`) is shown
// read-only — edit it in code.
const InstancePropRow: React.FC<{
  entity: number;
  prop: PropVar;
  current?: ComponentRefProp;
}> = ({ entity, prop, current }) => {
  const bound = current?.expr !== undefined;
  const currentValue = current?.value !== undefined ? String(current.value) : '';
  const [local, setLocal] = useState(currentValue);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setLocal(currentValue);
  }, [currentValue, focused]);

  const commit = () => {
    if (local !== currentValue) void spliceInstanceProp(entity, prop.name, prop.type, local);
  };

  return (
    <div className="ui-designer-code-variable-row">
      <span className="ui-designer-code-variable-name">{prop.name}</span>
      {bound ? (
        <em
          className="ui-designer-code-variable-source"
          title="Bound to an expression in code"
        >
          {current?.expr}
        </em>
      ) : prop.type === 'boolean' ? (
        <input
          type="checkbox"
          aria-label={prop.name}
          checked={current?.value === true || current?.value === 'true'}
          onChange={e =>
            void spliceInstanceProp(
              entity,
              prop.name,
              'boolean',
              e.target.checked ? 'true' : 'false',
            )
          }
        />
      ) : (
        <input
          className="ui-designer-code-variable-default"
          aria-label={prop.name}
          type={prop.type === 'number' ? 'number' : 'text'}
          value={local}
          placeholder={prop.type}
          spellCheck={false}
          onChange={e => setLocal(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
        />
      )}
      {current ? (
        <button
          type="button"
          className="ui-designer-code-variable-delete"
          title={`Clear ${prop.name}`}
          aria-label={`Clear ${prop.name}`}
          onClick={() => void unsetInstanceProp(entity, prop.name)}
        >
          ✕
        </button>
      ) : null}
    </div>
  );
};

// Property panel for a selected component-ref node: edit the values this instance
// passes to the nested component (its declared props), and jump to the component
// to edit it. Declared props come from the resolved component tree; current values
// from the instance's own JSX attributes.
export const ComponentRefPanel: React.FC<{ node: CodeUINode }> = ({ node }) => {
  const { componentTrees, roots } = useCodeState();
  const name = node.componentRef?.name ?? node.name;
  const declared = componentTrees[name]?.props ?? [];
  const entity = node.entity as unknown as number;
  const current = new Map((node.componentRef?.props ?? []).map(p => [p.name, p]));
  const target = roots.find(r => r.name === name);

  return (
    <div className="ui-designer-code-variables">
      <div className="ui-designer-code-variables-title">Component · {name}</div>
      <div className="ui-designer-code-variables-hint">
        Values passed to this instance. Edit <code>{name}</code> to change the component itself.
      </div>

      {declared.length === 0 ? (
        <div className="ui-designer-code-variables-empty">
          No props declared. Open {name} and add props (Variables tab) to configure it here.
        </div>
      ) : (
        declared.map(p => (
          <InstancePropRow
            key={p.name}
            entity={entity}
            prop={p}
            current={current.get(p.name)}
          />
        ))
      )}

      {target ? (
        <button
          type="button"
          className="ui-designer-code-open-component"
          onClick={() => void selectRootFile(target.filename)}
        >
          Open {name} ↗
        </button>
      ) : null}
    </div>
  );
};

export default ComponentRefPanel;
