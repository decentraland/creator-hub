import { useCallback } from 'react';
import { Box, FormControlLabel, Switch, Typography } from 'decentraland-ui2';

import { analytics } from '#preload';

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

  const handleGuiEditorChange = useCallback(
    (checked: boolean) => {
      updateSettings({ ...settings, guiEditor: checked });
      void analytics.track('Toggle UI Editor', { enabled: checked });
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

      <Box className="ExperimentalField">
        <FormControlLabel
          control={
            <Switch
              checked={!!settings.guiEditor}
              onChange={(_event, checked) => handleGuiEditorChange(checked)}
            />
          }
          label={t('modal.app_settings.fields.gui_editor.toggle')}
        />
        <Typography
          variant="body2"
          color="text.secondary"
          className="ExperimentalHint"
        >
          {t('modal.app_settings.fields.gui_editor.hint')}
        </Typography>
      </Box>
    </Box>
  );
};

export default ExperimentalTab;
