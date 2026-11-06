import { useEffect, useRef, useState } from 'react';
import { Snackbar } from 'decentraland-ui2';

import { analytics } from '#preload';
import { useDispatch, useSelector } from '#store';
import { actions } from '/@/modules/store/creatorFund';
import type { TranslationPath } from '/@/modules/store/translation/types';
import { t } from '/@/modules/store/translation/utils';

import { VisuallyHidden } from '../EarnModal.styled';
import { SnackbarCheckIcon } from '../icons';

import { ListState } from './parts';
import { ContactCard, WalletCard } from './PayoutCards';
import { PayoutsEmpty } from './PayoutsEmpty';
import { CardsRow, EmptyPanel, Notice, Panel } from './PayoutsTab.styled';
import { PayoutsTable } from './PayoutsTable';
import { VerifyEmailModal } from './VerifyEmailModal';
import { WalletModal } from './WalletModal';

const SNACKBAR_MS = 5_000;

type OpenModal = 'add_wallet' | 'change_wallet' | 'verify_email';

type FocusTarget = 'edit' | 'contact';

const FOCUS_AFTER: Record<OpenModal, FocusTarget> = {
  add_wallet: 'edit',
  change_wallet: 'edit',
  verify_email: 'contact',
};

/** The Creator Fund payouts: the payout wallet, the contact details and the payout per cycle. */
export function PayoutsTab() {
  const dispatch = useDispatch();
  const cycles = useSelector(state => state.creatorFund.cycles);
  const enrollment = useSelector(state => state.creatorFund.enrollment);
  const payouts = useSelector(state => state.creatorFund.payouts);
  const wallet = useSelector(state => state.creatorFund.payoutWallet);
  const [loaded, setLoaded] = useState(() =>
    [payouts, wallet, enrollment].every(resource => resource.status === 'succeeded'),
  );
  const [modal, setModal] = useState<OpenModal | null>(null);
  const [notice, setNotice] = useState<{ message: TranslationPath; open: boolean } | null>(null);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const contactTitleRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);

  const loadedWhenSettled = (requests: Promise<unknown>[]) =>
    void Promise.all(requests).then(() => mounted.current && setLoaded(true));

  useEffect(() => {
    mounted.current = true;
    if (cycles.status === 'idle') void dispatch(actions.fetchCycles());
    const requests: Promise<unknown>[] = [
      dispatch(actions.fetchPayouts()),
      dispatch(actions.fetchPayoutWallet()),
    ];
    if (enrollment.status === 'idle') requests.push(dispatch(actions.fetchEnrollment()));
    loadedWhenSettled(requests);
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (modal || !focusTarget) return;
    (focusTarget === 'edit' ? editRef : contactTitleRef).current?.focus();
    setFocusTarget(null);
  }, [modal, focusTarget]);

  const close = () => setModal(null);
  const done = (message: TranslationPath) => {
    if (modal) setFocusTarget(FOCUS_AFTER[modal]);
    setModal(null);
    setNotice({ message, open: true });
  };

  const retry = () => {
    setLoaded(false);
    const requests: Promise<unknown>[] = [];
    if (payouts.status === 'failed') requests.push(dispatch(actions.fetchPayouts()));
    if (wallet.status === 'failed') requests.push(dispatch(actions.fetchPayoutWallet()));
    if (enrollment.status === 'failed') requests.push(dispatch(actions.fetchEnrollment()));
    loadedWhenSettled(requests);
  };

  const failed = [payouts, wallet, enrollment].some(resource => resource.status === 'failed');
  const empty = loaded && !failed && payouts.data?.payouts.length === 0;
  const Shell = empty ? EmptyPanel : Panel;

  let body: React.ReactNode;
  if (!loaded) {
    body = <ListState kind="loading" />;
  } else if (failed) {
    body = (
      <ListState
        kind="error"
        message={t('earn.joined.payouts.error')}
        onRetry={retry}
      />
    );
  } else {
    let list: React.ReactNode = <ListState kind="loading" />;
    if (empty) list = <PayoutsEmpty />;
    else if (payouts.data) list = <PayoutsTable payouts={payouts.data.payouts} />;
    body = (
      <>
        <CardsRow>
          <WalletCard
            wallet={wallet.status === 'succeeded' ? wallet.data : undefined}
            editRef={editRef}
            onAdd={() => setModal('add_wallet')}
            onChange={() => setModal('change_wallet')}
          />
          <ContactCard
            enrollment={enrollment.data}
            titleRef={contactTitleRef}
            onVerify={() => {
              void analytics.track('Creator Fund Email Verification Started', undefined);
              setModal('verify_email');
            }}
          />
        </CardsRow>
        {list}
      </>
    );
  }

  return (
    <Shell>
      {body}
      {(modal === 'add_wallet' || modal === 'change_wallet') && (
        <WalletModal
          variant={modal === 'add_wallet' ? 'add' : 'change'}
          onClose={close}
          onDone={done}
        />
      )}
      {modal === 'verify_email' && enrollment.data && (
        <VerifyEmailModal
          email={enrollment.data.email}
          onClose={close}
          onDone={done}
        />
      )}
      <VisuallyHidden role="status">{notice?.open && t(notice.message)}</VisuallyHidden>
      <Snackbar
        open={!!notice?.open}
        autoHideDuration={SNACKBAR_MS}
        onClose={(_, reason) =>
          reason !== 'clickaway' && setNotice(current => current && { ...current, open: false })
        }
        TransitionProps={{ onExited: () => setNotice(null) }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ '&&': { bottom: 20 } }}
      >
        <Notice aria-hidden>
          <SnackbarCheckIcon />
          {notice && t(notice.message)}
        </Notice>
      </Snackbar>
    </Shell>
  );
}
