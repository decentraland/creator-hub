import React, { useEffect, useState } from 'react';
import { IoCubeOutline } from 'react-icons/io5';
import { VscTrash } from 'react-icons/vsc';
import type { Entity } from '@dcl/ecs';

import { Container } from '../../../Container';
import { CheckboxField, TextField } from '../../../ui';
import { BindIcon } from '../BindIcon';
import type { PropVar } from '../../code/props-convention';
import {
  selectRootFile,
  spliceInstanceProp,
  unsetInstanceProp,
  useCodeState,
} from '../../code/store';
import type { CodeUINode, ComponentRefProp } from '../../code/types';
import { BindAffordance } from '../PropertyPanel/BindAffordance';
import type { FieldConfig, FieldKind } from '../PropertyPanel/field-configs';
import { useFieldBinding } from '../PropertyPanel/useFieldBinding';

import './CodeVariablesPanel.css';

const PROP_KIND: Record<string, FieldKind | undefined> = {
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  callback: 'callback',
};

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
      <span
        className="ui-designer-code-variable-name"
        title={prop.name}
      >
        {prop.name}
      </span>
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
          <VscTrash aria-hidden />
        </button>
      ) : null}
    </div>
  );
};

export const ComponentRefPanel: React.FC<{ node: CodeUINode }> = ({ node }) => {
  const { componentTrees, roots } = useCodeState();
  const name = node.componentRef?.name ?? node.name;
  const declared = componentTrees[name]?.props ?? [];
  const entity = node.entity as unknown as number;
  const current = new Map((node.componentRef?.props ?? []).map(p => [p.name, p]));
  const target = roots.find(r => r.name === name);

  return (
    <>
      <div className="ui-designer-code-gui-header">
        <IoCubeOutline aria-hidden="true" />
        <span className="ui-designer-code-gui-name">{name}</span>
      </div>
      <Container
        label="Inputs"
        initialOpen
      >
        <div className="ui-designer-code-variables">
          <div className="ui-designer-code-variables-hint">
            Values passed to this instance. Type a literal or <BindIcon /> a variable or event from
            this file.
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
              Open {name}
            </button>
          ) : null}
        </div>
      </Container>
    </>
  );
};

export default ComponentRefPanel;
