import { t } from '/@/modules/store/translation/utils';
import { FilterBy, type ManageTab } from '/shared/types/manage';

import type { EmptyState } from './EmptyState';
import { InlineLink } from './EmptyState';

export const CLAIM_NAME_URL = 'https://decentraland.org/marketplace/names/claim';
const ENS_URL = 'https://app.ens.domains/';
const WORLDS_READ_MORE_URL =
  'https://decentraland.org/blog/about-decentraland/decentraland-worlds-your-own-virtual-space';
const LAND_READ_MORE_URL = 'https://docs.decentraland.org/marketplace/land-manager';

export type ManageEmptyKind = 'error' | 'no-results' | 'no-matches' | 'none';

type ListState = {
  failed: boolean;
  count: number;
  hasAny: boolean;
  searchQuery: string;
  view: FilterBy | undefined;
};

/** Which empty view a tab shows, or none while it has items to list. */
export function getEmptyKind(list: ListState): ManageEmptyKind | undefined {
  if (list.count > 0) return undefined;
  if (list.failed) return 'error';
  if (list.searchQuery.trim()) return 'no-results';
  if (list.hasAny && list.view !== undefined) return 'no-matches';
  return 'none';
}

type Actions = {
  onMintName: () => void;
  onRentOrBuyLand: () => void;
  onViewScenes: () => void;
  onRetry: () => void;
};

type EmptyStateProps = Parameters<typeof EmptyState>[0];

function noneOwned(tab: ManageTab, actions: Actions): EmptyStateProps {
  if (tab === 'lands') {
    return {
      icon: 'land',
      title: t('manage.empty_list.lands.title'),
      info: {
        label: t('manage.empty_list.lands.info_label'),
        text: t('manage.empty_list.lands.info'),
        readMoreUrl: LAND_READ_MORE_URL,
      },
      description: t('manage.empty_list.lands.description'),
      action: {
        label: t('manage.actions.rent_or_buy_land'),
        variant: 'primary',
        onClick: actions.onRentOrBuyLand,
      },
    };
  }
  return {
    icon: 'world',
    title: t('manage.empty_list.worlds.title'),
    info: {
      label: t('manage.empty_list.worlds.info_label'),
      text: t('manage.empty_list.worlds.info'),
      readMoreUrl: WORLDS_READ_MORE_URL,
    },
    description: t('manage.empty_list.worlds.description', {
      name: (chunks: string) => <InlineLink href={CLAIM_NAME_URL}>{chunks}</InlineLink>,
      ens: (chunks: string) => <InlineLink href={ENS_URL}>{chunks}</InlineLink>,
    }),
    action: {
      label: t('manage.actions.mint_name'),
      variant: 'primary',
      onClick: actions.onMintName,
    },
  };
}

function noMatches(tab: ManageTab, view: FilterBy | undefined, actions: Actions): EmptyStateProps {
  const viewScenes = {
    label: t('manage.actions.view_scenes'),
    variant: 'secondary',
    onClick: actions.onViewScenes,
  } as const;
  if (view === FilterBy.PUBLISHED) {
    return tab === 'lands'
      ? { title: t('manage.empty_list.published.title'), action: viewScenes }
      : {
          title: t('manage.empty_list.published.title'),
          description: t('manage.empty_list.published.description'),
          action: viewScenes,
        };
  }
  return tab === 'lands'
    ? { title: t('manage.empty_list.unpublished.title') }
    : {
        title: t('manage.empty_list.unpublished.title'),
        description: t('manage.empty_list.unpublished.description'),
        action: {
          label: t('manage.actions.mint_name'),
          variant: 'secondary',
          onClick: actions.onMintName,
        },
      };
}

/** The EmptyState a Manage tab shows for an empty kind. */
export function getManageEmptyState(
  state: { tab: ManageTab; kind: ManageEmptyKind; view: FilterBy | undefined },
  actions: Actions,
): EmptyStateProps {
  switch (state.kind) {
    case 'error':
      return {
        title: t('manage.errors.fetch.title'),
        description: t('manage.errors.fetch.description'),
        action: {
          label: t('manage.errors.fetch.retry'),
          variant: 'tertiary',
          onClick: actions.onRetry,
        },
      };
    case 'no-results':
      return {
        title: t('manage.empty_list.search.title'),
        description: t('manage.empty_list.search.description'),
      };
    case 'no-matches':
      return noMatches(state.tab, state.view, actions);
    case 'none':
      return noneOwned(state.tab, actions);
  }
}
