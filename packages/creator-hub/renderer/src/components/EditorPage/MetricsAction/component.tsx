import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import InsightsIcon from '@mui/icons-material/Insights';
import { Tooltip } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { useFeatureFlags } from '/@/hooks/useFeatureFlags';
import { isMetricsEnabled } from '/@/lib/metrics';
import type { Project } from '/shared/types/projects';
import { Button } from '../../Button';
import { resolveSceneMetricsTarget } from '../utils';

export function MetricsAction({ project }: { project?: Project }) {
  const navigate = useNavigate();
  const { flags } = useFeatureFlags();
  const target = useMemo(() => resolveSceneMetricsTarget(project), [project]);

  const handleClick = useCallback(() => {
    if (!target) return;
    navigate('/metrics', { state: { ...target, source: 'editor' } });
  }, [navigate, target]);

  if (!isMetricsEnabled(flags)) return null;

  const button = (
    <span>
      <Button
        color="secondary"
        onClick={handleClick}
        disabled={!target}
        startIcon={<InsightsIcon />}
      >
        {t('metrics.actions.analytics')}
      </Button>
    </span>
  );

  return target ? button : <Tooltip title={t('metrics.actions.editor_tooltip')}>{button}</Tooltip>;
}
