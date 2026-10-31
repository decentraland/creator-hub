import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { CreateScriptModal } from './CreateScriptModal';

describe('CreateScriptModal error description', () => {
  describe('when the script name is invalid', () => {
    it('should describe the field with the error text', async () => {
      render(
        <CreateScriptModal
          isOpen
          onClose={vi.fn()}
          onCreate={vi.fn()}
          isValid={() => 'A script with this name already exists'}
        />,
      );
      expect(
        await screen.findByRole('textbox', {
          hidden: true,
          description: 'A script with this name already exists',
        }),
      ).toBeTruthy();
    });
  });

  describe('when it opens', () => {
    it('should associate the Script File label with the field', async () => {
      render(
        <CreateScriptModal
          isOpen
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />,
      );
      expect((await screen.findByLabelText('Script File')).tagName).toBe('INPUT');
    });
  });
});
