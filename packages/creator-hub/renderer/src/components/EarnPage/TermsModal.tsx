import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Checkbox, FormControlLabel } from 'decentraland-ui2';

import { useDispatch, useSelector } from '#store';
import { actions } from '/@/modules/store/creatorFund';
import { t } from '/@/modules/store/translation/utils';

import MarkdownRenderer from '../Modals/AppSettings/MarkdownRenderer/MarkdownRenderer';

import { Actions, ErrorLine, ModalCta, TermsShell, VisuallyHidden } from './EarnModal.styled';
import { openMarkdownLink } from './markdownLinks';
import { Spinner } from './Spinner';
import {
  Box,
  BoxState,
  Dialog,
  Gate,
  Glow,
  Hint,
  Scrollview,
  Subtitle,
  Title,
  TitleBar,
  TitleBarClose,
  TermsText,
  TitleText,
} from './TermsModal.styled';
import { CloseIcon, InfoIcon } from './icons';

const BOTTOM_TOLERANCE_PX = 4;

export type TermsModalProps =
  | { variant: 'read'; onClose: () => void }
  | {
      variant: 'accept' | 'reaccept';
      onAccept: (termsVersion: number) => void;
      onClose: () => void;
      error?: string;
      status?: 'idle' | 'submitting';
    };

function formatUpdatedAt(updatedAt: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(updatedAt));
}

/**
 * The Program Terms modal.
 * @param props.variant - `read`, or `accept` / `reaccept`, gated on scrolling to the bottom; `reaccept` cannot be dismissed.
 */
export function TermsModal(props: TermsModalProps) {
  const { variant, onClose } = props;
  const dispatch = useDispatch();
  const terms = useSelector(state => state.creatorFund.terms);
  const locale = useSelector(state => state.translation.locale);
  const titleId = useId();
  const hintId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(false);
  const [checked, setChecked] = useState(false);
  /*
   * The modal opens on the cached terms and refetches them. A newer version that arrives meanwhile
   * is different text, so the scroll gate and the checkbox start over for it.
   */
  const version = terms.data?.version;
  const [gateVersion, setGateVersion] = useState(version);
  if (version !== gateVersion) {
    setGateVersion(version);
    if (gateVersion !== undefined) {
      setAtBottom(false);
      setChecked(false);
    }
  }

  const loadTerms = useCallback(() => dispatch(actions.fetchTerms()), [dispatch]);
  useEffect(() => {
    void loadTerms();
  }, [loadTerms]);

  const checkBottom = useCallback(() => {
    const box = boxRef.current;
    if (box && box.scrollTop + box.clientHeight >= box.scrollHeight - BOTTOM_TOLERANCE_PX) {
      setAtBottom(true);
    }
  }, []);

  useLayoutEffect(() => {
    if (terms.data) checkBottom();
  }, [terms.data, checkBottom]);

  useEffect(() => {
    window.addEventListener('resize', checkBottom);
    return () => window.removeEventListener('resize', checkBottom);
  }, [checkBottom]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape' && variant !== 'reaccept') onClose();
    },
    [variant, onClose],
  );

  const handleAccept = useCallback(() => {
    if (props.variant !== 'read' && terms.data) props.onAccept(terms.data.version);
  }, [props, terms.data]);

  const heading =
    variant === 'reaccept'
      ? t('earn.reaccept.title')
      : (terms.data?.title ?? t('earn.terms.region'));
  const subtitle =
    variant === 'reaccept'
      ? t('earn.reaccept.subtitle')
      : terms.data &&
        t('earn.terms.updated_line', {
          date: formatUpdatedAt(terms.data.published_at, locale),
          version: terms.data.version,
        });

  return (
    <TermsShell open>
      <Dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
      >
        <TitleBar>
          <TitleText>
            <Title id={titleId}>{heading}</Title>
            {subtitle && <Subtitle>{subtitle}</Subtitle>}
          </TitleText>
          {variant !== 'reaccept' && (
            <TitleBarClose
              aria-label={t('earn.close')}
              onClick={onClose}
            >
              <CloseIcon />
            </TitleBarClose>
          )}
        </TitleBar>
        <Glow aria-hidden />
        <Scrollview data-variant={variant}>
          <Box
            ref={boxRef}
            role="region"
            aria-label={t('earn.terms.region')}
            tabIndex={0}
            data-variant={variant}
            onScroll={checkBottom}
          >
            {terms.data ? (
              <TermsText onClick={openMarkdownLink}>
                <MarkdownRenderer content={terms.data.content} />
              </TermsText>
            ) : terms.status === 'failed' ? (
              <BoxState>
                <span role="alert">{t('earn.terms.load_error')}</span>
                <ModalCta
                  variant="contained"
                  color="secondary"
                  size="large"
                  onClick={loadTerms}
                >
                  {t('earn.errors.retry')}
                </ModalCta>
              </BoxState>
            ) : (
              <BoxState>
                <Spinner label={t('earn.loading')} />
              </BoxState>
            )}
          </Box>
          {variant !== 'read' && (
            <Gate>
              {atBottom ? (
                <FormControlLabel
                  control={
                    <Checkbox
                      color="primary"
                      checked={checked}
                      onChange={event => setChecked(event.target.checked)}
                    />
                  }
                  label={t('earn.terms.accept_checkbox')}
                />
              ) : (
                <>
                  <InfoIcon />
                  <Hint id={hintId}>{t('earn.terms.hint')}</Hint>
                </>
              )}
              <VisuallyHidden aria-live="polite">
                {atBottom ? t('earn.terms.gate_open') : ''}
              </VisuallyHidden>
            </Gate>
          )}
          {props.variant !== 'read' && props.error && (
            <ErrorLine role="alert">{props.error}</ErrorLine>
          )}
          <Actions>
            <ModalCta
              variant="contained"
              color="secondary"
              size="large"
              onClick={onClose}
            >
              {variant === 'read' ? t('earn.terms.close') : t('earn.terms.not_now')}
            </ModalCta>
            {props.variant !== 'read' && (
              <ModalCta
                variant="contained"
                color="primary"
                size="large"
                disabled={!checked || !terms.data || props.status === 'submitting'}
                aria-busy={props.status === 'submitting' || undefined}
                aria-describedby={atBottom ? undefined : hintId}
                onClick={handleAccept}
              >
                {variant === 'reaccept'
                  ? t('earn.reaccept.accept')
                  : t('earn.terms.accept_and_join')}
              </ModalCta>
            )}
          </Actions>
        </Scrollview>
      </Dialog>
    </TermsShell>
  );
}
