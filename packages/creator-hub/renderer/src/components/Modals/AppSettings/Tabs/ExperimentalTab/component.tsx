import { useCallback } from 'react';
import { Box, FormControlLabel, Switch } from 'decentraland-ui2';

import { RENDERER } from '/shared/types/settings';
import { t } from '/@/modules/store/translation/utils';
import type { BaseTabProps } from '../../types';

import './styles.css';

const ExperimentalTab = ({ settings, updateSettings }: BaseTabProps) => {
  const handleRendererChange = useCallback(
    (bevy: boolean) => {
      updateSettings({ ...settings, renderer: bevy ? RENDERER.BEVY : RENDERER.BABYLON });
    },
    [settings, updateSettings],
  );

  return (
    <Box className="FormContainer ExperimentalTab">
      <Box className="ExperimentalField">
        <FormControlLabel
          control={
            <Switch
              checked={settings.renderer === RENDERER.BEVY}
              onChange={(_event, checked) => handleRendererChange(checked)}
            />
          }
          label={t('modal.app_settings.fields.renderer.toggle')}
        />
      </Box>
    </Box>
  );
};

export default ExperimentalTab;
