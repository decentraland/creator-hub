import { useCallback } from 'react';
import { Box, FormControlLabel, Switch, Typography } from 'decentraland-ui2';

import { RENDERER } from '/shared/types/settings';
import { t } from '/@/modules/store/translation/utils';
import { IS_NON_PRODUCTION_BUILD } from '/@/modules/buildMode';
import type { BaseTabProps } from '../../types';

import './styles.css';

const ExperimentalTab = ({ settings, updateSettings }: BaseTabProps) => {
  const handleRendererChange = useCallback(
    (bevy: boolean) => {
      updateSettings({ ...settings, renderer: bevy ? RENDERER.BEVY : RENDERER.BABYLON });
    },
    [settings, updateSettings],
  );

  const handleDevAssetCatalogChange = useCallback(
    (checked: boolean) => {
      updateSettings({ ...settings, useDevAssetCatalog: checked });
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
      {/* Dev/QA only: shown solely in non-production builds so unreleased smart items can be tested
          from the dev CDN. A production release never renders this. */}
      {IS_NON_PRODUCTION_BUILD && (
        <Box className="ExperimentalField">
          <FormControlLabel
            control={
              <Switch
                checked={!!settings.useDevAssetCatalog}
                onChange={(_event, checked) => handleDevAssetCatalogChange(checked)}
              />
            }
            label={t('modal.app_settings.fields.dev_asset_catalog.toggle')}
          />
          <Typography
            variant="body2"
            color="text.secondary"
            className="ExperimentalHint"
          >
            {t('modal.app_settings.fields.dev_asset_catalog.help')}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default ExperimentalTab;
