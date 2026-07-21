import React from 'react';
import {
  IoCaretDownOutline,
  IoCreateOutline,
  IoEllipseOutline,
  IoImageOutline,
  IoSquareOutline,
  IoTextOutline,
} from 'react-icons/io5';

import type { UINodeType } from './tree-model';

export interface WidgetDef {
  // Stable list key (distinct from `type`, since presets share a type).
  id: string;
  type: UINodeType;
  label: string;
  icon: JSX.Element;
  keywords?: string[];
  // Optional creation preset routed into spliceAddChild (e.g. 'image' seeds a
  // texture-ready uiBackground on a plain container).
  preset?: 'image';
}

export interface WidgetCategory {
  category: string;
  items: WidgetDef[];
}

// Single source of truth for the widget set — consumed by the Palette (drag
// source), the NodeTree (row icons) and the WidgetPicker (categorized add menu).
// Adding a new node type means adding one entry here; categories scale with it.
export const WIDGET_CATALOG: WidgetCategory[] = [
  {
    category: 'Containers',
    items: [
      {
        id: 'UiEntity',
        type: 'UiEntity',
        label: 'Container',
        icon: <IoSquareOutline />,
        keywords: ['box', 'panel', 'div', 'group', 'layout', 'flex'],
      },
      {
        id: 'image',
        type: 'UiEntity',
        label: 'Image',
        icon: <IoImageOutline />,
        preset: 'image',
        keywords: ['picture', 'texture', 'sprite', 'photo'],
      },
    ],
  },
  {
    category: 'Text',
    items: [
      {
        id: 'Label',
        type: 'Label',
        label: 'Label',
        icon: <IoTextOutline />,
        keywords: ['text', 'caption', 'title'],
      },
      {
        id: 'Button',
        type: 'Button',
        label: 'Button',
        icon: <IoEllipseOutline />,
        keywords: ['click', 'action', 'cta'],
      },
    ],
  },
  {
    category: 'Input',
    items: [
      {
        id: 'Input',
        type: 'Input',
        label: 'Input',
        icon: <IoCreateOutline />,
        keywords: ['text field', 'form', 'entry'],
      },
      {
        id: 'Dropdown',
        type: 'Dropdown',
        label: 'Dropdown',
        icon: <IoCaretDownOutline />,
        keywords: ['select', 'combo', 'options'],
      },
    ],
  },
];

// Flat list + type→icon lookup derived from the catalog.
export const WIDGET_LIST: WidgetDef[] = WIDGET_CATALOG.flatMap(c => c.items);

// Keyed by `w.type`: the Image preset shares `'UiEntity'` with Container, so the
// last entry wins. That's intentional — Image reloads as a plain container (no
// marker), and the tree icon should match that classification.
export const WIDGET_ICONS = Object.fromEntries(WIDGET_LIST.map(w => [w.type, w.icon])) as Record<
  UINodeType,
  JSX.Element
>;
