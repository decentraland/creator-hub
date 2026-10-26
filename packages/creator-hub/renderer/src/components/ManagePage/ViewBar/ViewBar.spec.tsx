import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';
import { FilterBy, SortBy } from '/shared/types/manage';

import { ManageViewBar } from '.';

type BarProps = Parameters<typeof ManageViewBar>[0];

function renderBar(props: Partial<BarProps> = {}) {
  const handlers = {
    onTabChange: vi.fn(),
    onViewChange: vi.fn(),
    onSortChange: vi.fn(),
    onSearch: vi.fn(),
  };
  render(
    <ThemeProvider theme={dark}>
      <h1 id="manage-title">Manage</h1>
      <ManageViewBar
        labelledBy="manage-title"
        tab="worlds"
        view={undefined}
        sortBy={SortBy.LATEST}
        searchQuery=""
        {...handlers}
        {...props}
      />
    </ThemeProvider>,
  );
  return handlers;
}

describe('ManageViewBar', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(cleanup);

  describe('when rendered on the WORLDS tab', () => {
    beforeEach(() => {
      renderBar();
    });

    it('should name the switch after the page title, with Worlds selected', () => {
      const tablist = screen.getByRole('tablist', { name: 'Manage' });

      expect(
        within(tablist).getByRole('tab', { name: 'Worlds' }).getAttribute('aria-selected'),
      ).toBe('true');
      expect(
        within(tablist).getByRole('tab', { name: 'LANDs' }).getAttribute('aria-selected'),
      ).toBe('false');
    });

    it('should keep only the selected tab in the Tab order', () => {
      expect(screen.getByRole('tab', { name: 'Worlds' }).tabIndex).toBe(0);
      expect(screen.getByRole('tab', { name: 'LANDs' }).tabIndex).toBe(-1);
    });

    it('should name the selects by their labels and the search box Search', () => {
      expect(screen.getByRole('combobox', { name: 'View' })).toBeTruthy();
      expect(screen.getByRole('combobox', { name: 'Sort by' })).toBeTruthy();
      expect(screen.getByRole('searchbox', { name: 'Search' })).toBeTruthy();
    });
  });

  describe('when the arrow keys move along the switch', () => {
    it('should select the other tab, wrapping at either end', () => {
      const { onTabChange } = renderBar();
      const worlds = screen.getByRole('tab', { name: 'Worlds' });

      fireEvent.keyDown(worlds, { key: 'ArrowRight' });
      fireEvent.keyDown(worlds, { key: 'ArrowLeft' });

      expect(onTabChange.mock.calls).toEqual([['lands'], ['lands']]);
    });
  });

  describe('when a View option is picked', () => {
    it('should report the filter, and no filter for All', () => {
      const { onViewChange } = renderBar({ view: FilterBy.PUBLISHED });

      fireEvent.mouseDown(screen.getByRole('combobox', { name: 'View' }));
      fireEvent.click(screen.getByRole('option', { name: 'Not Published' }));
      fireEvent.mouseDown(screen.getByRole('combobox', { name: 'View' }));
      fireEvent.click(screen.getByRole('option', { name: 'All' }));

      expect(onViewChange.mock.calls).toEqual([[FilterBy.UNPUBLISHED], [undefined]]);
    });
  });

  describe('when a Sort by option is picked', () => {
    it('should report the sort', () => {
      const { onSortChange } = renderBar();

      fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Sort by' }));
      fireEvent.click(screen.getByRole('option', { name: 'Name' }));

      expect(onSortChange).toHaveBeenCalledWith(SortBy.NAME);
    });
  });
});
