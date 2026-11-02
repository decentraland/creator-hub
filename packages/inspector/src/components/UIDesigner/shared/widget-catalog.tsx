import React from 'react';
import { IoScanOutline } from 'react-icons/io5';

import type { UINodeType, WidgetKind, WidgetPreset } from './tree-model';
import {
  ButtonIcon,
  ContainerIcon,
  DropdownFieldIcon,
  ImageIcon,
  InputFieldIcon,
  LabelFieldIcon,
} from './widget-icons';

export interface WidgetDef {
  id: string;
  type: UINodeType;
  label: string;
  icon: JSX.Element;
  keywords?: string[];
  preset?: WidgetPreset;
}

export interface WidgetCategory {
  category: string;
  items: WidgetDef[];
}

/** Single source of truth for the widget set (palette, tree icons, add menu). */
export const WIDGET_CATALOG: WidgetCategory[] = [
  {
    category: 'Containers',
    items: [
      {
        id: 'fullscreen',
        type: 'UiEntity',
        label: 'Full Screen',
        icon: <IoScanOutline />,
        preset: 'fullscreen',
        keywords: ['root', 'wrapper', 'stretch', 'fill', 'screen', 'full'],
      },
      {
        id: 'UiEntity',
        type: 'UiEntity',
        label: 'Container',
        icon: <ContainerIcon />,
        keywords: ['box', 'panel', 'div', 'group', 'layout', 'flex'],
      },
      {
        id: 'image',
        type: 'UiEntity',
        label: 'Image',
        icon: <ImageIcon />,
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
        icon: <ButtonIcon />,
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

/** Flat list of all widgets, derived from the catalog. */
export const WIDGET_LIST: WidgetDef[] = WIDGET_CATALOG.flatMap(c => c.items);

/** Widget icons keyed by label (which coincides with the WidgetKind). */
export const WIDGET_ICONS = Object.fromEntries(WIDGET_LIST.map(w => [w.label, w.icon])) as Record<
  WidgetKind,
  JSX.Element
>;
