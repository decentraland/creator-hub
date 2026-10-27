import { Item, Separator, contextMenu } from 'react-contexify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import { ContextMenu } from './ContextMenu';

const MENU_ID = 'test-menu';

function renderAndOpenMenu() {
  render(
    <>
      <div
        tabIndex={-1}
        onContextMenu={event => contextMenu.show({ id: MENU_ID, event })}
      >
        Magic Cube
      </div>
      <ContextMenu
        id={MENU_ID}
        label="Entity Options"
      >
        <Item>
          <svg /> Rename
        </Item>
        <Separator />
        <Item>Delete</Item>
      </ContextMenu>
    </>,
  );
  const trigger = screen.getByText('Magic Cube');
  act(() => trigger.focus());
  fireEvent.contextMenu(trigger);
  return trigger;
}

const press = (key: string) => fireEvent.keyDown(document.activeElement ?? document.body, { key });

describe('when a context menu opens', () => {
  let trigger: HTMLElement;

  beforeEach(() => {
    trigger = renderAndOpenMenu();
  });

  afterEach(() => {
    act(() => contextMenu.hideAll());
    cleanup();
  });

  it('should be named by its label', () => {
    expect(screen.getByRole('menu', { name: 'Entity Options' })).toBeTruthy();
  });

  it('should expose its separators', () => {
    expect(screen.getByRole('separator')).toBeTruthy();
  });

  it('should hide its item glyphs from assistive technology', () => {
    const glyphs = Array.from(screen.getByRole('menu').querySelectorAll('svg'));

    expect(glyphs.length).toBeGreaterThan(0);
    expect(glyphs.map(glyph => glyph.getAttribute('aria-hidden'))).toEqual(
      glyphs.map(() => 'true'),
    );
  });

  describe('and Escape is pressed from inside it', () => {
    beforeEach(() => {
      press('ArrowDown');
    });

    it('should return focus to the element that opened it', () => {
      expect(document.activeElement?.getAttribute('role')).toBe('menuitem');

      press('Escape');

      expect(document.activeElement).toBe(trigger);
    });
  });
});
