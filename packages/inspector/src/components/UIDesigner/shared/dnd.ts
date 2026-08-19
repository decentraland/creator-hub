import type { UINodeType } from './tree-model';

/**
 * The UI Designer's own drag-and-drop bus, shared by the palette (the drag
 * source), the canvas, the Nodes tree, and the GUIs list (the drop targets).
 *
 * Distinct from `'ui-roots'` (used by RootsList Tree) and `DRAG_N_DROP_ASSET_KEY`
 * (used by ProjectAssetExplorer) so palette drops never trigger those drop zones.
 * It lives here rather than on the palette so a drop target does not have to
 * import the drawer component just to name the bus.
 */
export const UI_DESIGNER_DND_TYPE = 'ui-designer-node';

export type UIDesignerDragItem =
  | { source: 'palette'; type: UINodeType; preset?: 'image' }
  | { source: 'component'; name: string }
  | { source: 'tree'; entity: number };
