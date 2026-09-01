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

import { editor, scene } from '#preload';

import { PREVIEW_CLIENT } from '/shared/types/settings';
import { t } from '/@/modules/store/translation/utils';

import type { PreviewOptionsProps } from './types';

export function PreviewOptions({
  onChange,
  options,
  onShowMobileQR,
  supportsMultiInstance,
  supportsMcp,
  projectPath,
}: PreviewOptionsProps) {
  const [terrainHiddenByScene, setTerrainHiddenByScene] = useState(false);

  // No Unity desktop client ships for Linux, so an optimized preview has no client to
  // open there — hide the toggle entirely. (abgen itself has Linux builds; the client
  // is the missing piece.)
  const platformSupportsOptimizedAssets = !navigator.userAgent.includes('Linux');
  // ...and the scene's installed sdk-commands must carry the --asset-bundles sidecar flag,
  // otherwise the toggle silently does nothing — so hide it entirely for unsupported scenes
  const [sceneSupportsOptimizedAssets, setSceneSupportsOptimizedAssets] = useState(false);
  const supportsOptimizedAssets = platformSupportsOptimizedAssets && sceneSupportsOptimizedAssets;
  // The asset-bundle sidecar rides the Unity deep-link (local-ab param); the Bevy web
  // client has no deep-link, so an optimized preview can't apply there.
  const isBevyWebClient = options.client === PREVIEW_CLIENT.BEVY_WEB;

  useEffect(() => {
    if (!platformSupportsOptimizedAssets) {
      setSceneSupportsOptimizedAssets(false);
      return;
    }
    let cancelled = false;
    editor
      .supportsAssetBundles(projectPath)
      .then(supported => {
        if (!cancelled) setSceneSupportsOptimizedAssets(supported);
      })
      .catch(() => {
        if (!cancelled) setSceneSupportsOptimizedAssets(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectPath, platformSupportsOptimizedAssets]);

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
        {supportsMcp && (
          <FormControlLabel
            control={
              <Checkbox
                checked={!!options.mcp}
                onChange={handleChange({ mcp: !options.mcp })}
              />
            }
            label={t('editor.header.actions.preview_options.mcp')}
          />
        )}
        {supportsOptimizedAssets && !isBevyWebClient && (
          <Tooltip
            title={t('editor.header.actions.preview_options.optimized_assets_tooltip')}
            placement="left"
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={!!options.optimizedAssets}
                  onChange={handleChange({ optimizedAssets: !options.optimizedAssets })}
                />
              }
              label={t('editor.header.actions.preview_options.optimized_assets')}
            />
          </Tooltip>
        )}
      </FormGroup>
      <Divider />
      <ListItemButton onClick={onShowMobileQR}>
        <ListItemText primary={t('editor.header.actions.preview_options.mobile_preview')} />
      </ListItemButton>
    </div>
  );
}
