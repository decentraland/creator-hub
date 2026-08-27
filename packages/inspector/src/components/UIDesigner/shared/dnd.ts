import type { UINodeType } from './tree-model';

/** The UI Designer's own drag-and-drop bus, shared by the palette, canvas, tree, and GUIs list. */
export const UI_DESIGNER_DND_TYPE = 'ui-designer-node';

export type UIDesignerDragItem =
  | { source: 'palette'; type: UINodeType; preset?: 'image' }
  | { source: 'component'; name: string }
  | { source: 'tree'; entity: number };
