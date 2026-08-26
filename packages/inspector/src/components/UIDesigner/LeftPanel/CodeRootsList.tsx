import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDrag } from 'react-dnd';
import { IoEyeOffOutline, IoEyeOutline, IoTrashOutline } from 'react-icons/io5';
import cx from 'classnames';

import { useAppDispatch } from '../../../redux/hooks';
import { selectNode } from '../../../redux/ui-designer';
import { UI_DESIGNER_DND_TYPE, type UIDesignerDragItem } from '../shared/dnd';
import { GuiGridIcon } from '../shared/widget-icons';
import {
  type CodeRoot,
  removeRoot,
  renameRoot,
  selectRootFile,
  toggleTopLevel,
  useCodeState,
} from '../code/store';

import './CodeRootsList.css';

/**
 * One row in the roots list: selects on click, renames on double-click, and is a
 * DnD source so it can be dragged onto a canvas node to nest it as a component.
 * The eye toggle flips top-level (aggregated screen) vs component (nested-only);
 * a nested-only root reads grayed, since it renders nowhere on its own.
 *
 * The drag ref is withheld while renaming, because the input owns the pointer.
 * That rename editor is a raw <input> rather than ui/TextField on purpose: it is
 * transient (autoFocus + Enter/Escape/blur lifecycle) and TextField's chrome
 * (InputContainer, Message slot) only adds noise.
 */
const RootRow: React.FC<{
  root: CodeRoot;
  active: boolean;
  editing: boolean;
  draft: string;
  onSelect: () => void;
  onBeginEdit: () => void;
  onDraft: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onRemove: (e: React.MouseEvent) => void;
}> = ({
  root,
  active,
  editing,
  draft,
  onSelect,
  onBeginEdit,
  onDraft,
  onCommit,
  onCancel,
  onRemove,
}) => {
  const [{ isDragging }, drag] = useDrag<UIDesignerDragItem, unknown, { isDragging: boolean }>(
    () => ({
      type: UI_DESIGNER_DND_TYPE,
      item: { source: 'component', name: root.name },
      collect: monitor => ({ isDragging: monitor.isDragging() }),
    }),
    [root.name],
  );

  return (
    <div
      ref={editing ? undefined : (drag as unknown as React.Ref<HTMLDivElement>)}
      className={cx('ui-designer-code-root-row', {
        'is-active': active,
        'is-hidden': !root.topLevel,
      })}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      role="button"
      tabIndex={0}
      aria-current={active}
      onClick={onSelect}
      onKeyDown={e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        onSelect();
      }}
      title={`Drag onto the canvas to nest ${root.name} as a component`}
    >
      <GuiGridIcon />
      {editing ? (
        <input
          className="ui-designer-code-root-name-input"
          value={draft}
          autoFocus
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          aria-label={`Rename ${root.name}`}
          onClick={e => e.stopPropagation()}
          onChange={e => onDraft(e.target.value)}
          onKeyDown={e => {
            e.stopPropagation();
            if (e.key === 'Enter') onCommit();
            else if (e.key === 'Escape') onCancel();
          }}
          onBlur={onCommit}
        />
      ) : (
        <span
          className="ui-designer-code-root-name"
          onDoubleClick={e => {
            e.stopPropagation();
            onBeginEdit();
          }}
        >
          {root.name}
        </span>
      )}
      <div className="ui-designer-code-root-actions">
        <button
          type="button"
          className={cx('ui-designer-code-root-toplevel', { 'is-on': root.topLevel })}
          title={
            root.topLevel
              ? 'Top-level: rendered on its own. Click to make it a nested-only component.'
              : 'Component: only rendered where it is nested. Click to make it top-level.'
          }
          aria-label={`Toggle top-level for ${root.name}`}
          aria-pressed={root.topLevel}
          onClick={e => {
            e.stopPropagation();
            void toggleTopLevel(root.filename);
          }}
        >
          {root.topLevel ? (
            <IoEyeOutline aria-hidden="true" />
          ) : (
            <IoEyeOffOutline
              className="is-off"
              aria-hidden="true"
            />
          )}
        </button>
        <button
          type="button"
          className="ui-designer-code-root-remove"
          title={`Delete ${root.name}`}
          aria-label={`Delete ${root.name}`}
          onClick={onRemove}
        >
          <IoTrashOutline aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

/**
 * Code-mode roots list. Roots are files under src/ui/ (one component per file),
 * not ECS marker entities — so this is backed by the code store rather than the
 * engine. Creation lives in the rail's section header; selecting a root loads its
 * file as the active source the canvas edits.
 *
 * Switching root selects that root's node, so the canvas / "Add widget" /
 * PropertyPanel target it. A ref on the filename keeps that to root SWITCHES
 * only — firing on every reparse would fight canvas node selection mid-edit.
 */
export const CodeRootsList: React.FC<{ filter?: string }> = ({ filter = '' }) => {
  const { roots, filename, parsed, error } = useCodeState();
  const dispatch = useAppDispatch();

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const beginEdit = useCallback((root: CodeRoot) => {
    setEditing(root.filename);
    setDraft(root.name);
  }, []);

  const commitEdit = useCallback(
    (root: CodeRoot) => {
      const next = draft.trim();
      setEditing(null);
      if (next && next !== root.name) void renameRoot(root.filename, next);
    },
    [draft],
  );

  const prevFile = useRef<string | null>(null);
  useEffect(() => {
    if (filename && filename !== prevFile.current && parsed?.root) {
      prevFile.current = filename;
      dispatch(selectNode({ node: parsed.root.entity }));
    }
  }, [filename, parsed, dispatch]);

  const handleSelect = useCallback(
    (root: CodeRoot) => {
      if (root.filename !== filename) void selectRootFile(root.filename);
    },
    [filename],
  );

  const handleRemove = useCallback((e: React.MouseEvent, root: CodeRoot) => {
    e.stopPropagation();
    void removeRoot(root.filename);
  }, []);

  const term = filter.trim().toLowerCase();
  const shown = term ? roots.filter(root => root.name.toLowerCase().includes(term)) : roots;

  return (
    <div className="ui-designer-roots-list">
      {error ? (
        <div
          className="ui-designer-roots-error"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      <div className="ui-designer-roots-tree">
        {shown.map(root => (
          <RootRow
            key={root.filename}
            root={root}
            active={root.filename === filename}
            editing={editing === root.filename}
            draft={draft}
            onSelect={() => handleSelect(root)}
            onBeginEdit={() => beginEdit(root)}
            onDraft={setDraft}
            onCommit={() => commitEdit(root)}
            onCancel={() => setEditing(null)}
            onRemove={e => handleRemove(e, root)}
          />
        ))}
      </div>
    </div>
  );
};

export default React.memo(CodeRootsList);
