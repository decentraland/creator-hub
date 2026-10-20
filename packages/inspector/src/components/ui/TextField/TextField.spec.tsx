import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { TextField } from '.';

describe('TextField error description', () => {
  describe('when it has an error', () => {
    it('should be described by the error text', () => {
      render(<TextField error="Enter a valid URL" />);
      expect(screen.getByRole('textbox', { description: 'Enter a valid URL' })).toBeTruthy();
    });
  });

  describe('when it has no error', () => {
    it('should have no description', () => {
      render(<TextField />);
      expect(screen.getByRole('textbox').getAttribute('aria-describedby')).toBeNull();
    });
  });
});

describe('TextField accessible name', () => {
  describe('when it has a label', () => {
    it('should be named by the label, not the placeholder', () => {
      render(
        <TextField
          label="URL"
          placeholder="https://..."
        />,
      );
      expect(screen.getByRole('textbox', { name: 'URL' })).toBeTruthy();
    });
  });

  describe('when the caller passes an id', () => {
    it('should keep the id and stay named by the label', () => {
      render(
        <TextField
          id="url-field"
          label="URL"
        />,
      );
      expect(screen.getByRole('textbox', { name: 'URL' }).id).toBe('url-field');
    });
  });
});
