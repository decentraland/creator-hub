import React, { useMemo } from 'react';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import { Typography } from 'decentraland-ui2';
import { Button as ButtonText } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import type { WorldsWalletStats } from '/@/lib/worlds';
import { formatSize } from '/@/modules/file';
import { getMbsFromAccountHoldings, type AccountHoldings } from '/@/lib/account';
import { misc } from '#preload';
import { Modal } from '..';
import { Button } from '../../Button';
import './styles.css';

type Props = {
  stats: WorldsWalletStats;
  accountHoldings: AccountHoldings | null;
  open: boolean;
  onClose: () => void;
};

const MARKETPLACE_WEB_URL = 'https://decentraland.org/marketplace';
const ACCOUNT_URL = 'https://decentraland.org/account';
const WORLDS_STORAGE_PROPOSAL_URL =
  'https://governance.decentraland.org/proposal/?id=c3216070-e822-11ed-b8f1-75dbe089d333';

const LinkButton = ({ label, href }: { label: string; href: string }) => (
  <Button
    endIcon={<OpenInNewIcon />}
    onClick={() => misc.openExternal(href)}
  >
    {label}
  </Button>
);

const WorldsYourStorageModal: React.FC<Props> = React.memo(
  ({ stats, accountHoldings, open, onClose }) => {
    const mbsFromAccountHoldings = useMemo(
      () => (accountHoldings ? getMbsFromAccountHoldings(accountHoldings) : null),
      [accountHoldings],
    );

    return (
      <Modal
        open={open}
        onClose={onClose}
        title={t('modal.worlds_storage.your_storage')}
        size="small"
        className="WorldsYourStorageModal"
      >
        <Typography className="TotalStorage">
          <span>{t('modal.worlds_storage.total_available_storage')}</span>
          <span className="Mbs">
            {formatSize(Number(stats.maxAllowedSpace) - Number(stats.usedSpace))}
          </span>
        </Typography>
        <div className="Asset">
          <div className="Texts">
            <span className="Name">{t('modal.worlds_storage.mana')}</span>
            <span className="Subtitle">{t('modal.worlds_storage.mana_earn_storage')}</span>
            {accountHoldings && mbsFromAccountHoldings && mbsFromAccountHoldings.manaMbs > 0 ? (
              <span className="Amount">
                <CheckCircleIcon className="CheckIcon" />
                {t('modal.worlds_storage.mana_holdings', {
                  mbs: mbsFromAccountHoldings.manaMbs,
                  owned: Math.trunc(accountHoldings.ownedMana),
                })}
              </span>
            ) : null}
          </div>
          <LinkButton
            href={ACCOUNT_URL}
            label={t('modal.worlds_storage.mana_buy')}
          />
        </div>
        <hr className="Separator" />
        <div className="Asset">
          <div className="Texts">
            <span className="Name">{t('modal.worlds_storage.lands')}</span>
            <span className="Subtitle">{t('modal.worlds_storage.lands_earn_storage')}</span>
            {accountHoldings && mbsFromAccountHoldings && mbsFromAccountHoldings.landMbs > 0 ? (
              <span className="Amount">
                <CheckCircleIcon className="CheckIcon" />
                {t('modal.worlds_storage.lands_holdings', {
                  mbs: mbsFromAccountHoldings.landMbs,
                  owned: accountHoldings.ownedLands,
                })}
              </span>
            ) : null}
          </div>
          <LinkButton
            href={MARKETPLACE_WEB_URL + '/lands'}
            label={t('modal.worlds_storage.lands_buy')}
          />
        </div>
        <hr className="Separator" />
        <div className="Asset">
          <div className="Texts">
            <span className="Name">{t('modal.worlds_storage.names')}</span>
            <span className="Subtitle">{t('modal.worlds_storage.names_earn_storage')}</span>
            {accountHoldings && mbsFromAccountHoldings && mbsFromAccountHoldings.nameMbs > 0 ? (
              <span className="Amount">
                <CheckCircleIcon className="CheckIcon" />
                {t('modal.worlds_storage.names_holdings', {
                  mbs: mbsFromAccountHoldings.nameMbs,
                  owned: accountHoldings.ownedNames,
                })}
              </span>
            ) : null}
          </div>
          <LinkButton
            href={`${MARKETPLACE_WEB_URL}/names/claim`}
            label={t('modal.worlds_storage.names_buy')}
          />
        </div>
        <Typography className="Proposal">
          <InfoIcon className="InfoIcon" />
          <span>{t('modal.worlds_storage.proposal')}</span>{' '}
          <ButtonText
            variant="text"
            onClick={() => misc.openExternal(WORLDS_STORAGE_PROPOSAL_URL)}
          >
            {t('modal.worlds_storage.learn_more')}
          </ButtonText>
        </Typography>
      </Modal>
    );
  },
);

export { WorldsYourStorageModal };
