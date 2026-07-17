import React, { useEffect, useState } from 'react';
import type { Entity } from '@dcl/ecs';

import { CheckboxField, TextField } from '../../ui';
import { BindAffordance } from '../BindAffordance';
import type { FieldConfig, FieldKind } from '../field-configs';
import { useFieldBinding } from '../useFieldBinding';
import type { PropVar } from './props-convention';
import { selectRootFile, spliceInstanceProp, unsetInstanceProp, useCodeState } from './store';
import type { CodeUINode, ComponentRefProp } from './types';

import './CodeVariablesPanel.css';

// Declared prop type → the field kind the VariablePicker filters by. A
// 'callback' prop lists @ui-action handlers; primitives list matching-type
// state variables; 'unknown' (a hand-authored non-primitive) can't bind.
const PROP_KIND: Record<string, FieldKind | undefined> = {
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  callback: 'callback',
};

// One editable instance-prop row: the value passed to THIS `<Name … />`.
// Literal values are buffered inputs (commit on blur; booleans a checkbox);
// the 🔗 binds the prop to the ACTIVE file's binding surface instead — a state
// variable (`title={state.playerName}`) or, for a callback-typed prop, an
// @ui-action handler (`onClick={(value) => onSave(state, value)}`). A prop
// bound to an expression shows the expression; ✕ clears the attribute so the
// prop falls back to the component's own default handling.
const InstancePropRow: React.FC<{
  entity: number;
  prop: PropVar;
  current?: ComponentRefProp;
}> = ({ entity, prop, current }) => {
  const bound = current?.expr !== undefined;
  const currentValue = current?.value !== undefined ? String(current.value) : '';
  const [local, setLocal] = useState(currentValue);
  const [focused, setFocused] = useState(false);

  const kind = PROP_KIND[prop.type];
  // Synthesized field config: `path` is the JSX attribute the binding splices.
  // strictTypes keeps the picker to exact-type variables — a TS-typed prop
  // doesn't get render-time string coercion.
  const field: FieldConfig = {
    label: prop.name,
    componentId: 'ui::props',
    path: prop.name,
    kind: kind ?? 'string',
    strictTypes: kind && kind !== 'callback' ? [prop.type] : undefined,
  };
  const { pickerOpen, setPickerOpen, anchorRef, onBind } = useFieldBinding(
    field,
    entity as unknown as Entity,
  );

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
          title="Bound to an expression — ✕ clears it"
        >
          {current?.expr}
        </em>
      ) : prop.type === 'callback' ? (
        <em
          className="ui-designer-code-variable-source"
          title="Bind an event handler with the link button"
        >
          (unbound)
        </em>
      ) : prop.type === 'unknown' ? (
        // A non-primitive declared type (function/union/object) — a text-field
        // write would corrupt it, so it's edit-in-code only.
        <em
          className="ui-designer-code-variable-source"
          title="Non-primitive prop type — edit it in code"
        >
          (code)
        </em>
      ) : prop.type === 'boolean' ? (
        <CheckboxField
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
        <TextField
          className="ui-designer-code-variable-default"
          aria-label={prop.name}
          type={prop.type === 'number' ? 'number' : 'text'}
          value={local}
          placeholder={prop.type}
          onChange={e => setLocal(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
        />
      )}
      {kind ? (
        <BindAffordance
          field={field}
          anchorRef={anchorRef}
          pickerOpen={pickerOpen}
          setPickerOpen={setPickerOpen}
          onBind={onBind}
        />
      ) : null}
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
        Values passed to this instance. Type a literal or 🔗 a state variable/action from this file.
      </div>

      {declared.length === 0 ? (
        <div className="ui-designer-code-variables-empty">
          No inputs declared. Open {name} and add inputs (Logic tab) to configure it here.
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
