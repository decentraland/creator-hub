import { useEffect, useState } from 'react';
import { CircularProgress, Tooltip } from 'decentraland-ui2';

import type { RecorderStatus } from '/shared/types/ai';
import type { RecordingToolsStatus } from '/shared/types/recording';

import { t } from '/@/modules/store/translation/utils';
import { Dot, Label, RecordControl } from './RecordButton.styled';

function elapsed(startedAt: number | null, now: number): string {
  const seconds = startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function busyLabel(status: RecorderStatus, tools: RecordingToolsStatus | null): string {
  if (status === 'starting') return t('editor.recording.starting');
  if (tools?.state === 'installing' && tools.percent !== undefined) {
    return t('editor.recording.downloading', { percent: tools.percent });
  }
  return t('editor.recording.transcribing');
}

type Props = {
  status: RecorderStatus;
  startedAt: number | null;
  micLabel: string;
  tools: RecordingToolsStatus | null;
  onClick: () => void;
  // The assistant panel's version: a full-width bar with a longer idle label.
  fullWidth?: boolean;
  disabled?: boolean;
};

export function RecordButton({
  status,
  startedAt,
  micLabel,
  tools,
  onClick,
  fullWidth = false,
  disabled = false,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const live = status === 'recording';

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [live]);

  const busy = status === 'starting' || status === 'stopping';
  const tooltip = live
    ? t('editor.recording.tooltip_live', {
        mic: micLabel || t('editor.recording.default_mic'),
      })
    : t('editor.recording.tooltip_idle');

  return (
    <Tooltip title={tooltip}>
      <span>
        <RecordControl
          type="button"
          live={live}
          full={fullWidth}
          disabled={busy || (disabled && !live)}
          onClick={onClick}
          aria-pressed={live}
          aria-label={live ? t('editor.recording.stop') : t('editor.recording.record')}
          data-testid="editor-record-button"
          data-recording-ignore
        >
          {busy ? (
            <CircularProgress
              size={14}
              color="inherit"
            />
          ) : (
            <Dot live={live} />
          )}
          <Label>
            {busy
              ? busyLabel(status, tools)
              : live
                ? t('editor.recording.stop_with_time', { time: elapsed(startedAt, now) })
                : fullWidth
                  ? t('editor.recording.record_panel')
                  : t('editor.recording.record')}
          </Label>
        </RecordControl>
      </span>
    </Tooltip>
  );
}
