import { type ElementType, useEffect, useId, useState } from 'react';
import type { InputBaseComponentProps } from 'decentraland-ui2';

import { analytics, feedback } from '#preload';
import {
  FEEDBACK_MESSAGE_MAX_LENGTH,
  type FeedbackDelivery,
  type FeedbackSource,
} from '/shared/types/feedback';
import { t } from '/@/modules/store/translation/utils';
import { EMAIL_MAX_LENGTH, HELP_FAQ_URL, isValidContact, parseContact } from '/@/modules/utils';

import { Required } from '../../EarnPage/ContactInfoForm.styled';
import { WarningIcon } from '../../EarnPage/icons/WarningIcon';
import { SelectCheckbox } from '../../LandDetailPage/SelectCheckbox';
import { Field } from '../../LandDetailPage/DetailsTab/DetailsTab.styled';
import { FormTextInput } from '../../TextInput';
import { CheckRow } from '../../WorldDetailPage/SettingsTab/SettingsTab.styled';
import { DefaultModal } from '../DefaultModal';
import {
  ContactHint,
  Counter,
  DescriptionBox,
  ErrorLine,
  Form,
  HelpLink,
  Hint,
  Label,
  LogsOption,
} from './ReportIssue.styled';

type Status = 'editing' | 'sending' | FeedbackDelivery | 'failed';

type CounterState = 'over' | 'shown' | 'hidden';

const NATIVE_TEXTAREA = 'textarea' as ElementType<InputBaseComponentProps>;

type Props = {
  open: boolean;
  source: FeedbackSource;
  associatedEventId?: string;
  onClose: () => void;
};

/** Collects a problem report and sends it, with the app log when allowed, to Sentry User Feedback. */
export function ReportIssue({ open, source, associatedEventId, onClose }: Props) {
  const descriptionId = useId();
  const counterId = useId();
  const contactId = useId();
  const contactHintId = useId();
  const contactErrorId = useId();
  const logsHintId = useId();
  const [message, setMessage] = useState('');
  const [descriptionFocused, setDescriptionFocused] = useState(false);
  const [contactValue, setContactValue] = useState('');
  const [contactBlurred, setContactBlurred] = useState(false);
  const [includeLogs, setIncludeLogs] = useState(true);
  const [status, setStatus] = useState<Status>('editing');

  const contact = parseContact(contactValue);
  const contactInvalid = !!contact && !isValidContact(contact);
  const showContactError = contactBlurred && contactInvalid;
  const overLimit = message.length > FEEDBACK_MESSAGE_MAX_LENGTH;
  const counter: CounterState = overLimit ? 'over' : descriptionFocused ? 'shown' : 'hidden';
  const sending = status === 'sending';
  const delivered = status === 'sent' || status === 'queued' || status === 'unknown';

  useEffect(() => {
    if (open) void analytics.track('Report Issue Opened', { source });
  }, [open, source]);

  const close = () => {
    if (sending) return;
    if (delivered) {
      setMessage('');
      setContactValue('');
      setContactBlurred(false);
      setIncludeLogs(true);
    }
    setStatus('editing');
    onClose();
  };

  const send = async () => {
    setStatus('sending');
    let result: FeedbackDelivery | 'failed';
    try {
      result = await feedback.send({
        message: message.trim(),
        ...(contact && { contact }),
        includeLogs,
        associatedEventId,
        source,
      });
    } catch {
      result = 'failed';
    }
    setStatus(result);
    void analytics.track('Report Issue Submitted', { source, result });
  };

  if (delivered)
    return (
      <DefaultModal
        open={open}
        title={t(`modal.report_issue.${status}_title`)}
        body={t(`modal.report_issue.${status}`)}
        onClose={close}
        primary={{ label: t('modal.close'), state: 'idle', onClick: close }}
      />
    );

  if (status === 'failed')
    return (
      <DefaultModal
        open={open}
        title={t('modal.report_issue.failed_title')}
        body={t('modal.report_issue.failed')}
        onClose={close}
        secondary={{ label: t('modal.cancel'), onClick: close }}
        primary={{
          label: t('modal.report_issue.retry'),
          state: 'idle',
          onClick: () => setStatus('editing'),
        }}
      />
    );

  return (
    <DefaultModal
      open={open}
      title={t('modal.report_issue.title')}
      onClose={close}
      corner={sending ? 'none' : 'close'}
      initialFocus="content"
      secondary={{ label: t('modal.cancel'), onClick: close }}
      primary={{
        label: t('modal.report_issue.send'),
        state: sending
          ? 'busy'
          : !message.trim() || overLimit || contactInvalid
            ? 'blocked'
            : 'idle',
        onClick: () => void send(),
      }}
    >
      <Form>
        <Field>
          <Label htmlFor={descriptionId}>
            {t('modal.report_issue.description.label')}
            <Required aria-hidden> *</Required>
          </Label>
          <DescriptionBox
            id={descriptionId}
            multiline
            inputComponent={NATIVE_TEXTAREA}
            autoFocus
            required
            disabled={sending}
            value={message}
            error={overLimit}
            placeholder={t('modal.report_issue.description.placeholder')}
            onChange={event => setMessage(event.target.value)}
            onFocus={() => setDescriptionFocused(true)}
            onBlur={() => setDescriptionFocused(false)}
            inputProps={{ 'aria-invalid': overLimit, 'aria-describedby': counterId }}
          />
          <Counter
            id={counterId}
            data-state={counter}
          >
            {counter === 'over' && <WarningIcon />}
            {counter !== 'hidden' &&
              t('modal.report_issue.description.counter', {
                count: String(message.length),
                max: String(FEEDBACK_MESSAGE_MAX_LENGTH),
              })}
          </Counter>
        </Field>
        <Field>
          <Label htmlFor={contactId}>{t('modal.report_issue.contact.label')}</Label>
          <ContactHint id={contactHintId}>{t('modal.report_issue.contact.hint')}</ContactHint>
          <FormTextInput
            id={contactId}
            type="text"
            disabled={sending}
            value={contactValue}
            error={showContactError}
            placeholder={t('modal.report_issue.contact.placeholder')}
            onChange={event => setContactValue(event.target.value)}
            onBlur={() => setContactBlurred(true)}
            inputProps={{
              maxLength: EMAIL_MAX_LENGTH,
              spellCheck: false,
              'aria-invalid': showContactError,
              'aria-describedby': showContactError
                ? `${contactErrorId} ${contactHintId}`
                : contactHintId,
            }}
          />
          {contact && showContactError && (
            <ErrorLine
              id={contactErrorId}
              role="alert"
            >
              <WarningIcon />
              {t(`modal.report_issue.contact.${contact.method}_invalid`)}
            </ErrorLine>
          )}
        </Field>
        <LogsOption>
          <CheckRow>
            <SelectCheckbox
              checked={includeLogs}
              disabled={sending}
              onChange={event => setIncludeLogs(event.target.checked)}
              inputProps={{ 'aria-describedby': logsHintId }}
            />
            {t('modal.report_issue.logs.label')}
          </CheckRow>
          <Hint id={logsHintId}>{t('modal.report_issue.logs.hint')}</Hint>
        </LogsOption>
        <HelpLink
          href={HELP_FAQ_URL}
          onOpen={() => void analytics.track('Report Issue Help Center Clicked', { source })}
        >
          {t('modal.report_issue.help_center')}
          <span aria-hidden> →</span>
        </HelpLink>
      </Form>
    </DefaultModal>
  );
}
