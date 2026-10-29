import { flatten } from 'flat';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';
import { FilterBy } from '/shared/types/manage';

import { getEmptyKind, getManageEmptyState } from './manageEmptyState';

const base = { failed: false, count: 0, hasAny: true, searchQuery: '', view: undefined };

describe('getEmptyKind', () => {
  describe('when the list has items', () => {
    it('should show the list, even after a failed refetch', () => {
      expect(getEmptyKind({ ...base, count: 2, failed: true })).toBeUndefined();
    });
  });

  describe('when the fetch failed', () => {
    it('should show the error', () => {
      expect(getEmptyKind({ ...base, failed: true })).toBe('error');
    });
  });

  describe('when a search matches nothing', () => {
    it('should say no results, whatever the view', () => {
      expect(getEmptyKind({ ...base, searchQuery: 'zzz', view: FilterBy.PUBLISHED })).toBe(
        'no-results',
      );
    });
  });

  describe('when the View filter leaves nothing', () => {
    it('should say nothing matches', () => {
      expect(getEmptyKind({ ...base, view: FilterBy.UNPUBLISHED })).toBe('no-matches');
    });
  });

  describe('when the account has nothing to manage', () => {
    it('should show the empty tab, even under a View filter', () => {
      expect(getEmptyKind({ ...base, hasAny: false })).toBe('none');
      expect(getEmptyKind({ ...base, hasAny: false, view: FilterBy.PUBLISHED })).toBe('none');
    });
  });
});

describe('getManageEmptyState', () => {
  const actions = {
    onMintName: vi.fn(),
    onRentOrBuyLand: vi.fn(),
    onViewScenes: vi.fn(),
    onRetry: vi.fn(),
  };
  const state = (over: Partial<Parameters<typeof getManageEmptyState>[0]>) =>
    getManageEmptyState({ tab: 'lands', kind: 'none', view: undefined, ...over }, actions);

  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  describe('when the account has no LANDs', () => {
    it('should explain LAND and offer to rent or buy it', () => {
      const props = state({});

      expect(props.icon).toBe('land');
      expect(props.title).toBe('No LANDs to manage yet');
      expect(props.info?.label).toBe('What is LAND?');
      expect(props.info?.readMoreUrl).toBe(
        'https://docs.decentraland.org/marketplace/land-manager',
      );
      expect(props.action).toMatchObject({ label: 'Rent or Buy LAND', variant: 'primary' });
    });
  });

  describe('when the account has no Worlds', () => {
    it('should explain Worlds and offer to mint a NAME', () => {
      const props = state({ tab: 'worlds' });

      expect(props.icon).toBe('world');
      expect(props.title).toBe('No Worlds to manage yet');
      expect(props.info?.label).toBe('What is a World?');
      expect(props.action).toMatchObject({ label: 'Mint New NAME', variant: 'primary' });
    });
  });

  describe('when no LAND is published under View Published', () => {
    it('should point to the Scenes page', () => {
      const props = state({ kind: 'no-matches', view: FilterBy.PUBLISHED });

      expect(props.title).toBe('No published places to display');
      expect(props.description).toBeUndefined();
      expect(props.action).toMatchObject({ label: 'View Scenes', variant: 'secondary' });
    });
  });

  describe('when every LAND is published under View Not Published', () => {
    it('should only say so, with no body and no button', () => {
      const props = state({ kind: 'no-matches', view: FilterBy.UNPUBLISHED });

      expect(props).toEqual({ title: 'No places to display' });
    });
  });

  describe('when no World is unpublished under View Not Published', () => {
    it("should keep today's copy and offer a NAME", () => {
      const props = state({ tab: 'worlds', kind: 'no-matches', view: FilterBy.UNPUBLISHED });

      expect(props.title).toBe('No places to display');
      expect(props.description).toBe('Mint a NAME or become a collaborator to see more results.');
      expect(props.action).toMatchObject({ label: 'Mint New NAME' });
    });
  });

  describe('when the fetch failed', () => {
    it('should offer to try again', () => {
      const props = state({ kind: 'error' });

      expect(props.title).toBe('Something went wrong.');
      expect(props.description).toBe('Please, try again.');
      props.action?.onClick();
      expect(actions.onRetry).toHaveBeenCalled();
      expect(props.action?.variant).toBe('tertiary');
    });
  });

  describe('when a search matches nothing', () => {
    it('should suggest another keyword', () => {
      expect(state({ kind: 'no-results' })).toEqual({
        title: 'No results found',
        description: 'Try a different keyword.',
      });
    });
  });
});
