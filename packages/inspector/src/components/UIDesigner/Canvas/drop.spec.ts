import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AnalyticsModule from '../../../lib/logic/analytics';
import { Event } from '../../../lib/logic/analytics';
import type { UIDesignerDragItem } from '../shared/dnd';
import { applyCanvasDrop } from './drop';

const mocks = vi.hoisted(() => ({
  track: vi.fn(),
  spliceAddChild: vi.fn(),
  spliceInsertComponent: vi.fn(),
}));

vi.mock('../../../lib/logic/analytics', async importActual => ({
  ...(await importActual<typeof AnalyticsModule>()),
  analytics: { track: mocks.track },
}));

vi.mock('../code/store', () => ({
  spliceAddChild: mocks.spliceAddChild,
  spliceInsertComponent: mocks.spliceInsertComponent,
}));

beforeEach(() => {
  mocks.track.mockClear();
  mocks.spliceAddChild.mockClear();
  mocks.spliceInsertComponent.mockClear();
});

describe('applyCanvasDrop', () => {
  it('should nest and track when a GUI component is dropped', () => {
    applyCanvasDrop({ source: 'component', name: 'Sidebar' } as UIDesignerDragItem, 5);

    expect(mocks.spliceInsertComponent).toHaveBeenCalledWith(5, 'Sidebar');
    expect(mocks.track).toHaveBeenCalledWith(Event.NEST_UI_COMPONENT, {});
  });

  it('should not track when a palette widget is dropped', () => {
    applyCanvasDrop(
      { source: 'palette', type: 'UiEntity', preset: undefined } as UIDesignerDragItem,
      5,
    );

    expect(mocks.spliceAddChild).toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
  });
});
