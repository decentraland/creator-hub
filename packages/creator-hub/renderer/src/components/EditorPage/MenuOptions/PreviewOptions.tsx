import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import cx from 'classnames';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  Checkbox,
  Divider,
  FormControlLabel,
  FormGroup,
  ListItemButton,
  ListItemText,
  Radio,
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
  const [desktopOptionsOpen, setDesktopOptionsOpen] = useState(false);
  // The flyout normally opens to the right of the Desktop Client row (per design), but that
  // row sits in a popover already right-aligned to the toolbar's Preview button — near the
  // window's right edge in practice — so a fixed-right flyout gets clipped off-screen. Flip
  // it to the left whenever there isn't enough room on the right.
  const desktopRowRef = useRef<HTMLDivElement>(null);
  // null until measured for the current open — rendering nothing meanwhile (rather than a
  // default side) avoids a visible flash-then-flip when the flyout needs to go left.
  const [submenuAlign, setSubmenuAlign] = useState<'left' | 'right' | null>(null);

  // No Unity desktop client ships for Linux, so an optimized preview has no client to
  // open there — hide the toggle entirely. (abgen itself has Linux builds; the client
  // is the missing piece.)
  const platformSupportsOptimizedAssets = !navigator.userAgent.includes('Linux');
  // ...and the scene's installed sdk-commands must carry the --asset-bundles sidecar flag,
  // otherwise the toggle silently does nothing — so hide it entirely for unsupported scenes
  const [sceneSupportsOptimizedAssets, setSceneSupportsOptimizedAssets] = useState(false);
  const supportsOptimizedAssets = platformSupportsOptimizedAssets && sceneSupportsOptimizedAssets;
  const isDesktopClient = options.client === PREVIEW_CLIENT.DESKTOP;

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

  const handleClientSelect = useCallback(
    (client: PREVIEW_CLIENT) => () => {
      onChange({ ...options, client });
    },
    [onChange, options],
  );

  const handleDesktopRowMouseEnter = useCallback(() => {
    setDesktopOptionsOpen(true);
  }, []);

  const handleDesktopRowMouseLeave = useCallback(() => {
    setDesktopOptionsOpen(false);
  }, []);

  const showDesktopSubmenu = isDesktopClient && desktopOptionsOpen;

  useLayoutEffect(() => {
    if (!showDesktopSubmenu || !desktopRowRef.current) {
      // Reset so the next hover re-measures instead of briefly showing last time's side.
      setSubmenuAlign(null);
      return;
    }
    // Measured a frame late (rAF) on purpose: the outer Popper (popper.js) applies its own
    // position transform in its own effect, and ordering against that isn't guaranteed —
    // measuring in the same layout-effect pass can read the row's pre-positioned rect. The
    // flyout stays unrendered (submenuAlign is null) until this resolves, so there's nothing
    // to flash on the wrong side in the meantime.
    const raf = requestAnimationFrame(() => {
      if (!desktopRowRef.current) return;
      const SUBMENU_WIDTH_WITH_MARGIN = 308; // width: 300px + margin-left: 8px
      const { right } = desktopRowRef.current.getBoundingClientRect();
      const hasRoomOnRight = window.innerWidth - right >= SUBMENU_WIDTH_WITH_MARGIN;
      setSubmenuAlign(hasRoomOnRight ? 'right' : 'left');
    });
    return () => cancelAnimationFrame(raf);
  }, [showDesktopSubmenu]);

  return (
    <div className="PreviewOptions">
      <div className="options">
        <span className="title">{t('editor.header.actions.preview_options.menu_title')}</span>
        <div
          ref={desktopRowRef}
          className="client-row"
          onMouseEnter={handleDesktopRowMouseEnter}
          onMouseLeave={handleDesktopRowMouseLeave}
        >
          <FormControlLabel
            control={
              <Radio
                checked={isDesktopClient}
                onChange={handleClientSelect(PREVIEW_CLIENT.DESKTOP)}
              />
            }
            label={t('editor.header.actions.preview_options.client.desktop')}
          />
          <ChevronRightIcon
            className="arrow"
            aria-hidden="true"
          />
          {showDesktopSubmenu && submenuAlign && (
            <div className={cx('client-submenu', { 'align-left': submenuAlign === 'left' })}>
              <FormGroup className="options">
                <Tooltip
                  title={
                    terrainHiddenByScene
                      ? t(
                          'editor.header.actions.preview_options.landscape_terrain_disabled_by_scene',
                        )
                      : ''
                  }
                  placement="left"
                >
                  <div className="checkbox-row">
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
                  </div>
                </Tooltip>
                {supportsMultiInstance && (
                  <div className="checkbox-row">
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={!!options.multiInstance}
                          onChange={handleChange({ multiInstance: !options.multiInstance })}
                        />
                      }
                      label={t('editor.header.actions.preview_options.multi_instance')}
                    />
                  </div>
                )}
                {supportsMcp && (
                  <div className="checkbox-row">
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={!!options.mcp}
                          onChange={handleChange({ mcp: !options.mcp })}
                        />
                      }
                      label={t('editor.header.actions.preview_options.mcp')}
                    />
                  </div>
                )}
                {supportsOptimizedAssets && (
                  <Tooltip
                    title={t('editor.header.actions.preview_options.optimized_assets_tooltip')}
                    placement="left"
                  >
                    <div className="checkbox-row">
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={!!options.optimizedAssets}
                            onChange={handleChange({ optimizedAssets: !options.optimizedAssets })}
                          />
                        }
                        label={t('editor.header.actions.preview_options.optimized_assets')}
                      />
                    </div>
                  </Tooltip>
                )}
              </FormGroup>
            </div>
          )}
        </div>
        <div className="client-row">
          <FormControlLabel
            control={
              <Radio
                checked={!isDesktopClient}
                onChange={handleClientSelect(PREVIEW_CLIENT.BEVY_WEB)}
              />
            }
            label={t('editor.header.actions.preview_options.client.bevy_web')}
          />
        </div>
      </div>
      <Divider />
      <div className="options">
        <ListItemButton onClick={onShowMobileQR}>
          <ListItemText primary={t('editor.header.actions.preview_options.mobile_preview')} />
        </ListItemButton>
      </div>
    </div>
  );
}
