import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { ProfileRow } from '.';

const ADDRESS = '0x0000000000000000000000000000000000000001';
const SHORT_ADDRESS = '0x0000000000...00000001';
const CHECKSUMMED = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';

describe('when a ProfileRow renders a resolved profile', () => {
  it('should show the username beside the truncated address', () => {
    render(
      <ProfileRow
        address={ADDRESS}
        name="turbo_creator"
        faceUrl="https://example.com/face256.png"
        removeLabel="Remove"
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText('turbo_creator')).toBeDefined();
    expect(screen.getByText(SHORT_ADDRESS)).toBeDefined();
  });
});

describe('when a ProfileRow avatar image cannot be loaded', () => {
  it('should fall back to the generic avatar rather than a broken image', () => {
    const { container } = render(
      <ProfileRow
        address={ADDRESS}
        name="turbo_creator"
        faceUrl="https://example.com/gone.png"
        removeLabel="Remove"
        onRemove={vi.fn()}
      />,
    );

    const image = container.querySelector('img.Avatar');
    expect(image).not.toBeNull();

    fireEvent.error(image as HTMLImageElement);

    expect(container.querySelector('img.Avatar')).toBeNull();
    expect(container.querySelector('svg.Avatar')).not.toBeNull();
    expect(screen.getByText('turbo_creator')).toBeDefined();
  });
});

describe('when a ProfileRow renders an unresolved profile', () => {
  it('should show the address alone, with no username element', () => {
    const { container } = render(
      <ProfileRow
        address={ADDRESS}
        removeLabel="Remove"
        onRemove={vi.fn()}
      />,
    );

    expect(container.querySelector('.Name')).toBeNull();
    expect(screen.getByText(SHORT_ADDRESS)).toBeDefined();
  });
});

describe('when a ProfileRow renders its remove control', () => {
  it('should expose it as a native button, so Enter and Space activate it too', () => {
    render(
      <ProfileRow
        address={ADDRESS}
        removeLabel="Remove"
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: `Remove ${SHORT_ADDRESS}` }).tagName).toBe('BUTTON');
  });

  it('should call onRemove when activated', () => {
    const onRemove = vi.fn();
    render(
      <ProfileRow
        address={ADDRESS}
        removeLabel="Remove"
        onRemove={onRemove}
      />,
    );

    fireEvent.click(screen.getByRole('button'));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe('when a ProfileRow renders a checksummed address', () => {
  it('should keep its casing intact', () => {
    render(
      <ProfileRow
        address={CHECKSUMMED}
        removeLabel="Remove"
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText('0x5aAeb6053F...Ef1BeAed')).toBeDefined();
  });
});
