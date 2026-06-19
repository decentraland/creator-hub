import React from 'react';
import { useDrag } from 'react-dnd';

import { WIDGET_LIST, type WidgetDef } from './widget-catalog';
import type { UINodeType } from './tree-model';

// Distinct from `'ui-roots'` (used by RootsList Tree) and `DRAG_N_DROP_ASSET_KEY`
// (used by ProjectAssetExplorer) so palette drops never trigger those drop zones.
export const UI_DESIGNER_DND_TYPE = 'ui-designer-node';

export type UIDesignerDragItem =
  | { source: 'palette'; type: UINodeType }
  | { source: 'tree'; entity: number };

const PaletteCard: React.FC<{ entry: WidgetDef }> = ({ entry }) => {
  const [{ isDragging }, drag] = useDrag<UIDesignerDragItem, unknown, { isDragging: boolean }>(
    () => ({
      type: UI_DESIGNER_DND_TYPE,
      item: { source: 'palette', type: entry.type },
      collect: monitor => ({ isDragging: monitor.isDragging() }),
    }),
    [entry.type],
  );

  return (
    <div
      ref={drag as unknown as React.Ref<HTMLDivElement>}
      className="ui-designer-palette-card"
      style={{ opacity: isDragging ? 0.4 : 1 }}
      aria-label={`Add ${entry.label}`}
      title={`Drag onto the canvas to add a ${entry.label}`}
    >
      <span className="ui-designer-palette-icon">{entry.icon}</span>
      <span className="ui-designer-palette-label">{entry.label}</span>
    </div>
  );
};

const PaletteComponent: React.FC = () => (
  <div className="ui-designer-palette">
    {WIDGET_LIST.map(entry => (
      <PaletteCard
        key={entry.type}
        entry={entry}
      />
    ))}
  </div>
);

export const Palette = React.memo(PaletteComponent);

export default Palette;
