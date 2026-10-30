import { useState } from 'react';
import type { Address } from 'viem';

import { useSelector } from '#store';
import { useAuth } from '/@/hooks/useAuth';
import { buildSetUpdateManager } from '/@/lib/landTransactions';
import type { AppState } from '/@/modules/store';
import { getManagers, type ManagerState } from '/@/modules/store/management/utils';
import type { TranslationPath } from '/@/modules/store/translation/types';
import { t } from '/@/modules/store/translation/utils';

import { EmptyState } from '../../ManagePage/EmptyState';
import { InfoTip } from '../../ManagePage/InfoTip';
import { AccessChangeModal, type AccessRequest } from '../access/AccessChangeModal';
import { AccessRow } from '../access/AccessRow';
import { AddRecipient } from '../access/AddRecipient';
import { AddBlock, Description, ListBlock, ListHeader, Root, Rows } from '../access/access.styled';
import { useDisplayName } from '../access/useDisplayName';

const bold = (chunks: string) => <b>{chunks}</b>;

const PARTIAL_NOTE: Record<ManagerState, TranslationPath | null> = {
  full: null,
  'land-only': 'land_detail.managers.land_only',
  'estate-only': 'land_detail.managers.estate_only',
};

const managerState = (state: AppState, address: string) =>
  getManagers(state.land.authorizations).find(
    manager => manager.address.toLowerCase() === address.toLowerCase(),
  )?.state;

/** The account-wide UpdateManagers: each add or remove signs the LAND, then the Estate registry. */
export function ManagersTab() {
  const { wallet = '' } = useAuth();
  const managers = getManagers(useSelector(state => state.land.authorizations));
  const [request, setRequest] = useState<AccessRequest | null>(null);
  const displayName = useDisplayName();
  const stepLabels = [t('land_detail.managers.step_land'), t('land_detail.managers.step_estates')];

  const add = (address: string) =>
    setRequest({
      title: t('land_detail.managers.add_title'),
      body: t('land_detail.managers.add_body', { name: displayName(address), b: bold }),
      confirmLabel: t('land_detail.collaborators.add'),
      doneText: t('tx.done.manager_added'),
      txs: buildSetUpdateManager(wallet as Address, address as Address, true),
      isApplied: state => managerState(state, address) === 'full',
      stepLabels,
    });

  const remove = (address: string) =>
    setRequest({
      title: t('land_detail.managers.remove_title', { name: displayName(address) }),
      body: t('land_detail.managers.remove_body'),
      confirmLabel: t('land_detail.collaborators.remove_confirm'),
      doneText: t('tx.done.manager_removed'),
      txs: buildSetUpdateManager(wallet as Address, address as Address, false),
      isApplied: state => !managerState(state, address),
      stepLabels,
    });

  return (
    <Root>
      <AddBlock>
        <Description>{t('land_detail.managers.description')}</Description>
        <AddRecipient onAdd={recipient => add(recipient.address)} />
      </AddBlock>
      {managers.length ? (
        <ListBlock>
          <ListHeader>{t('land_detail.managers.count', { count: managers.length })}</ListHeader>
          <Rows>
            {managers.map(manager => {
              const note = PARTIAL_NOTE[manager.state];
              return (
                <AccessRow
                  key={manager.address}
                  address={manager.address}
                  onRemove={() => remove(manager.address)}
                  note={
                    note && (
                      <InfoTip
                        label={t(note)}
                        variant="warning"
                      >
                        {t(note)}
                      </InfoTip>
                    )
                  }
                />
              );
            })}
          </Rows>
        </ListBlock>
      ) : (
        <EmptyState
          title={t('land_detail.managers.empty')}
          description={t('land_detail.managers.description')}
        />
      )}
      {request && (
        <AccessChangeModal
          request={request}
          onClose={() => setRequest(null)}
        />
      )}
    </Root>
  );
}
