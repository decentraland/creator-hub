import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Button } from 'decentraland-ui2';

import { useSelector } from '#store';
import { t } from '/@/modules/store/translation/utils';

import { RecordButton } from '../SessionRecorder';
import { EmptyState, HeaderTitle, Panel, PanelHeader, RecordRow } from './component.styled';

// Shown in the editor in place of the inline panel while the chat is popped out into its
// own window (#1504) — tells the user where the chat went and offers to dock it back.
export function DetachedPlaceholder({
  onDock,
  width,
  onToggleRecording,
}: {
  onDock: () => void;
  width: number;
  onToggleRecording: () => void;
}) {
  const recorder = useSelector(state => state.ai.recorder);
  return (
    <Panel
      panelWidth={width}
      aria-label="ai-chat-detached"
    >
      <PanelHeader>
        <HeaderTitle>{t('editor.ai.title')}</HeaderTitle>
      </PanelHeader>
      {/* The recording is of this window, so its button stays here too, not only in the
          popped-out chat. */}
      <RecordRow>
        <RecordButton
          fullWidth
          status={recorder.status}
          startedAt={recorder.startedAt}
          micLabel={recorder.micLabel}
          tools={recorder.tools}
          onClick={onToggleRecording}
        />
      </RecordRow>
      <EmptyState>
        <div>{t('editor.ai.detached_message')}</div>
        <div>
          <Button
            color="secondary"
            size="small"
            startIcon={<OpenInNewIcon fontSize="small" />}
            onClick={onDock}
          >
            {t('editor.ai.detached_dock')}
          </Button>
        </div>
      </EmptyState>
    </Panel>
  );
}
