import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDrag } from 'react-dnd';
import { IoClose, IoEyeOffOutline, IoEyeOutline, IoLayersOutline } from 'react-icons/io5';

import { useAppDispatch } from '../../../redux/hooks';
import { selectNode } from '../../../redux/ui-designer';
import { Button } from '../../Button';
import { UI_DESIGNER_DND_TYPE, type UIDesignerDragItem } from '../Palette';
import {
  type CodeRoot,
  createRoot,
  removeRoot,
  renameRoot,
  selectRootFile,
  toggleTopLevel,
  useCodeState,
} from './store';

import './CodeRootsList.css';

// One row in the roots list: selects on click, renames on double-click, and is a
// DnD source so it can be dragged onto a canvas node to nest it as a component.
// The eye toggle flips top-level (aggregated screen) vs component (nested-only).
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
      // Not draggable while renaming (the input owns the pointer).
      ref={editing ? undefined : (drag as unknown as React.Ref<HTMLDivElement>)}
      className={`ui-designer-code-root-row ${active ? 'is-active' : ''}`}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      onClick={onSelect}
      title={`Drag onto the canvas to nest ${root.name} as a component`}
    >
      <IoLayersOutline aria-hidden="true" />
      {editing ? (
        <input
          className="ui-designer-code-root-name-input"
          value={draft}
          autoFocus
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          onClick={e => e.stopPropagation()}
          onChange={e => onDraft(e.target.value)}
          onKeyDown={e => {
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
      <button
        type="button"
        className={`ui-designer-code-root-toplevel ${root.topLevel ? 'is-on' : ''}`}
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
          <IoEyeOffOutline aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        className="ui-designer-code-root-remove"
        title={`Delete ${root.name}`}
        aria-label={`Delete ${root.name}`}
        onClick={onRemove}
      >
        <IoClose aria-hidden="true" />
      </button>
    </div>
  );
};

// Code-mode roots list. Roots are files under src/ui/ (one component per file),
// not ECS marker entities — so this is backed by the code store rather than the
// engine. "+ New UI" generates src/ui/<Name>.tsx and regenerates the aggregator;
// selecting a root loads its file as the active source the canvas edits.
export const CodeRootsList: React.FC = () => {
  const { roots, filename, parsed } = useCodeState();
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

  // When the active root file changes (and its tree has parsed), select the root
  // node so the canvas / "Add widget" / PropertyPanel target it. Guarded by a ref
  // on the filename so it fires on root *switches* only — not on every reparse
  // (which would fight canvas node selection during editing).
  const prevFile = useRef<string | null>(null);
  useEffect(() => {
    if (filename && filename !== prevFile.current && parsed?.root) {
      prevFile.current = filename;
      dispatch(selectNode({ node: parsed.root.entity }));
    }
  }, [filename, parsed, dispatch]);

  const handleCreate = useCallback(() => void createRoot(), []);

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

  return (
    <div className="ui-designer-roots-list">
      <div className="ui-designer-roots-header">
        <Button onClick={handleCreate}>+ New UI</Button>
      </div>
      <div className="ui-designer-roots-tree">
        {roots.map(root => (
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
