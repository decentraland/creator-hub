import React, { useEffect, useRef, useState } from 'react';
import { VscTrash } from 'react-icons/vsc';

import { Container } from '../../../Container';
import { isValidIdentifier } from '../../../../lib/sdk/operations/validators';
import { TextField } from '../../../ui';
import { type CodeAction, isValidTemplate } from '../../code/actions';
import type { BindVariable } from '../../code/bindings';
import { addBindAction, removeAction, setActionBody, useCodeState } from '../../code/store';

import './CodeCallbacksPanel.css';

function openTemplate(value: string, caret: number): { start: number; partial: string } | null {
  const before = value.slice(0, caret);
  const open = before.lastIndexOf('{{');
  if (open === -1) return null;
  if (before.lastIndexOf('}}') > open) return null;
  const inner = before.slice(open + 2);
  if (inner.includes('\n')) return null;
  return { start: open, partial: inner.trim() };
}

function tokenFor(v: BindVariable): string {
  return v.expr.startsWith('props.') ? `props.${v.name}` : v.name;
}

function isCallbackInput(v: BindVariable): boolean {
  return v.type === 'callback' && v.expr.startsWith('props.');
}

const CallbackBodyEditor: React.FC<{ name: string; template: string; vars: BindVariable[] }> = ({
  name,
  template,
  vars,
}) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [local, setLocal] = useState(template);
  const [focused, setFocused] = useState(false);
  const [partial, setPartial] = useState<string | null>(null);

  const invalid = !isValidTemplate(local);

  useEffect(() => {
    if (!focused && isValidTemplate(local)) setLocal(template);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, focused]);

  const matches =
    partial === null ? [] : vars.filter(v => v.name.toLowerCase().includes(partial.toLowerCase()));

  const syncPopup = (value: string, caret: number) => {
    const open = openTemplate(value, caret);
    setPartial(open ? open.partial : null);
  };

  const commit = () => {
    if (!invalid && local !== template) void setActionBody(name, local);
  };

  const pick = (token: string, isCall = false) => {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart ?? local.length;
    const open = openTemplate(local, caret);
    if (!open) return;
    const insert = isCall ? `{{ ${token} }}()` : `{{ ${token} }}`;
    const next = `${local.slice(0, open.start)}${insert}${local.slice(caret)}`;
    const pos = open.start + (isCall ? `{{ ${token} }}(`.length : insert.length);
    setLocal(next);
    setPartial(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="ui-designer-callback-body">
      <textarea
        ref={ref}
        className={`ui-designer-callback-textarea${invalid ? ' is-invalid' : ''}`}
        value={local}
        spellCheck={false}
        rows={Math.max(2, local.split('\n').length)}
        placeholder="e.g. {{ counter }} += 1"
        onChange={e => {
          setLocal(e.target.value);
          syncPopup(e.target.value, e.target.selectionStart ?? 0);
        }}
        onKeyUp={e => syncPopup(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
        onClick={e => syncPopup(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
        onKeyDown={e => {
          if (partial !== null && e.key === 'Enter' && matches.length > 0) {
            e.preventDefault();
            pick(tokenFor(matches[0]), isCallbackInput(matches[0]));
          } else if (e.key === 'Escape') {
            setPartial(null);
          }
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setPartial(null);
          commit();
        }}
      />
      {partial !== null && matches.length > 0 ? (
        <div className="ui-designer-callback-autocomplete">
          {matches.map(v => (
            <button
              key={v.expr}
              type="button"
              className="ui-designer-callback-autocomplete-row"
              onMouseDown={e => {
                e.preventDefault();
                pick(tokenFor(v), isCallbackInput(v));
              }}
            >
              {tokenFor(v)}
              <em>{v.type}</em>
            </button>
          ))}
        </div>
      ) : null}
      {invalid ? (
        <div className="ui-designer-callback-invalid">
          Invalid <code>{'{{ … }}'}</code> — each reference needs a single variable name. Not saved
          until fixed.
        </div>
      ) : (
        <div className="ui-designer-callback-hint">
          Use <code>{'{{ variable }}'}</code> to reference a variable. Type <code>{'{{'}</code> for
          suggestions
        </div>
      )}
    </div>
  );
};

const CallbackCard: React.FC<{ action: CodeAction; vars: BindVariable[] }> = ({ action, vars }) => (
  <div className="ui-designer-callback-card">
    <div className="ui-designer-callback-head">
      <span className="ui-designer-callback-name">{action.name}</span>
      <button
        type="button"
        className="ui-designer-callback-delete"
        title={`Delete ${action.name}`}
        aria-label={`Delete ${action.name}`}
        onClick={() => void removeAction(action.name)}
      >
        <VscTrash aria-hidden />
      </button>
    </div>
    <CallbackBodyEditor
      name={action.name}
      template={action.template}
      vars={vars}
    />
  </div>
);

const CodeCallbacksPanelComponent: React.FC = () => {
  const { filename, actions, bindingSurface } = useCodeState();
  const [name, setName] = useState('');

  if (!filename) return null;

  const trimmed = name.trim();
  const canAdd = isValidIdentifier(trimmed) && !actions.some(a => a.name === trimmed);

  const add = () => {
    if (!canAdd) return;
    void addBindAction(trimmed);
    setName('');
  };

  return (
    <Container
      label="Events"
      initialOpen
    >
      <div className="ui-designer-callbacks">
        {actions.length === 0 ? (
          <div className="ui-designer-callbacks-empty">No events yet.</div>
        ) : null}

        {actions.map(a => (
          <CallbackCard
            key={a.name}
            action={a}
            vars={bindingSurface.variables}
          />
        ))}

        <div className="ui-designer-callbacks-add">
          <TextField
            aria-label="New action name"
            value={name}
            placeholder="Name"
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') add();
            }}
          />
          <button
            type="button"
            className="ui-designer-code-add"
            aria-label="Add event"
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

export const CodeCallbacksPanel = React.memo(CodeCallbacksPanelComponent);
export default CodeCallbacksPanel;
