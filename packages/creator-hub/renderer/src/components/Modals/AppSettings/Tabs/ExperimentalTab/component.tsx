import { useCallback } from 'react';
import { Box, FormControlLabel, MenuItem, Select, Switch, Typography } from 'decentraland-ui2';

import { analytics } from '#preload';

import { RENDERER } from '/shared/types/settings';
import { t } from '/@/modules/store/translation/utils';
import type { BaseTabProps } from '../../types';

import './styles.css';

const ExperimentalTab = ({ settings, updateSettings }: BaseTabProps) => {
  const handleRendererChange = useCallback(
    (renderer: RENDERER) => {
      updateSettings({ ...settings, renderer });
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
    <Box className="FormContainer">
      <Box className="RendererSubField">
        <Typography variant="body1">{t('modal.app_settings.fields.renderer.label')}</Typography>
        <Select
          fullWidth
          value={settings.renderer}
          onChange={event => handleRendererChange(event.target.value as RENDERER)}
        >
          <MenuItem value={RENDERER.BABYLON}>
            {t('modal.app_settings.fields.renderer.babylon')}
          </MenuItem>
          <MenuItem value={RENDERER.BEVY}>{t('modal.app_settings.fields.renderer.bevy')}</MenuItem>
        </Select>
      </Box>
      <Box className="GuiEditorField">
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
