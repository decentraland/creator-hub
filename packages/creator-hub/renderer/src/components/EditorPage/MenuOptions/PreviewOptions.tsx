import { useCallback, useEffect, useState } from 'react';
import {
  Checkbox,
  Divider,
  FormControlLabel,
  FormGroup,
  ListItemButton,
  ListItemText,
  Tooltip,
} from 'decentraland-ui2';

import { scene } from '#preload';

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

  return (
    <div className="PreviewOptions">
      <span className="title">{t('editor.header.actions.preview_options.title')}</span>
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
