import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Button } from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';

import { EmptyState, HeaderTitle, Panel, PanelHeader } from './component.styled';

// Shown in the editor in place of the inline panel while the chat is popped out into its
// own window (#1504) — tells the user where the chat went and offers to dock it back.
export function DetachedPlaceholder({ onDock, width }: { onDock: () => void; width: number }) {
  return (
    <Panel
      panelWidth={width}
      aria-label="ai-chat-detached"
    >
      <PanelHeader>
        <HeaderTitle>{t('editor.ai.title')}</HeaderTitle>
      </PanelHeader>
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
