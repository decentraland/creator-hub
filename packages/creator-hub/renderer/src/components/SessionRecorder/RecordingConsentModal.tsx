import { t } from '/@/modules/store/translation/utils';
import { DefaultModal } from '../Modals/DefaultModal';
import { ConsentList } from './RecordingConsentModal.styled';

type Props = {
  open: boolean;
  // The speech-to-text download still to come, in MB (0 when already installed).
  downloadMb: number;
  onAccept: () => void;
  onCancel: () => void;
};

// Shown the first time the creator presses Record: what gets captured, where it goes, and that
// the system's default microphone is used.
export function RecordingConsentModal({ open, downloadMb, onAccept, onCancel }: Props) {
  return (
    <DefaultModal
      open={open}
      title={t('editor.recording.consent.title')}
      onClose={onCancel}
      body={t('editor.recording.consent.intro')}
      secondary={{ label: t('editor.recording.consent.cancel'), onClick: onCancel }}
      primary={{
        label: t('editor.recording.consent.accept'),
        onClick: onAccept,
        state: 'idle',
      }}
    >
      <ConsentList>
        <li>{t('editor.recording.consent.what')}</li>
        <li>{t('editor.recording.consent.local')}</li>
        {downloadMb > 0 && <li>{t('editor.recording.consent.download', { size: downloadMb })}</li>}
        <li>{t('editor.recording.consent.sent')}</li>
        <li>{t('editor.recording.consent.microphone')}</li>
      </ConsentList>
    </DefaultModal>
  );
}
