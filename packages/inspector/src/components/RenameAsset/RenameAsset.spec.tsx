import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { RenameAsset } from '.';

vi.mock('../../redux/hooks', () => ({ useAppDispatch: () => vi.fn() }));

describe('when the RenameAsset form is rendered', () => {
  it('should name the name field "Item name"', async () => {
    render(
      <RenameAsset
        assetId="asset-1"
        currentName="Magic Cube"
      />,
    );

    const input = (await screen.findByLabelText('Item name')) as HTMLInputElement;

    expect(input.tagName).toBe('INPUT');
    expect(input.value).toBe('Magic Cube');
  });
});
