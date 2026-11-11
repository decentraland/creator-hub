import { useId, useState } from 'react';

import { feedback } from '#preload';
import type { FeedbackSource } from '/shared/types/feedback';
import { t } from '/@/modules/store/translation/utils';
import { EMAIL_MAX_LENGTH, HELP_FAQ_URL, isEmail } from '/@/modules/utils';

import { SelectCheckbox } from '../../LandDetailPage/SelectCheckbox';
import {
  DescriptionInput,
  ErrorText,
  Field,
  FieldTitle,
} from '../../LandDetailPage/DetailsTab/DetailsTab.styled';
import { FormTextInput } from '../../TextInput';
import { CheckRow } from '../../WorldDetailPage/SettingsTab/SettingsTab.styled';
import { DefaultModal } from '../DefaultModal';
import { Form, HelpLink, Hint, LogsOption } from './ReportIssue.styled';

type Status = 'editing' | 'sending' | 'sent' | 'failed';

type Props = {
  open: boolean;
  source: FeedbackSource;
  associatedEventId?: string;
  onClose: () => void;
};

/** Collects a problem report and sends it, with the app log when allowed, to Sentry User Feedback. */
export function ReportIssue({ open, source, associatedEventId, onClose }: Props) {
  const descriptionId = useId();
  const emailId = useId();
  const emailErrorId = useId();
  const logsHintId = useId();
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [emailBlurred, setEmailBlurred] = useState(false);
  const [includeLogs, setIncludeLogs] = useState(true);
  const [status, setStatus] = useState<Status>('editing');

  const contact = email.trim();
  const emailInvalid = !!contact && !isEmail(contact);
  const showEmailError = emailBlurred && emailInvalid;
  const sending = status === 'sending';

  const close = () => {
    if (sending) return;
    if (status === 'sent') {
      setMessage('');
      setEmail('');
      setEmailBlurred(false);
      setIncludeLogs(true);
    }
    setStatus('editing');
    onClose();
  };

  const send = async () => {
    setStatus('sending');
    try {
      await feedback.send({
        message: message.trim(),
        email: contact || undefined,
        includeLogs,
        associatedEventId,
        source,
      });
      setStatus('sent');
    } catch {
      setStatus('failed');
    }
  };

  if (status === 'sent')
    return (
      <DefaultModal
        open={open}
        title={t('modal.report_issue.title')}
        body={t('modal.report_issue.sent')}
        onClose={close}
        primary={{ label: t('modal.close'), state: 'idle', onClick: close }}
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
        label: t(status === 'failed' ? 'modal.report_issue.retry' : 'modal.report_issue.send'),
        state: sending ? 'busy' : message.trim() && !emailInvalid ? 'idle' : 'blocked',
        onClick: () => void send(),
      }}
    >
      <Form>
        <Field>
          <FieldTitle htmlFor={descriptionId}>
            {t('modal.report_issue.description.label')}
          </FieldTitle>
          <DescriptionInput
            id={descriptionId}
            multiline
            autoFocus
            required
            disabled={sending}
            value={message}
            placeholder={t('modal.report_issue.description.placeholder')}
            onChange={event => setMessage(event.target.value)}
          />
        </Field>
        <Field>
          <FieldTitle htmlFor={emailId}>{t('modal.report_issue.email.label')}</FieldTitle>
          <FormTextInput
            id={emailId}
            type="email"
            disabled={sending}
            value={email}
            error={showEmailError}
            placeholder={t('modal.report_issue.email.placeholder')}
            onChange={event => setEmail(event.target.value)}
            onBlur={() => setEmailBlurred(true)}
            inputProps={{
              maxLength: EMAIL_MAX_LENGTH,
              'aria-invalid': showEmailError,
              'aria-describedby': showEmailError ? emailErrorId : undefined,
            }}
          />
          {showEmailError && (
            <ErrorText id={emailErrorId}>{t('modal.report_issue.email.invalid')}</ErrorText>
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
        {status === 'failed' && (
          <ErrorText role="alert">{t('modal.report_issue.failed')}</ErrorText>
        )}
        <HelpLink href={HELP_FAQ_URL}>{t('modal.report_issue.help_center')}</HelpLink>
      </Form>
    </DefaultModal>
  );
}
