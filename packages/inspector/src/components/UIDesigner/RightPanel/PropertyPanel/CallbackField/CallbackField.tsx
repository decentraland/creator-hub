import React, { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AiOutlinePlus } from 'react-icons/ai';
import { VscTrash } from 'react-icons/vsc';
import type { Entity } from '@dcl/ecs';

import { isValidIdentifier } from '../../../../../lib/sdk/operations/validators';
import { Block } from '../../../../Block';
import { usePopoverPosition } from '../../../../ui/usePopoverPosition';
import type { FieldConfig } from '../field-configs';
import { isActionNameTaken } from '../../../code/bindings';
import { addBindAction, bindAttribute, unbindAttribute, useCodeState } from '../../../code/store';

import './CallbackField.css';

// Event fields that DELIVER a value to their callback (react-ecs calls them
// with the typed text / selected index). Everything else — the four mouse
// events — is a zero-arg `Callback`, where a value-taking arrow would not
// typecheck ("Target signature provides too few arguments").
const VALUE_EVENT_FIELDS = new Set([
  'core::UiInput.onChange',
  'core::UiInput.onSubmit',
  'core::UiDropdown.onChange',
]);

// The thunk spliced into an event attribute / callback prop for handler `name`.
// The handler takes the args OBJECT `{ state, props, value }`, so the thunk passes
// `{ state, props }` (both are in scope inside the component render), adding
// `value` for events that deliver one. The `value` param is annotated (scene
// tsconfigs are strict — a bare `(value)` is an implicit any) and typed `unknown`
// (its value-linking design is deferred); its optionality mirrors the target — a
// callback PROP is `(value?: unknown) => void`, so the arrow's param is optional.
export function thunkExprFor(field: FieldConfig, name: string): string {
  const key = `${field.componentId}.${field.path}`;
  if (VALUE_EVENT_FIELDS.has(key)) return `(value: unknown) => ${name}({ state, props, value })`;
  if (field.componentId === 'ui::props')
    return `(value?: unknown) => ${name}({ state, props, value })`;
  return `() => ${name}({ state, props })`;
}

interface CallbackFieldProps {
  field: FieldConfig;
  entity: Entity;
  // The handler NAME currently bound to this event, from the parsed bindings.
  bound?: string;
}

/**
 * An event row: a dropdown over the declared `@ui-action` handlers, per the
 * design's `MouseEventsMenu`.
 *
 * Deliberately NOT the 🔗 `BindableField` every other bindable row uses. An event
 * has one job — run a handler — so the design gives it a value control that
 * always shows its current state, rather than an affordance that has to be
 * hovered to be found. Variables keep the 🔗.
 *
 * The list is never filtered by what is already bound: one handler driving both
 * Mouse Down and Mouse Up is legitimate, and hiding it would make a hand-authored
 * reuse absent from its own dropdown.
 */
