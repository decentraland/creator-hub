import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThumbnailPreview } from './ThumbnailPreview';

const assetUrl = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock('../../../../hooks/useAssetUrl', () => ({
  useAssetUrl: () => assetUrl.value,
}));

vi.mock('../../../ui/InfoTooltip', () => ({
  InfoTooltip: ({ text }: { text: string }) => <span data-testid="tooltip">{text}</span>,
}));

function loadImage(width: number, height: number) {
  const img = screen.getByRole('img');
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true });
  fireEvent.load(img);
}

describe('ThumbnailPreview', () => {
  afterEach(() => {
    cleanup();
    assetUrl.value = undefined;
  });

  describe('when no thumbnail is set', () => {
    it('should render the guidance tooltip and no image', () => {
      render(<ThumbnailPreview path="" />);

      expect(screen.queryByRole('img')).toBeNull();
      expect(screen.getByTestId('tooltip').textContent).toContain('16:9');
      expect(screen.getByTestId('tooltip').textContent).toContain('1920×1080');
    });
  });

  describe('when a thumbnail is set', () => {
    beforeEach(() => {
      assetUrl.value = 'blob:thumbnail';
    });

    it('should render the resolved image', () => {
      render(<ThumbnailPreview path="assets/scene/thumbnail.png" />);

      expect(screen.getByRole('img').getAttribute('src')).toBe('blob:thumbnail');
    });

    describe('and it is the recommended size', () => {
      it('should show its dimensions, the crop overlays and no warning', () => {
        const { container } = render(<ThumbnailPreview path="assets/scene/thumbnail.png" />);
        loadImage(1920, 1080);

        expect(screen.getByText('1920 × 1080')).toBeTruthy();
        expect(container.querySelectorAll('.ThumbnailCrop')).toHaveLength(2);
        expect(container.querySelector('.Message.warning')).toBeNull();
      });
    });

    describe('and it is not 16:9', () => {
      it('should warn that it may be stretched', () => {
        const { container } = render(<ThumbnailPreview path="assets/scene/thumbnail.png" />);
        loadImage(1080, 1080);

        expect(container.querySelector('.Message.warning')?.textContent).toContain('1080×1080');
      });
    });

    describe('and the file is not a png or jpg', () => {
      it('should warn about the format', () => {
        const { container } = render(<ThumbnailPreview path="assets/scene/thumbnail.gif" />);

        expect(container.querySelector('.Message.warning')?.textContent).toContain('.png');
      });
    });

    describe('and the image fails to load', () => {
      it('should report it instead of the dimensions', () => {
        const { container } = render(<ThumbnailPreview path="assets/scene/thumbnail.png" />);
        fireEvent.error(screen.getByRole('img'));

        expect(container.querySelector('.Message.warning')?.textContent).toContain('could not');
        expect(container.querySelectorAll('.ThumbnailCrop')).toHaveLength(0);
      });
    });
  });
});
