import { analytics, Event } from '../../../lib/logic/analytics';
import { spliceAddChild, spliceInsertComponent } from '../code/store';
import type { DropPoint } from '../code/store-splices';
import type { UIDesignerDragItem } from '../shared/dnd';
import type { UINodeType } from '../shared/tree-model';

export function applyCanvasDrop(item: UIDesignerDragItem, entity: number, pos?: DropPoint): void {
  if (item.source === 'palette') {
    void spliceAddChild(entity, item.type as UINodeType, item.preset, pos);
  } else if (item.source === 'component') {
    void spliceInsertComponent(entity, item.name);
    analytics.track(Event.NEST_UI_COMPONENT, {});
  }
}
