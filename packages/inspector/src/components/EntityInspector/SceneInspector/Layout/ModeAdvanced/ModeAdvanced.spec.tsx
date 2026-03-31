import { render, screen, fireEvent, act } from '@testing-library/react';
import { ModeAdvanced } from './ModeAdvanced';

const defaultValue = { coords: '0,0', base: '0,0' };
const noop = () => {};

function getConfirmButton() {
  return screen.getByText('Confirm').closest('button') as HTMLButtonElement;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function changeInput(input: Element, value: string) {
  fireEvent.change(input, { target: { value } });
  act(() => {
    vi.runAllTimers();
  });
}

describe('ModeAdvanced', () => {
  describe('Confirm button disabled state', () => {
    it('should be disabled when values have not changed', () => {
      render(
        <ModeAdvanced
          value={defaultValue}
          disabled={false}
          onSubmit={noop}
          onGoBack={noop}
        />,
      );
      expect(getConfirmButton().disabled).toBe(true);
    });

    it('should be enabled when coords has changed', () => {
      render(
        <ModeAdvanced
          value={defaultValue}
          disabled={false}
          onSubmit={noop}
          onGoBack={noop}
        />,
      );
      const [coordsInput] = screen.getAllByRole('textbox');
      changeInput(coordsInput, '0,0;1,0');
      expect(getConfirmButton().disabled).toBe(false);
    });

    it('should be enabled when base has changed', () => {
      render(
        <ModeAdvanced
          value={defaultValue}
          disabled={false}
          onSubmit={noop}
          onGoBack={noop}
        />,
      );
      const [, baseInput] = screen.getAllByRole('textbox');
      changeInput(baseInput, '1,1');
      expect(getConfirmButton().disabled).toBe(false);
    });

    it('should be disabled when coords field is cleared', () => {
      render(
        <ModeAdvanced
          value={defaultValue}
          disabled={false}
          onSubmit={noop}
          onGoBack={noop}
        />,
      );
      const [coordsInput] = screen.getAllByRole('textbox');
      changeInput(coordsInput, '');
      expect(getConfirmButton().disabled).toBe(true);
    });

    it('should be disabled when base field is cleared', () => {
      render(
        <ModeAdvanced
          value={defaultValue}
          disabled={false}
          onSubmit={noop}
          onGoBack={noop}
        />,
      );
      const [, baseInput] = screen.getAllByRole('textbox');
      changeInput(baseInput, '');
      expect(getConfirmButton().disabled).toBe(true);
    });

    it('should be disabled when disabled prop is true even with changes', () => {
      render(
        <ModeAdvanced
          value={defaultValue}
          disabled={true}
          onSubmit={noop}
          onGoBack={noop}
        />,
      );
      const [coordsInput] = screen.getAllByRole('textbox');
      changeInput(coordsInput, '0,0;1,0');
      expect(getConfirmButton().disabled).toBe(true);
    });

    it('should call onSubmit with updated values when Confirm is clicked', () => {
      const onSubmit = vi.fn();
      render(
        <ModeAdvanced
          value={defaultValue}
          disabled={false}
          onSubmit={onSubmit}
          onGoBack={noop}
        />,
      );
      const [coordsInput] = screen.getAllByRole('textbox');
      changeInput(coordsInput, '0,0;1,0');
      fireEvent.click(getConfirmButton());
      expect(onSubmit).toHaveBeenCalledWith({ coords: '0,0;1,0', base: '0,0' });
    });
  });
});
