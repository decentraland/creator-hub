import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import type { Entity } from '@dcl/ecs';

import type * as StoreModule from '../../code/store';
import type * as AnalyticsModule from '../../../../lib/logic/analytics';
import type { CodeUINode } from '../../code/types';
import { StatesBar } from './PropertyPanel';

const mocks = vi.hoisted(() => ({ addInteractionLayer: vi.fn() }));

vi.mock('../../code/store', async importOriginal => ({
  ...(await importOriginal<typeof StoreModule>()),
  addInteractionLayer: mocks.addInteractionLayer,
}));

vi.mock('../../../../lib/logic/analytics', async importOriginal => ({
  ...(await importOriginal<typeof AnalyticsModule>()),
  analytics: { track: vi.fn() },
}));

const node = {
  entity: 7,
  type: 'UiEntity',
  name: 'Button',
  children: [],
  interaction: { states: { base: {} } },
} as unknown as CodeUINode;

describe('StatesBar', () => {
  let onPick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mocks.addInteractionLayer.mockClear();
    onPick = vi.fn();
  });

  describe('when a state has not been added yet', () => {
    const renderBar = () =>
      render(
        <StatesBar
          node={node}
          entity={7 as Entity}
          layer="base"
          onPick={onPick}
        />,
      ).getByTitle(/^Add a Hover state/);

    it('should render it as an enabled, unselected tab', () => {
      const tab = renderBar();
      expect(tab.getAttribute('aria-disabled')).toBeNull();
      expect(tab.getAttribute('aria-selected')).toBe('false');
    });

    it('should add the state when clicked', () => {
      fireEvent.click(renderBar());
      expect(mocks.addInteractionLayer).toHaveBeenCalledWith(7, 'hover');
      expect(onPick).toHaveBeenCalledWith('hover');
    });
  });
});
