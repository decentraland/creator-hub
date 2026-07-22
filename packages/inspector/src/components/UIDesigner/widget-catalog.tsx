import React from 'react';
import {
  IoCaretDownOutline,
  IoCreateOutline,
  IoEllipseOutline,
  IoSquareOutline,
  IoTextOutline,
} from 'react-icons/io5';

import type { UINodeType } from './tree-model';

export interface WidgetDef {
  type: UINodeType;
  label: string;
  icon: JSX.Element;
  keywords?: string[];
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
        type: 'UiEntity',
        label: 'Container',
        icon: <IoSquareOutline />,
        keywords: ['box', 'panel', 'div', 'group', 'layout', 'flex'],
      },
    ],
  },
  {
    category: 'Text',
    items: [
      {
        type: 'Label',
        label: 'Label',
        icon: <IoTextOutline />,
        keywords: ['text', 'caption', 'title'],
      },
      {
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
        type: 'Input',
        label: 'Input',
        icon: <IoCreateOutline />,
        keywords: ['text field', 'form', 'entry'],
      },
      {
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

export const WIDGET_ICONS = Object.fromEntries(WIDGET_LIST.map(w => [w.type, w.icon])) as Record<
  UINodeType,
  JSX.Element
>;
