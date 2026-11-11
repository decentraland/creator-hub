import { useId, useState } from 'react';

import { feedback } from '#preload';
import type { FeedbackDelivery, FeedbackSource } from '/shared/types/feedback';
import { t } from '/@/modules/store/translation/utils';
import { EMAIL_MAX_LENGTH, HELP_FAQ_URL, isValidContact, parseContact } from '/@/modules/utils';

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

type Status = 'editing' | 'sending' | FeedbackDelivery | 'failed';

type Props = {
  open: boolean;
  source: FeedbackSource;
  associatedEventId?: string;
  onClose: () => void;
};

/** Collects a problem report and sends it, with the app log when allowed, to Sentry User Feedback. */
export function ReportIssue({ open, source, associatedEventId, onClose }: Props) {
  const descriptionId = useId();
  const contactId = useId();
  const contactHintId = useId();
  const contactErrorId = useId();
  const logsHintId = useId();
  const [message, setMessage] = useState('');
  const [contactValue, setContactValue] = useState('');
  const [contactBlurred, setContactBlurred] = useState(false);
  const [includeLogs, setIncludeLogs] = useState(true);
  const [status, setStatus] = useState<Status>('editing');

  const contact = parseContact(contactValue);
  const contactInvalid = !!contact && !isValidContact(contact);
  const showContactError = contactBlurred && contactInvalid;
  const sending = status === 'sending';
  const delivered = status === 'sent' || status === 'queued';

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
    try {
      const delivery = await feedback.send({
        message: message.trim(),
        ...(contact && { contact }),
        includeLogs,
        associatedEventId,
        source,
      });
      setStatus(delivery);
    } catch {
      setStatus('failed');
    }
  };

  if (delivered)
    return (
      <DefaultModal
        open={open}
        title={t('modal.report_issue.title')}
        body={t(`modal.report_issue.${status}`)}
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
        state: sending ? 'busy' : message.trim() && !contactInvalid ? 'idle' : 'blocked',
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
          <FieldTitle htmlFor={contactId}>{t('modal.report_issue.contact.label')}</FieldTitle>
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
              'aria-invalid': showContactError,
              'aria-describedby': showContactError
                ? `${contactErrorId} ${contactHintId}`
                : contactHintId,
            }}
          />
          {contact && showContactError && (
            <ErrorText id={contactErrorId}>
              {t(`modal.report_issue.contact.${contact.method}_invalid`)}
            </ErrorText>
          )}
          <Hint id={contactHintId}>{t('modal.report_issue.contact.hint')}</Hint>
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
