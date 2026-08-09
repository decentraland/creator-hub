import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Asset as AssetType } from '../../../lib/logic/catalog';
import AssetContainer from './AssetContainer';

const { infoTooltipMock } = vi.hoisted(() => ({
  infoTooltipMock: vi.fn(),
}));

vi.mock('../../../lib/logic/catalog', () => ({
  isSmart: () => false,
}));

vi.mock('../../ui', () => ({
  InfoTooltip: (props: { trigger: React.ReactNode }) => {
    infoTooltipMock(props);
    return React.createElement(React.Fragment, null, props.trigger);
  },
}));

vi.mock('./Asset', () => ({
  default: React.forwardRef<HTMLDivElement>((_props, ref) =>
    React.createElement('div', { ref, 'data-testid': 'asset' }),
  ),
}));

describe('AssetContainer', () => {
  it('anchors the name tooltip to the asset element', () => {
    render(
      React.createElement(AssetContainer, {
        value: { name: 'Wearable Scanner' } as AssetType,
      }),
    );

    const props = infoTooltipMock.mock.lastCall?.[0] as {
      context: React.RefObject<HTMLDivElement>;
    };

    expect(props.context.current).toBe(screen.getByTestId('asset'));
  });
});
