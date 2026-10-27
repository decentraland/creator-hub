import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { Dropdown } from '.';

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta', disabled: true },
  { value: 'c', label: 'Gamma' },
];

function renderDropdown(props: Partial<React.ComponentProps<typeof Dropdown>> = {}) {
  const onChange = vi.fn();
  render(
    <Dropdown
      aria-label="Shape"
      options={options}
      value="a"
      onChange={onChange}
      {...props}
    />,
  );
  const trigger = screen.getByRole('combobox', { hidden: true });
  return { trigger, onChange };
}

function activeOption(trigger: HTMLElement) {
  const id = trigger.getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
}

describe('when the Dropdown trigger is rendered', () => {
  it('should be reachable by Tab', () => {
    const { trigger } = renderDropdown();
    expect(trigger.tabIndex).toBe(0);
  });

  it('should take its accessible name from a text label', () => {
    renderDropdown({ 'aria-label': undefined, label: 'Shape' });
    expect(screen.getByRole('combobox', { hidden: true, name: 'Shape' })).toBeTruthy();
  });

  describe('and the Dropdown is disabled', () => {
    it('should be skipped by Tab and marked disabled', () => {
      const { trigger } = renderDropdown({ disabled: true });
      expect(trigger.tabIndex).toBe(-1);
      expect(trigger.getAttribute('aria-disabled')).toBe('true');
    });

    it('should ignore the opening keys', () => {
      const { trigger } = renderDropdown({ disabled: true });
      fireEvent.keyDown(trigger, { key: 'Enter' });
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
  });
});

describe('when an opening key is pressed on the focused trigger', () => {
  it.each(['Enter', ' ', 'ArrowDown', 'ArrowUp'])('should open the list on %j', key => {
    const { trigger } = renderDropdown();
    trigger.focus();
    fireEvent.keyDown(trigger, { key });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('listbox', { hidden: true })).toBeTruthy();
  });

  it('should make the selected option active', () => {
    const { trigger } = renderDropdown();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    const active = activeOption(trigger);
    expect(active?.getAttribute('role')).toBe('option');
    expect(active?.getAttribute('aria-selected')).toBe('true');
    expect(active?.textContent).toBe('Alpha');
  });
});

describe('when the list is open', () => {
  it('should move the active option with ArrowDown, skipping disabled ones, and clamp at the end', () => {
    const { trigger } = renderDropdown();
    fireEvent.keyDown(trigger, { key: 'Enter' });

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(activeOption(trigger)?.textContent).toBe('Gamma');

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(activeOption(trigger)?.textContent).toBe('Gamma');

    fireEvent.keyDown(trigger, { key: 'ArrowUp' });
    expect(activeOption(trigger)?.textContent).toBe('Alpha');
  });

  it('should select the active option on Enter, close, and keep focus on the trigger', () => {
    const { trigger, onChange } = renderDropdown();
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].target.value).toBe('c');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('should run an option’s own onClick on Enter', () => {
    const onClick = vi.fn();
    const { trigger } = renderDropdown({
      options: [{ value: 'free', label: 'Free', onClick }],
      trigger: <span>Camera</span>,
    });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should close on Escape without changing the value and keep focus on the trigger', () => {
    const { trigger, onChange } = renderDropdown();
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Escape' });

    expect(onChange).not.toHaveBeenCalled();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('should close on Tab without cancelling the focus move', () => {
    const { trigger } = renderDropdown();
    fireEvent.click(trigger);
    const notCancelled = fireEvent.keyDown(trigger, { key: 'Tab' });
    expect(notCancelled).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('should make a hovered option the only active one', () => {
    const { trigger } = renderDropdown();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    const listbox = screen.getByRole('listbox', { hidden: true });

    fireEvent.mouseEnter(within(listbox).getByText('Gamma'));

    expect(activeOption(trigger)?.textContent).toBe('Gamma');
    expect(listbox.querySelectorAll('.active')).toHaveLength(1);
  });

  it('should clear the active option when the pointer leaves the list', () => {
    const { trigger } = renderDropdown();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    const listbox = screen.getByRole('listbox', { hidden: true });
    expect(activeOption(trigger)?.textContent).toBe('Alpha');

    fireEvent.mouseLeave(listbox);

    expect(trigger.hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('should not activate a hovered disabled option', () => {
    const { trigger } = renderDropdown();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    const listbox = screen.getByRole('listbox', { hidden: true });

    fireEvent.mouseEnter(within(listbox).getByText('Beta'));

    expect(activeOption(trigger)?.textContent).toBe('Alpha');
  });

  describe('and the active option is drawn', () => {
    it('should mark the list as keyboard-driven after ArrowDown', () => {
      const { trigger } = renderDropdown();
      fireEvent.click(trigger);
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });

      const listbox = screen.getByRole('listbox', { hidden: true });
      expect(listbox.getAttribute('data-active-source')).toBe('keyboard');
    });

    it('should mark the list as pointer-driven after hovering an option', () => {
      const { trigger } = renderDropdown();
      fireEvent.keyDown(trigger, { key: 'Enter' });
      const listbox = screen.getByRole('listbox', { hidden: true });

      fireEvent.mouseEnter(within(listbox).getByText('Gamma'));

      expect(listbox.getAttribute('data-active-source')).toBe('pointer');
    });

    it('should switch back to keyboard-driven when ArrowDown follows a hover', () => {
      const { trigger } = renderDropdown();
      fireEvent.click(trigger);
      const listbox = screen.getByRole('listbox', { hidden: true });
      fireEvent.mouseEnter(within(listbox).getByText('Alpha'));

      fireEvent.keyDown(trigger, { key: 'ArrowDown' });

      expect(listbox.getAttribute('data-active-source')).toBe('keyboard');
    });
  });

  it('should keep the mouse toggle working', () => {
    const { trigger } = renderDropdown();
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByText('Gamma'));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('when the list has a search field', () => {
  it('should navigate and select within the filtered options from the search field', async () => {
    const { trigger, onChange } = renderDropdown({ searchable: true });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    const search = screen.getByPlaceholderText('Search') as HTMLInputElement;

    fireEvent.change(search, { target: { value: 'gam' } });
    const listbox = screen.getByRole('listbox', { hidden: true });
    await waitFor(() => expect(within(listbox).queryByText('Alpha')).toBeNull());

    fireEvent.keyDown(search, { key: 'ArrowDown' });
    expect(activeOption(trigger)?.textContent).toBe('Gamma');

    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onChange.mock.calls[0][0].target.value).toBe('c');
    expect(document.activeElement).toBe(trigger);
  });

  it('should leave Space to the search field', () => {
    const { trigger, onChange } = renderDropdown({ searchable: true });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    const search = screen.getByPlaceholderText('Search');

    const notCancelled = fireEvent.keyDown(search, { key: ' ' });

    expect(notCancelled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  describe('and focus is in the search field', () => {
    function openWithSearchFocused() {
      const rendered = renderDropdown({ searchable: true });
      fireEvent.keyDown(rendered.trigger, { key: 'Enter' });
      const search = screen.getByPlaceholderText('Search');
      search.focus();
      fireEvent.focus(search);
      return { ...rendered, search, listbox: screen.getByRole('listbox', { hidden: true }) };
    }

    it('should expose the active option on the search field instead of the trigger', () => {
      const { trigger, search, listbox } = openWithSearchFocused();
      fireEvent.keyDown(search, { key: 'ArrowDown' });

      expect(search.getAttribute('role')).toBe('combobox');
      expect(search.getAttribute('aria-expanded')).toBe('true');
      expect(search.getAttribute('aria-controls')).toBe(listbox.id);
      expect(
        document.getElementById(search.getAttribute('aria-activedescendant')!)?.textContent,
      ).toBe('Gamma');
      expect(trigger.hasAttribute('aria-activedescendant')).toBe(false);
    });

    it('should hand the active option back to the trigger on blur', () => {
      const { trigger, search } = openWithSearchFocused();
      expect(search.hasAttribute('aria-activedescendant')).toBe(true);

      fireEvent.blur(search);

      expect(search.hasAttribute('aria-activedescendant')).toBe(false);
      expect(activeOption(trigger)?.textContent).toBe('Alpha');
    });

    it('should close on Tab and return focus to the trigger', () => {
      const { trigger, search } = openWithSearchFocused();

      const notCancelled = fireEvent.keyDown(search, { key: 'Tab' });

      expect(notCancelled).toBe(false);
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(trigger);
    });
  });
});
