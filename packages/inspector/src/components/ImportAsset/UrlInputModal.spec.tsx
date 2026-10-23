import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { UrlInputModal } from './UrlInputModal';

describe('UrlInputModal error description', () => {
  describe('when the URL is invalid', () => {
    it('should describe the field with the error text', async () => {
      render(
        <UrlInputModal
          isOpen
          onClose={vi.fn()}
          onAccept={vi.fn()}
        />,
      );
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'not-a-url' } });
      expect(
        await screen.findByRole('textbox', { description: 'Please enter a valid HTTPS URL' }),
      ).toBeTruthy();
    });
  });
});
