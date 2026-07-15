import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Entity } from '@dcl/ecs';
import { SegmentKind } from '@dcl/asset-packs';

import { debounce } from '../../../lib/utils/debounce';
import type { FieldConfig } from '../field-configs';
import type { CanvasSegment } from '../tree-model';
import { VariablePicker } from '../VariablePicker';
import { setMixedContentAttribute } from '../code/store';
import { normalizeSegments, serializeNodes } from './segments';

import './MixedContentField.css';

interface MixedContentFieldProps {
  field: FieldConfig;
  entity: Entity;
  segments: CanvasSegment[];
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
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const savedRange = useRef<Range | null>(null);
  const seededKeyRef = useRef<string>('');
  const lastCommittedRef = useRef<string>('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const seedKey = `${entity}:${field.componentId}.${field.path}`;

  const commit = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const normalized = normalizeSegments(serializeNodes(editor));
    const signature = JSON.stringify(normalized);
    if (signature === lastCommittedRef.current) return; // nothing changed
    lastCommittedRef.current = signature;
    // Code-as-source: splice the attribute as a template literal / plain string
    // / bare expression (setAttributeSegments collapses the three cases). No
    // asset-packs::UIBindings write.
    void setMixedContentAttribute(entity as unknown as number, field.path, normalized);
  }, [entity, field.path]);

  // Stable debounced wrapper that always invokes the latest `commit`.
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);
  const debouncedCommit = useMemo(() => debounce(() => commitRef.current(), 400), []);

  // Seed the editor DOM only when the selected entity/field changes — never on
  // every external engine tick, which would reset the caret while typing.
  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (seededKeyRef.current === seedKey) return;
    seededKeyRef.current = seedKey;
    renderSegments(editor, segments);
    lastCommittedRef.current = JSON.stringify(normalizeSegments(segments));
  }, [seedKey, segments]);

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
      // Insert plain text at the caret via Range (not the deprecated
      // execCommand('insertText'), which is a no-op in Firefox / some Electron
      // isolation contexts → silent paste loss). Mirrors the chip-insert path.
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
      // Range mutations don't reliably fire `input`, so commit explicitly.
      debouncedCommit();
    },
    [debouncedCommit],
  );

  // Drag-and-drop can insert rich HTML (foreign elements carrying a
  // data-variable the user never picked). The chip editor has no drop gesture,
  // so reject both dragover and drop outright — pairs with onPaste as the
  // contentEditable trust boundary. See security-review.md Medium #1.
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // Single-line field: prevent <br>/<div> insertion.
      e.preventDefault();
      editorRef.current?.blur();
    }
  }, []);

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
        className="ui-designer-mixed-link"
        onMouseDown={e => {
          e.preventDefault(); // keep the editor's caret/selection for insertion
          saveSelection();
        }}
        onClick={() => setPickerOpen(true)}
        aria-label="Insert variable"
      >
        {'\u{1F517}'}
      </button>
      {pickerOpen ? (
        <VariablePicker
          field={field}
          anchorRef={anchorRef}
          onPick={onPick}
          onDismiss={() => setPickerOpen(false)}
        />
      ) : null}
    </div>
  );
};

export default MixedContentField;
