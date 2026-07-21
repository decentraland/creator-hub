import React, { useEffect, useRef, useState } from 'react';

import { isValidIdentifier } from '../../../lib/sdk/operations/validators';
import { TextField } from '../../ui';
import { type CodeAction, isValidTemplate } from './actions';
import type { BindVariable } from './bindings';
import { addBindAction, removeAction, setActionBody, useCodeState } from './store';

import './CodeCallbacksPanel.css';

// If the caret sits inside an unclosed, single-line `{{ …` opened before it,
// return the open-brace offset + the partial typed so far (for autocomplete).
function openTemplate(value: string, caret: number): { start: number; partial: string } | null {
  const before = value.slice(0, caret);
  const open = before.lastIndexOf('{{');
  if (open === -1) return null;
  if (before.lastIndexOf('}}') > open) return null; // already closed
  const inner = before.slice(open + 2);
  if (inner.includes('\n')) return null; // a template stays on one line
  return { start: open, partial: inner.trim() };
}

// The `{{ }}` token for a variable — props are QUALIFIED (`props.x`) so they can't
// collide with a same-named state variable; state/markers stay bare.
function tokenFor(v: BindVariable): string {
  return v.expr.startsWith('props.') ? `props.${v.name}` : v.name;
}

// A callback input is invoked, not interpolated — the autocomplete inserts a
// ready `{{ props.x }}()` call (the code-side `?.` is added on write).
function isCallbackInput(v: BindVariable): boolean {
  return v.type === 'callback' && v.expr.startsWith('props.');
}

// The `{{ var }}`-template body editor for one callback: a plain code textarea
// (buffered, commits on blur) with a `{{` autocomplete over the binding surface.
// Deliberately a raw <textarea>, not ui/TextArea: the autocomplete needs direct
// caret access (`selectionStart` / `setSelectionRange`) on the element, which
// TextArea's buffered value layer doesn't expose reliably.
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

  // Re-sync from source when not editing (an external/round-trip change) — but
  // never while focused (a reparse would clobber the caret) and never while the
  // local text is invalid (that would discard the in-progress edit the author is
  // still fixing). So an invalid body stays put, flagged, until it's valid.
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

  // Only sync valid templates; an invalid one stays local (never written to the
  // .tsx) until the author fixes it.
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
    // A callback insert drops the caret INSIDE the () so args can be typed.
    const pos = open.start + (isCall ? `{{ ${token} }}(`.length : insert.length);
    setLocal(next);
    setPartial(null);
    // Restore focus + caret after the controlled re-render.
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
              // Keep the textarea focused so the caret survives the click.
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
          Use <code>{'{{ variable }}'}</code> to reference a variable · type <code>{'{{'}</code> for
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
        ✕
      </button>
    </div>
    <CallbackBodyEditor
      name={action.name}
      template={action.template}
      vars={vars}
    />
  </div>
);

// Action (event-handler) manager for the active UI file. Lists each
// /** @ui-action */ handler and edits its body as a `{{ var }}` template, or
// declares a new one; the per-field 🔗 then binds it to an event.
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
    <div className="ui-designer-callbacks">
      <div className="ui-designer-callbacks-title">Actions</div>

      {actions.length === 0 ? (
        <div className="ui-designer-callbacks-empty">No actions yet.</div>
      ) : null}

      {actions.map(a => (
        <CallbackCard
          key={a.name}
          action={a}
          // Handlers take the args object `{ state, props, value }`, so both state
          // variables and props are referenceable in the `{{ }}` body.
          vars={bindingSurface.variables}
        />
      ))}

      <div className="ui-designer-callbacks-add">
        <TextField
          aria-label="New action name"
          value={name}
          placeholder="new action"
          onChange={e => setName(e.target.value)}
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

export const CodeCallbacksPanel = React.memo(CodeCallbacksPanelComponent);
export default CodeCallbacksPanel;
