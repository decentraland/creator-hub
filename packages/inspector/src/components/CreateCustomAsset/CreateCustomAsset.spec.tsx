import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { CreateCustomAsset } from '.';

vi.mock('../../redux/hooks', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: () => ({ entities: [], initialName: 'Magic Cube', previousTab: 'AssetsPack' }),
}));
vi.mock('../../hooks/sdk/useSdk', () => ({ useSdk: () => null }));

describe('when the CreateCustomAsset form is rendered', () => {
  it('should name the name field "Item name"', async () => {
    render(<CreateCustomAsset />);

    const input = (await screen.findByLabelText('Item name')) as HTMLInputElement;

    expect(input.tagName).toBe('INPUT');
    expect(input.value).toBe('Magic Cube');
  });
});
