import React from 'react';
import { useDrag } from 'react-dnd';
import cx from 'classnames';

import { useCodeState } from './code/store';
import { WIDGET_LIST, type WidgetDef } from './widget-catalog';
import type { UINodeType } from './tree-model';

// Distinct from `'ui-roots'` (used by RootsList Tree) and `DRAG_N_DROP_ASSET_KEY`
// (used by ProjectAssetExplorer) so palette drops never trigger those drop zones.
export const UI_DESIGNER_DND_TYPE = 'ui-designer-node';

export type UIDesignerDragItem =
  | { source: 'palette'; type: UINodeType; preset?: 'image' }
  | { source: 'component'; name: string }
  | { source: 'tree'; entity: number };

const PaletteCard: React.FC<{ entry: WidgetDef; enabled: boolean }> = ({ entry, enabled }) => {
  const [{ isDragging }, drag] = useDrag<UIDesignerDragItem, unknown, { isDragging: boolean }>(
    () => ({
      type: UI_DESIGNER_DND_TYPE,
      item: { source: 'palette', type: entry.type, preset: entry.preset },
      canDrag: enabled,
      collect: monitor => ({ isDragging: monitor.isDragging() }),
    }),
    [entry.type, entry.preset, enabled],
  );

  return (
    <div
      ref={drag as unknown as React.Ref<HTMLDivElement>}
      className={cx('ui-designer-palette-card', { disabled: !enabled })}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      aria-label={`Add ${entry.label}`}
      aria-disabled={!enabled}
      title={
        enabled
          ? `Drag onto the canvas to add a ${entry.label}`
          : 'Create a GUI first to add elements'
      }
    >
      <span className="ui-designer-palette-icon">{entry.icon}</span>
      <span className="ui-designer-palette-label">{entry.label}</span>
    </div>
  );
};

const PaletteComponent: React.FC = () => {
  const { roots } = useCodeState();
  return (
    <div className="ui-designer-palette">
      {WIDGET_LIST.map(entry => (
        <PaletteCard
          key={entry.id}
          entry={entry}
          enabled={roots.length > 0}
        />
      ))}
    </div>
  );
};

export const Palette = React.memo(PaletteComponent);

export default Palette;
