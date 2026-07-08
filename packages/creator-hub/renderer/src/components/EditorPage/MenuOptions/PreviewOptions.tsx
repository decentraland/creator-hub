import { useCallback, useEffect, useState } from 'react';
import {
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  ListItemButton,
  ListItemText,
  Radio,
  RadioGroup,
  Tooltip,
} from 'decentraland-ui2';

import { scene } from '#preload';

import { PREVIEW_CLIENT } from '/shared/types/settings';
import { t } from '/@/modules/store/translation/utils';

import type { PreviewOptionsProps } from './types';

export function PreviewOptions({
  onChange,
  options,
  onShowMobileQR,
  supportsMultiInstance,
  projectPath,
}: PreviewOptionsProps) {
  const [terrainHiddenByScene, setTerrainHiddenByScene] = useState(false);

  useEffect(() => {
    let cancelled = false;
    scene
      .getScene(projectPath)
      .then(sceneJson => {
        if (!cancelled) {
          setTerrainHiddenByScene(
            (sceneJson as { landscapeTerrain?: boolean }).landscapeTerrain === false,
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectPath]);

  const handleChange = useCallback(
    (newOptions: Partial<PreviewOptionsProps['options']>) => () => {
      onChange({ ...options, ...newOptions });
    },
    [onChange, options],
  );

  const handleClientChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...options, client: event.target.value as PREVIEW_CLIENT });
    },
    [onChange, options],
  );

  return (
    <div className="PreviewOptions">
      <span className="title">{t('editor.header.actions.preview_options.title')}</span>
      <FormControl>
        <FormLabel>{t('editor.header.actions.preview_options.client.label')}</FormLabel>
        <RadioGroup
          value={options.client}
          onChange={handleClientChange}
        >
          <FormControlLabel
            value={PREVIEW_CLIENT.DESKTOP}
            control={<Radio />}
            label={t('editor.header.actions.preview_options.client.desktop')}
          />
          <FormControlLabel
            value={PREVIEW_CLIENT.BEVY_WEB}
            control={<Radio />}
            label={t('editor.header.actions.preview_options.client.bevy_web')}
          />
        </RadioGroup>
      </FormControl>
      <Divider />
      <FormGroup>
        <FormControlLabel
          control={
            <Checkbox
              checked={!!options.debugger}
              onChange={handleChange({ debugger: !options.debugger })}
            />
          }
          label={t('editor.header.actions.preview_options.debugger')}
        />
        <Tooltip
          title={
            terrainHiddenByScene
              ? t('editor.header.actions.preview_options.landscape_terrain_disabled_by_scene')
              : ''
          }
          placement="left"
        >
          <FormControlLabel
            control={
              <Checkbox
                checked={terrainHiddenByScene ? false : !!options.enableLandscapeTerrains}
                disabled={terrainHiddenByScene}
                onChange={handleChange({
                  enableLandscapeTerrains: !options.enableLandscapeTerrains,
                })}
              />
            }
            label={t('editor.header.actions.preview_options.landscape_terrain_enabled')}
          />
        </Tooltip>
        {supportsMultiInstance && (
          <FormControlLabel
            control={
              <Checkbox
                checked={!!options.multiInstance}
                onChange={handleChange({ multiInstance: !options.multiInstance })}
              />
            }
            label={t('editor.header.actions.preview_options.multi_instance')}
          />
        )}
      </FormGroup>
      <Divider />
      <ListItemButton onClick={onShowMobileQR}>
        <ListItemText primary={t('editor.header.actions.preview_options.mobile_preview')} />
      </ListItemButton>
    </div>
  );
}
