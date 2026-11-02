import React, { useCallback, useMemo } from 'react';
import { IoEyeOffOutline, IoEyeOutline } from 'react-icons/io5';
import cx from 'classnames';
import { validateAssetPath } from '@dcl/asset-packs';

import { useAssetOptions } from '../../../../hooks/useAssetOptions';
import { useAppDispatch } from '../../../../redux/hooks';
import { setMobileHudHighlight } from '../../../../redux/ui-designer';
import { FileUploadField, InfoTooltip } from '../../../ui';
import { ACCEPTED_FILE_TYPES } from '../../../ui/FileUploadField/types';
import { MobileHudIcon } from '../../shared/widget-icons';
import type { MobileAction, MobileHudConfig } from '../../MobileHud/mobile-hud-config';
import {
  allActionsHidden,
  MOBILE_ACTIONS,
  MOBILE_ACTION_LABELS,
  withAllActionsHidden,
} from '../../MobileHud/mobile-hud-config';
import { useMobileHudConfig, writeMobileHudConfig } from '../../MobileHud/mobile-hud-store';

import './MobileHudPanel.css';

const DOCS_URL =
  'https://docs.decentraland.org/creator/scenes-sdk7/interactivity/touch-screen-controls';

const ActionRow: React.FC<{
  action: MobileAction;
  config: MobileHudConfig;
  imageOptions: { label: string; value: string }[];
  onChange: (next: MobileHudConfig) => void;
}> = ({ action, config, imageOptions, onChange }) => {
  const dispatch = useAppDispatch();
  const button = config.buttons[action];
  const isMain = config.mainAction === action;

  const setMain = () => onChange({ ...config, mainAction: action });
  const setButton = (patch: Partial<(typeof config.buttons)[MobileAction]>) =>
    onChange({ ...config, buttons: { ...config.buttons, [action]: { ...button, ...patch } } });

  const commitIcon = (path: string) => {
    if (path === '') return setButton({ icon: undefined });
    if (validateAssetPath(path) !== null) return;
    setButton({ icon: path });
  };

  return (
    <div
      className="ui-designer-mobile-hud-action"
      data-action={action}
      data-main={isMain}
      onMouseEnter={() => dispatch(setMobileHudHighlight({ action }))}
      onMouseLeave={() => dispatch(setMobileHudHighlight({ action: null }))}
      onFocus={() => dispatch(setMobileHudHighlight({ action }))}
      onBlur={() => dispatch(setMobileHudHighlight({ action: null }))}
    >
      <div className="ui-designer-mobile-hud-action-head">
        <span className="ui-designer-mobile-hud-action-name">{MOBILE_ACTION_LABELS[action]}</span>
        <label className="ui-designer-mobile-hud-main">
          <input
            type="radio"
            name="mobile-hud-main"
            checked={isMain}
            aria-label={`Set ${action} as Main`}
            onChange={setMain}
          />
          Main
        </label>
        <button
          type="button"
          className={cx('ui-designer-mobile-hud-eye', { 'is-hidden': button.hide })}
          aria-label={button.hide ? `Show ${action}` : `Hide ${action}`}
          aria-pressed={button.hide}
          onClick={() => setButton({ hide: !button.hide })}
        >
          {button.hide ? <IoEyeOffOutline aria-hidden /> : <IoEyeOutline aria-hidden />}
        </button>
      </div>
      <FileUploadField
        label="Custom Icon"
        value={button.icon ?? ''}
        accept={ACCEPTED_FILE_TYPES.image}
        options={imageOptions}
        onDrop={commitIcon}
        onChange={e => commitIcon(e.target.value)}
      />
    </div>
  );
};

const GlobalToggle: React.FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <label className="ui-designer-mobile-hud-toggle">
    <input
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={e => onChange(e.target.checked)}
    />
    {label}
  </label>
);

/** Right-panel editor for the MobileHUD: global toggles + per-action Main/visibility/icon. */
const MobileHudPanel: React.FC = () => {
  const config = useMobileHudConfig();
  const assetOptions = useAssetOptions(ACCEPTED_FILE_TYPES.image);
  const imageOptions = useMemo(
    () => [{ label: 'None', value: '' }, ...assetOptions],
    [assetOptions],
  );

  const write = useCallback((next: MobileHudConfig) => void writeMobileHudConfig(next), []);

  return (
    <div className="ui-designer-mobile-hud-panel">
      <div className="ui-designer-mobile-hud-header">
        <MobileHudIcon />
        <span className="ui-designer-mobile-hud-title">MobileHUD</span>
        <InfoTooltip
          className="ui-designer-mobile-hud-info"
          type="help"
          position="bottom center"
          text={
            <>
              On the mobile client, players interact with your scene through a set of native
              on-screen controls. This component lets your scene reshape that HUD. Read more{' '}
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noreferrer"
                className="ui-designer-mobile-hud-help-link"
              >
                here
              </a>
              .
            </>
          }
        />
      </div>

      <div className="ui-designer-mobile-hud-toggles">
        <GlobalToggle
          label="Hide Joystick"
          checked={config.hideJoystick}
          onChange={v => write({ ...config, hideJoystick: v })}
        />
        <GlobalToggle
          label="Hide Crosshair"
          checked={config.hideCrosshair}
          onChange={v => write({ ...config, hideCrosshair: v })}
        />
        <GlobalToggle
          label="Hide Input Actions"
          checked={allActionsHidden(config)}
          onChange={v => write(withAllActionsHidden(config, v))}
        />
      </div>

      <div className="ui-designer-mobile-hud-section-title">Input Actions</div>
      <p className="ui-designer-mobile-hud-hint">Choose one action as Main.</p>
      <div className="ui-designer-mobile-hud-actions">
        {MOBILE_ACTIONS.map(action => (
          <ActionRow
            key={action}
            action={action}
            config={config}
            imageOptions={imageOptions}
            onChange={write}
          />
        ))}
      </div>
    </div>
  );
};

export default React.memo(MobileHudPanel);
export { MobileHudPanel };
