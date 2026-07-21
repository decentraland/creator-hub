import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Entity } from '@dcl/ecs';

import { usePopoverPosition } from '../../ui/usePopoverPosition';
import Search from '../../Search';
import { spliceAddChild } from '../code/store';
import { type UINodeType } from '../tree-model';
import { WIDGET_CATALOG } from '../widget-catalog';

import './WidgetPicker.css';

const WIDTH = 240;

interface WidgetPickerProps {
  // Entity the new node is added under (when `onAdd` is not supplied).
  parent?: Entity;
  // Override where the picked widget goes — e.g. the empty-root drop zone routes
  // it to spliceSetRootChild (place the FIRST element) instead of spliceAddChild.
  onAdd?: (type: UINodeType, preset?: 'image') => void;
  anchorRef: React.RefObject<HTMLElement>;
  onDismiss: () => void;
}

// Godot "Create Node" / UMG palette style picker: a searchable, categorized list
// of widgets. Picking one splices a new flow child under `parent` into the active
// .tsx (the same code path as the palette drag-drop; no ECS entity, no absolute
// positioning) — or routes to `onAdd` when supplied.
export const WidgetPicker: React.FC<WidgetPickerProps> = ({
  parent,
  onAdd,
  anchorRef,
  onDismiss,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const pos = usePopoverPosition({ anchorRef, popoverRef, open: true, onDismiss, width: WIDTH });

  const q = query.trim().toLowerCase();
  const categories = useMemo(() => {
    if (!q) return WIDGET_CATALOG;
    return WIDGET_CATALOG.map(c => ({
      ...c,
      items: c.items.filter(
        i => i.label.toLowerCase().includes(q) || i.keywords?.some(k => k.includes(q)),
      ),
    })).filter(c => c.items.length > 0);
  }, [q]);

  const add = (item: (typeof WIDGET_CATALOG)[number]['items'][number]) => {
    if (onAdd) {
      onAdd(item.type as UINodeType, item.preset);
    } else if (parent !== undefined) {
      void spliceAddChild(parent as unknown as number, item.type as UINodeType, item.preset);
    }
    onDismiss();
  };

  return createPortal(
    <div
      ref={popoverRef}
      className="ui-designer-widget-picker"
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: WIDTH }}
    >
      <div className="ui-designer-widget-picker-search">
        <Search
          value={query}
          onChange={setQuery}
          placeholder="Search widgets…"
        />
      </div>
      {categories.length === 0 ? (
        <div className="ui-designer-widget-picker-empty">No widgets match.</div>
      ) : null}
      {categories.map(c => (
        <div
          key={c.category}
          className="ui-designer-widget-picker-group"
        >
          <div className="ui-designer-widget-picker-category">{c.category}</div>
          {c.items.map(item => (
            <button
              key={item.id}
              type="button"
              className="ui-designer-widget-picker-row"
              onClick={() => add(item)}
            >
              <span
                className="ui-designer-widget-picker-icon"
                aria-hidden="true"
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ))}
    </div>,
    document.body,
  );
};

export default WidgetPicker;
