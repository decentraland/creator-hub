import React from 'react';
import { IoEllipseOutline, IoImageOutline, IoSquareOutline } from 'react-icons/io5';

import type { UINodeType, WidgetKind } from './tree-model';
import { DropdownFieldIcon, InputFieldIcon, LabelFieldIcon } from './widget-icons';

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
        icon: <LabelFieldIcon />,
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
        icon: <InputFieldIcon />,
        keywords: ['text field', 'form', 'entry'],
      },
      {
        id: 'Dropdown',
        type: 'Dropdown',
        label: 'Dropdown',
        icon: <DropdownFieldIcon />,
        keywords: ['select', 'combo', 'options'],
      },
    ],
  },
];

// Flat list + type→icon lookup derived from the catalog.
export const WIDGET_LIST: WidgetDef[] = WIDGET_CATALOG.flatMap(c => c.items);

// Keyed by label, which coincides with the `classifyNode` WidgetKind — so the
// two UiEntity-backed widgets (Container / Image) each keep their own icon.
export const WIDGET_ICONS = Object.fromEntries(WIDGET_LIST.map(w => [w.label, w.icon])) as Record<
  WidgetKind,
  JSX.Element
>;
