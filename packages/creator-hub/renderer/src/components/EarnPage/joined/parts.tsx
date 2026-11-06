import { t } from '/@/modules/store/translation/utils';

import { ModalCta } from '../EarnModal.styled';
import { StatusLine } from '../Landing.styled';
import { Spinner } from '../Spinner';

import { StateBox } from './parts.styled';

export type ListStateProps =
  | { kind: 'loading' }
  | { kind: 'empty'; message: string }
  | { kind: 'error'; message: string; onRetry: () => void };

/** A list's loading, empty or error state, centred where the rows would be. */
export function ListState(props: ListStateProps) {
  return (
    <StateBox>
      {props.kind === 'loading' && (
        <Spinner
          label={t('earn.loading')}
          size={48}
        />
      )}
      {props.kind === 'empty' && <StatusLine role="status">{props.message}</StatusLine>}
      {props.kind === 'error' && (
        <>
          <StatusLine role="alert">{props.message}</StatusLine>
          <ModalCta
            variant="contained"
            color="secondary"
            size="large"
            onClick={props.onRetry}
          >
            {t('earn.errors.retry')}
          </ModalCta>
        </>
      )}
    </StateBox>
  );
}
