import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Entity, PBAvatarModifierArea } from '@dcl/ecs';

import AvatarModifierAreaInspector from './AvatarModifierAreaInspector';

const CHECKSUMMED = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';

const mocks = vi.hoisted(() => ({
  initial: {} as PBAvatarModifierArea,
  setValue: vi.fn(),
  sdk: {
    components: { AvatarModifierArea: { componentId: 1 }, GltfContainer: { componentId: 2 } },
  },
}));

vi.mock('../../../hoc/withSdk', () => ({
  withSdk:
    <P,>(Component: React.FC<P & { sdk: unknown }>) =>
    (props: P) => (
      <Component
        {...props}
        sdk={mocks.sdk}
      />
    ),
}));
vi.mock('../../../hooks/sdk/useHasComponent', () => ({ useHasComponent: () => true }));
vi.mock('../../../hooks/sdk/useComponentValue', async () => {
  const { useState } = await import('react');
  return {
    getComponentValue: () => null,
    useComponentValue: () => {
      const [value, setValue] = useState(mocks.initial);
      const write = (next: PBAvatarModifierArea) => {
        mocks.setValue(next);
        setValue(next);
      };
      return [value, write];
    },
  };
});
vi.mock('../../Container', () => ({
  Container: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../MoreOptionsMenu', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function renderInspector() {
  render(<AvatarModifierAreaInspector entity={512 as Entity} />);
}

function lastExcludeIds() {
  return (mocks.setValue.mock.lastCall?.[0] as PBAvatarModifierArea | undefined)?.excludeIds;
}

describe('AvatarModifierAreaInspector exclude list', () => {
  beforeEach(() => {
    mocks.initial = { excludeIds: [], modifiers: [] } as unknown as PBAvatarModifierArea;
    mocks.setValue.mockReset();
  });

  afterEach(cleanup);

  describe('when a Player ID is added, pasted and tabbed out of', () => {
    it('should keep the address without an error', () => {
      renderInspector();
      fireEvent.click(screen.getByText('Add Player ID'));
      const input = screen.getByLabelText('Wallet address 1');

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: CHECKSUMMED } });
      fireEvent.blur(input);

      expect(lastExcludeIds()).toEqual([CHECKSUMMED]);
      expect(screen.queryByText('Not a valid Ethereum address.')).toBeNull();
    });
  });

  describe('when the committed Player ID is focused and left again', () => {
    it('should not flag the shortened display text as invalid', () => {
      mocks.initial = {
        excludeIds: [CHECKSUMMED],
        modifiers: [],
      } as unknown as PBAvatarModifierArea;
      renderInspector();
      const input = screen.getByLabelText('Wallet address 1') as HTMLInputElement;

      fireEvent.focus(input);
      expect(input.value).toBe(CHECKSUMMED);
      fireEvent.blur(input);

      expect(screen.queryByText('Not a valid Ethereum address.')).toBeNull();
    });
  });

  describe('when a Player ID is pasted and Enter is pressed', () => {
    it('should keep the address straight away', () => {
      renderInspector();
      fireEvent.click(screen.getByText('Add Player ID'));
      const input = screen.getByLabelText('Wallet address 1');

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: `${CHECKSUMMED} ` } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(lastExcludeIds()).toEqual([CHECKSUMMED]);
    });
  });
});
