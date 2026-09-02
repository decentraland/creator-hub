import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Entity } from '@dcl/ecs';

import { debounce } from '../../../../../lib/utils/debounce';
import type { FieldConfig } from '../field-configs';
import { SegmentKind } from '../../../shared/tree-model';
import type { CanvasSegment } from '../../../shared/tree-model';
import { VariablePicker } from '../../LogicPanel/VariablePicker';
import { setMixedContentAttribute } from '../../../code/store';
import { normalizeSegments, serializeNodes } from './segments';

import './MixedContentField.css';

interface MixedContentFieldProps {
  field: FieldConfig;
  entity: Entity;
  segments: CanvasSegment[];
  autoFocus?: boolean;
}

function createChip(variable: string): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.className = 'ui-designer-mixed-chip';
  chip.contentEditable = 'false';
  chip.dataset.variable = variable;
  const label = document.createElement('span');
  label.className = 'ui-designer-mixed-chip-label';
  label.textContent = variable;
  const remove = document.createElement('span');
  remove.className = 'ui-designer-mixed-chip-remove';
  remove.dataset.remove = '1';
  remove.textContent = '×';
  chip.append(label, remove);
  return chip;
}

function renderSegments(editor: HTMLElement, segments: CanvasSegment[]): void {
  editor.replaceChildren();
  for (const seg of segments) {
    if (seg.kind === SegmentKind.BINDING) {
      editor.appendChild(createChip(seg.value));
    } else if (seg.value) {
      editor.appendChild(document.createTextNode(seg.value));
    }
  }
}

export const MixedContentField: React.FC<MixedContentFieldProps> = ({
  field,
  entity,
  segments,
  autoFocus,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const savedRange = useRef<Range | null>(null);
  const seededKeyRef = useRef<string>('');
  const lastCommittedRef = useRef<string>('');
  const bindModeRef = useRef(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const seedKey = `${entity}:${field.componentId}.${field.path}`;

  const commit = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const normalized = normalizeSegments(serializeNodes(editor));
    const signature = JSON.stringify(normalized);
    if (signature === lastCommittedRef.current) return;
    lastCommittedRef.current = signature;
    void setMixedContentAttribute(entity as unknown as number, field.path, normalized);
  }, [entity, field.path]);

  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);
  const debouncedCommit = useMemo(() => debounce(() => commitRef.current(), 400), []);

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (seededKeyRef.current === seedKey) return;
    seededKeyRef.current = seedKey;
    renderSegments(editor, segments);
    lastCommittedRef.current = JSON.stringify(normalizeSegments(segments));
  }, [seedKey, segments]);

  useEffect(() => {
    if (!autoFocus) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const sel = document.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [autoFocus]);

  const saveSelection = useCallback(() => {
    const sel = document.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const onPick = useCallback(
    (variable: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      const chip = createChip(variable);
      if (bindModeRef.current) {
        bindModeRef.current = false;
        editor.replaceChildren(chip);
        setPickerOpen(false);
        commit();
        return;
      }
      const range = savedRange.current;
      if (range && editor.contains(range.startContainer)) {
        range.deleteContents();
        range.insertNode(chip);
        const after = document.createRange();
        after.setStartAfter(chip);
        after.collapse(true);
        const sel = document.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(after);
      } else {
        editor.appendChild(chip);
      }
      setPickerOpen(false);
      commit();
    },
    [commit],
  );

  const onEditorMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const removeBtn = (e.target as HTMLElement).closest('[data-remove]');
      if (!removeBtn) return;
      e.preventDefault();
      const chip = removeBtn.closest('[data-variable]');
      chip?.parentNode?.removeChild(chip);
      commit();
    },
    [commit],
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      if (!text) return;
      const sel = document.getSelection();
      if (!sel || sel.rangeCount === 0 || !editorRef.current?.contains(sel.anchorNode)) return;
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const node = document.createTextNode(text);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      debouncedCommit();
    },
    [debouncedCommit],
  );

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        editorRef.current?.blur();
        return;
      }
      if (e.key === '{') {
        const sel = document.getSelection();
        const anchor = sel?.anchorNode;
        const offset = sel?.anchorOffset ?? 0;
        if (
          anchor?.nodeType === Node.TEXT_NODE &&
          offset > 0 &&
          anchor.textContent?.[offset - 1] === '{'
        ) {
          e.preventDefault();
          const txt = anchor.textContent ?? '';
          anchor.textContent = txt.slice(0, offset - 1) + txt.slice(offset);
          const range = document.createRange();
          range.setStart(anchor, offset - 1);
          range.collapse(true);
          sel?.removeAllRanges();
          sel?.addRange(range);
          saveSelection();
          bindModeRef.current = false;
          setPickerOpen(true);
        }
      }
    },
    [saveSelection],
  );

  return (
    <div className="ui-designer-mixed-field">
      <div
        ref={editorRef}
        className="ui-designer-mixed-editable"
        contentEditable
        spellCheck={false}
        suppressContentEditableWarning
        role="textbox"
        aria-label={field.label}
        data-placeholder={field.label}
        onInput={() => debouncedCommit()}
        onBlur={commit}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onMouseDown={onEditorMouseDown}
        onPaste={onPaste}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onKeyDown={onKeyDown}
      />
      <button
        ref={anchorRef}
        type="button"
        className="ui-designer-bindable-link ui-designer-mixed-link"
        onMouseDown={e => {
          e.preventDefault();
          saveSelection();
        }}
        onClick={() => {
          bindModeRef.current = true;
          setPickerOpen(true);
        }}
        aria-label="Bind to variable"
      />
      {pickerOpen ? (
        <VariablePicker
          field={field}
          anchorRef={anchorRef}
          onPick={onPick}
          onDismiss={() => {
            bindModeRef.current = false;
            setPickerOpen(false);
          }}
        />
      ) : null}
    </div>
  );
};

export default MixedContentField;
