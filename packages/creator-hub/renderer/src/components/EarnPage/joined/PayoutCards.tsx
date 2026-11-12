import { useId, useRef, useState } from 'react';
import { Tooltip } from 'decentraland-ui2';

import type { Enrollment, PayoutWallet } from '/shared/types/creator-fund';

import { misc } from '#preload';
import { t } from '/@/modules/store/translation/utils';

import { CopyIcon, InfoIcon, WarningIcon } from '../icons';

import { TOOLTIP_SLOTS } from './parts';
import { InfoButton } from './parts.styled';
import {
  AddWalletButton,
  Address,
  AddressChip,
  Card,
  CardHeader,
  CardTitle,
  ContactLabel,
  ContactText,
  ContactValue,
  ContactValues,
  CornerButton,
  InfoGroup,
  LearnMore,
  UnverifiedBadge,
} from './PayoutsTab.styled';
import { shortAddress } from './wallet';

const GET_A_WALLET_URL = 'https://docs.decentraland.org/blockchain-integration/get-a-wallet';

const INFO_TOOLTIP_SLOTS = { ...TOOLTIP_SLOTS, popper: { disablePortal: true } };

/**
 * The payout-wallet info button and its interactive tooltip. The tooltip renders right after the
 * button, so Tab moves from the button into "Learn More"; it stays open while focus is in either.
 */
function WalletInfo() {
  const [open, setOpen] = useState(false);
  const groupRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const focusStaysIn = (event: React.SyntheticEvent | Event) => {
    const next = (event as React.FocusEvent).relatedTarget;
    return next instanceof Node && !!groupRef.current?.contains(next);
  };
  return (
    <InfoGroup
      ref={groupRef}
      onBlur={event => !focusStaysIn(event) && setOpen(false)}
    >
      <Tooltip
        open={open}
        onOpen={() => setOpen(true)}
        onClose={event => {
          if (focusStaysIn(event)) return;
          if (groupRef.current?.contains(document.activeElement)) buttonRef.current?.focus();
          setOpen(false);
        }}
        title={
          <>
            {t('earn.joined.payouts.wallet.info')}{' '}
            <LearnMore
              href={GET_A_WALLET_URL}
              onClick={event => {
                event.preventDefault();
                void misc.openExternal(GET_A_WALLET_URL);
              }}
            >
              {t('earn.joined.payouts.wallet.learn_more')}
              <span aria-hidden> →</span>
            </LearnMore>
          </>
        }
        placement="top"
        arrow
        describeChild
        disableInteractive={false}
        slotProps={INFO_TOOLTIP_SLOTS}
      >
        <InfoButton
          ref={buttonRef}
          type="button"
          aria-label={t('earn.joined.payouts.wallet.info_label')}
        >
          <InfoIcon />
        </InfoButton>
      </Tooltip>
    </InfoGroup>
  );
}

/**
 * The payout wallet: its short address as a chip that copies it, and EDIT; ADD WALLET when none is set.
 * @param props.wallet - `undefined` while it loads.
 */
export function WalletCard({
  wallet,
  editRef,
  onAdd,
  onChange,
}: {
  wallet: PayoutWallet | null | undefined;
  editRef?: React.Ref<HTMLButtonElement>;
  onAdd: () => void;
  onChange: () => void;
}) {
  const titleId = useId();
  return (
    <Card
      aria-labelledby={titleId}
      data-testid="payouts-wallet-card"
    >
      <CardHeader>
        <CardTitle id={titleId}>{t('earn.joined.payouts.wallet.title')}</CardTitle>
        <WalletInfo />
      </CardHeader>
      {wallet && (
        <>
          <AddressChip
            text={wallet.address}
            label={t('earn.joined.payouts.wallet.copy')}
            showPopup
          >
            <Address title={wallet.address}>{shortAddress(wallet.address)}</Address>
            <CopyIcon />
          </AddressChip>
          <CornerButton
            ref={editRef}
            variant="outlined"
            onClick={onChange}
          >
            {t('earn.joined.payouts.wallet.edit')}
          </CornerButton>
        </>
      )}
      {wallet === null && (
        <AddWalletButton
          variant="contained"
          onClick={onAdd}
        >
          {t('earn.joined.payouts.wallet.add')}
        </AddWalletButton>
      )}
    </Card>
  );
}

/** The enrollment's name and read-only email, with VERIFY EMAIL until the email is verified. */
export function ContactCard({
  enrollment,
  titleRef,
  onVerify,
}: {
  enrollment: Enrollment | null;
  titleRef?: React.Ref<HTMLHeadingElement>;
  onVerify: () => void;
}) {
  const titleId = useId();
  const unverified = !!enrollment && !enrollment.email_verified_at;
  return (
    <Card
      aria-labelledby={titleId}
      data-testid="payouts-contact-card"
    >
      <CardHeader>
        <CardTitle
          id={titleId}
          ref={titleRef}
          tabIndex={-1}
        >
          {t('earn.joined.payouts.contact.title')}
        </CardTitle>
      </CardHeader>
      {unverified && (
        <CornerButton
          variant="outlined"
          onClick={onVerify}
        >
          {t('earn.joined.payouts.contact.verify')}
        </CornerButton>
      )}
      {enrollment && (
        <ContactValues>
          <ContactValue>
            <ContactLabel>{t('earn.joined.payouts.contact.full_name')}</ContactLabel>
            <ContactText>{`${enrollment.first_name} ${enrollment.last_name}`}</ContactText>
          </ContactValue>
          <ContactValue>
            <ContactLabel>
              {t('earn.joined.payouts.contact.email')}
              {unverified && (
                <UnverifiedBadge>
                  <WarningIcon />
                  {t('earn.joined.payouts.contact.unverified')}
                </UnverifiedBadge>
              )}
            </ContactLabel>
            <ContactText>{enrollment.email}</ContactText>
          </ContactValue>
        </ContactValues>
      )}
    </Card>
  );
}