export const CallbackField: React.FC<CallbackFieldProps> = ({ field, entity, bound }) => {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const id = entity as unknown as number;

  const pick = useCallback(
    (name: string | null) => {
      if (name === null) void unbindAttribute(id, field.path);
      else void bindAttribute(id, field.path, thunkExprFor(field, name));
      setOpen(false);
    },
    [id, field],
  );

  const label = field.label ?? field.path;

  return (
    <Block
      label={field.label}
      info={field.info}
    >
      <div className="ui-designer-callback-row">
        <button
          ref={anchorRef}
          type="button"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={`ui-designer-callback-trigger${bound ? '' : ' empty'}`}
          onClick={() => setOpen(o => !o)}
        >
          <span className="ui-designer-callback-value">{bound ?? 'None'}</span>
        </button>
        {/* The lane is always present, so every field ends at the same x whether
            or not its row carries a clear button. */}
        <span className="ui-designer-callback-clear-lane">
          {bound ? (
            <button
              type="button"
              className="ui-designer-callback-clear"
              aria-label={`Clear ${label}`}
              title={`Clear ${label}`}
              onClick={() => void unbindAttribute(id, field.path)}
            >
              <VscTrash aria-hidden />
            </button>
          ) : null}
        </span>
      </div>
      {open ? (
        <CallbackMenu
          field={field}
          bound={bound}
          anchorRef={anchorRef}
          onPick={pick}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </Block>
  );
};

interface CallbackMenuProps {
  field: FieldConfig;
  bound?: string;
  anchorRef: React.RefObject<HTMLElement>;
  onPick: (name: string | null) => void;
  onDismiss: () => void;
}

const MENU_WIDTH = 200;

const CallbackMenu: React.FC<CallbackMenuProps> = ({
  field,
  bound,
  anchorRef,
  onPick,
  onDismiss,
}) => {
  const { bindingSurface } = useCodeState();
  const popoverRef = useRef<HTMLDivElement>(null);
  const pos = usePopoverPosition({
    anchorRef,
    popoverRef,
    open: true,
    onDismiss,
    width: MENU_WIDTH,
  });

  const [adding, setAdding] = useState(false);
  // The design pre-fills the name with the event's own, which is the common case
  // (one handler per event) and always a valid identifier.
  const [name, setName] = useState(field.path);
  const [error, setError] = useState<string | undefined>(undefined);

  const commitNew = useCallback(async () => {
    const trimmed = name.trim();
    if (!isValidIdentifier(trimmed)) {
      setError('Not a valid name (letters, digits, _ ; no leading digit)');
      return;
    }
    if (isActionNameTaken(bindingSurface, trimmed)) {
      setError('Name already in use');
      return;
    }
    // MUST await: the add splices + reparses (shifting byte offsets); binding
    // before that lands would splice with stale AST spans and corrupt the file.
    await addBindAction(trimmed);
    onPick(trimmed);
  }, [bindingSurface, name, onPick]);

  const option = (key: string, text: string, selected: boolean, onClick: () => void) => (
    <button
      key={key}
      type="button"
      role="option"
      aria-selected={selected}
      className={`ui-designer-callback-option${selected ? ' selected' : ''}`}
      onClick={onClick}
    >
      {text}
    </button>
  );

  return createPortal(
    <div
      ref={popoverRef}
      role="listbox"
      aria-label={`${field.label ?? field.path} handler`}
      className="ui-designer-callback-menu"
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: MENU_WIDTH }}
    >
      {option('__none__', 'None', !bound, () => onPick(null))}
      {bindingSurface.actions.map(a =>
        option(a.name, `${a.name}()`, a.name === bound, () => onPick(a.name)),
      )}
      <div className="ui-designer-callback-menu-divider" />
      {adding ? (
        <div className="ui-designer-callback-add">
          {/* A raw <input>, not ui/TextField, for the same reason VariablePicker
              uses one: TextField debounces its onChange, so a name typed and
              immediately confirmed would commit the previous value. Wrapping the
              label also spares this transient editor an id. */}
          <label className="ui-designer-callback-add-field">
            Description
            <input
              className="ui-designer-callback-add-name"
              autoFocus
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              value={name}
              onChange={e => {
                setName(e.target.value);
                setError(undefined);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') void commitNew();
                if (e.key === 'Escape') setAdding(false);
              }}
            />
          </label>
          <button
            type="button"
            className="ui-designer-callback-add-confirm"
            onClick={() => void commitNew()}
          >
            ADD
          </button>
          {error ? <div className="ui-designer-callback-add-error">{error}</div> : null}
        </div>
      ) : (
        <button
          type="button"
          className="ui-designer-callback-add-trigger"
          onClick={() => {
            setName(field.path);
            setError(undefined);
            setAdding(true);
          }}
        >
          <AiOutlinePlus aria-hidden />
          Add New Action
        </button>
      )}
    </div>,
    document.body,
  );
};

export default CallbackField;
