import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IoClose, IoLayersOutline } from 'react-icons/io5';

import { useAppDispatch } from '../../../redux/hooks';
import { selectNode } from '../../../redux/ui-designer';
import { Button } from '../../Button';
import {
  type CodeRoot,
  createRoot,
  removeRoot,
  renameRoot,
  selectRootFile,
  useCodeState,
} from './store';

import './CodeRootsList.css';

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
          <div
            key={root.filename}
            className={`ui-designer-code-root-row ${root.filename === filename ? 'is-active' : ''}`}
            onClick={() => handleSelect(root)}
          >
            <IoLayersOutline aria-hidden="true" />
            {editing === root.filename ? (
              <input
                className="ui-designer-code-root-name-input"
                value={draft}
                autoFocus
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                onClick={e => e.stopPropagation()}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit(root);
                  else if (e.key === 'Escape') setEditing(null);
                }}
                onBlur={() => commitEdit(root)}
              />
            ) : (
              <span
                className="ui-designer-code-root-name"
                onDoubleClick={e => {
                  e.stopPropagation();
                  beginEdit(root);
                }}
              >
                {root.name}
              </span>
            )}
            <button
              type="button"
              className="ui-designer-code-root-remove"
              title={`Delete ${root.name}`}
              aria-label={`Delete ${root.name}`}
              onClick={e => handleRemove(e, root)}
            >
              <IoClose aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default React.memo(CodeRootsList);
