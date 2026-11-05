import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { CodeInput, EMPTY_CODE } from './CodeInput';

function Harness() {
  const [value, setValue] = useState(EMPTY_CODE);
  return (
    <>
      <h2 id="title">Verify your email</h2>
      <p id="error">Incorrect Code.</p>
      <CodeInput
        value={value}
        onChange={setValue}
        labelledBy="title"
        describedBy="error"
      />
    </>
  );
}

const box = (n: number) => screen.getByRole('textbox', { name: `Digit ${n} of 6` });
const values = () => screen.getAllByRole('textbox').map(input => (input as HTMLInputElement).value);

describe('CodeInput', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(cleanup);

  describe('when it opens', () => {
    it('should show six numeric one-time-code boxes with the first one focused', () => {
      render(<Harness />);

      expect(screen.getAllByRole('textbox')).toHaveLength(6);
      expect(document.activeElement).toBe(box(1));
      expect(box(1).getAttribute('inputmode')).toBe('numeric');
      expect(
        screen.getAllByRole('textbox').map(input => input.getAttribute('autocomplete')),
      ).toEqual(['one-time-code', 'off', 'off', 'off', 'off', 'off']);
    });

    it('should group the boxes under the title and describe each by the error line', () => {
      render(<Harness />);

      expect(screen.getByRole('group', { name: 'Verify your email' })).toBeTruthy();
      expect(box(3).getAttribute('aria-describedby')).toBe('error');
    });
  });

  describe('when pressing the arrow keys', () => {
    it('should move between the boxes', () => {
      render(<Harness />);

      fireEvent.keyDown(box(1), { key: 'ArrowRight' });
      expect(document.activeElement).toBe(box(2));

      fireEvent.keyDown(box(2), { key: 'ArrowLeft' });
      expect(document.activeElement).toBe(box(1));
    });
  });

  describe('when typing a digit', () => {
    it('should fill the box and move on to the next', () => {
      render(<Harness />);

      fireEvent.change(box(1), { target: { value: '4' } });

      expect(values()[0]).toBe('4');
      expect(document.activeElement).toBe(box(2));
    });

    it('should ignore anything but a digit', () => {
      render(<Harness />);

      fireEvent.change(box(1), { target: { value: 'a' } });

      expect(values()[0]).toBe('');
      expect(document.activeElement).toBe(box(1));
    });
  });

  describe('when pressing Backspace on an empty box', () => {
    it('should move back to the previous box', () => {
      render(<Harness />);
      fireEvent.change(box(1), { target: { value: '4' } });

      fireEvent.keyDown(box(2), { key: 'Backspace' });

      expect(document.activeElement).toBe(box(1));
    });
  });

  describe('when pasting a code', () => {
    it('should spread its digits across the boxes', () => {
      render(<Harness />);

      fireEvent.paste(box(1), { clipboardData: { getData: () => ' 12-34 56 ' } });

      expect(values()).toEqual(['1', '2', '3', '4', '5', '6']);
      expect(document.activeElement).toBe(box(6));
    });
  });
});
