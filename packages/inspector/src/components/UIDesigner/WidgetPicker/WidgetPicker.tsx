import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Entity } from '@dcl/ecs';

import { useSdk } from '../../../hooks/sdk/useSdk';
import { useAppDispatch } from '../../../redux/hooks';
import { selectNode } from '../../../redux/ui-designer';
import { usePopoverPosition } from '../../ui/usePopoverPosition';
import Search from '../../Search';
import { WIDGET_CATALOG } from '../widget-catalog';
import type { UINodeType } from '../tree-model';

import './WidgetPicker.css';

const WIDTH = 240;

interface WidgetPickerProps {
  // Entity the new node is added under.
  parent: Entity;
  anchorRef: React.RefObject<HTMLElement>;
  onDismiss: () => void;
}

// Godot "Create Node" / UMG palette style picker: a searchable, categorized list
// of widgets. Picking one adds it under `parent` as a flow child (no absolute
// positioning — that's the palette-drop path) and selects it.
export const WidgetPicker: React.FC<WidgetPickerProps> = ({ parent, anchorRef, onDismiss }) => {
  const sdk = useSdk();
  const dispatch = useAppDispatch();
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

  const add = (type: UINodeType) => {
    if (!sdk) return;
    const entity = sdk.operations.addUINode(parent, type);
    void sdk.operations.dispatch();
    dispatch(selectNode({ node: entity }));
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
              key={item.type}
              type="button"
              className="ui-designer-widget-picker-row"
              onClick={() => add(item.type)}
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
