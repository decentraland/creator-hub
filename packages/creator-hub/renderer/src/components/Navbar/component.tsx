import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import cx from 'classnames';
import { Box } from 'decentraland-ui2';
import { useDispatch, useSelector } from '#store';
import { useFeatureFlags } from '/@/hooks/useFeatureFlags';
import { FeatureFlag } from '/@/modules/store/featureFlags';
import type { AppState } from '#store';
import { useEditor } from '/@/hooks/useEditor';
import { t } from '/@/modules/store/translation/utils';
import { actions } from '/@/modules/store/settings';
import { AppSettings, SettingsTab } from '../Modals/AppSettings';
import { About } from '../Modals/About';
import { CreateButton } from '../CreateButton';
import { Header } from '../Header';
import { LogoMenu } from './LogoMenu';
import './styles.css';

export enum NavbarItem {
  HOME = 'home',
  SCENES = 'scenes',
  COLLECTIONS = 'collections',
  ANALYTICS = 'analytics',
  LEARN = 'learn',
  MANAGE = 'manage',
  MORE = 'more',
}

function MenuItem(props: { item: NavbarItem; active: NavbarItem; disable?: boolean }) {
  return !props.disable ? (
    <Link
      to={`/${props.item}`}
      className={cx('menu-item', { active: props.active === props.item })}
    >
      {t(`navbar.menu.${props.item}`)}
    </Link>
  ) : null;
}

export function Navbar(props: { active: NavbarItem }) {
  const openAppSettings = useSelector((state: AppState) => state.settings.openAppSettingsModal);
  const { isEnabled } = useFeatureFlags();
  const dispatch = useDispatch();
  const { version } = useEditor();
  const [openAbout, setOpenAbout] = useState(false);
  const [settingsTab, setSettingsTab] = useState(SettingsTab.SCENES);
  const [autoCheckForUpdates, setAutoCheckForUpdates] = useState(false);

  const handleOpenAbout = useCallback(() => setOpenAbout(true), []);
  const handleCloseAbout = useCallback(() => setOpenAbout(false), []);

  const handleOpenSettings = useCallback(() => {
    setSettingsTab(SettingsTab.SCENES);
    setAutoCheckForUpdates(false);
    dispatch(actions.setOpenAppSettingsModal(true));
  }, [dispatch]);

  // "Check for Updates" has no surface of its own — it opens App Settings on the
  // About tab and kicks off the check there.
  const handleCheckForUpdates = useCallback(() => {
    setSettingsTab(SettingsTab.ABOUT);
    setAutoCheckForUpdates(true);
    dispatch(actions.setOpenAppSettingsModal(true));
  }, [dispatch]);

  const handleCloseSettings = useCallback(() => {
    setAutoCheckForUpdates(false);
    dispatch(actions.setOpenAppSettingsModal(false));
  }, [dispatch]);

  return (
    <Header classNames={cx('Navbar')}>
      <>
        <div className="logo">
          <LogoMenu
            onClickAbout={handleOpenAbout}
            onClickSettings={handleOpenSettings}
            onClickCheckForUpdates={handleCheckForUpdates}
          />
        </div>
        <div className="menu">
          <MenuItem
            item={NavbarItem.HOME}
            active={props.active}
          />
          <MenuItem
            item={NavbarItem.SCENES}
            active={props.active}
          />
          {/* This page will be added in a future shape */}
          <MenuItem
            item={NavbarItem.COLLECTIONS}
            active={props.active}
            disable={true}
          />
          {/* The only way into Analytics: the router is in-memory, so hiding
              this entry hides the section. */}
          <MenuItem
            item={NavbarItem.ANALYTICS}
            active={props.active}
            disable={!isEnabled(FeatureFlag.ANALYTICS)}
          />
          <MenuItem
            item={NavbarItem.MANAGE}
            active={props.active}
          />
          <MenuItem
            item={NavbarItem.LEARN}
            active={props.active}
          />
          <MenuItem
            item={NavbarItem.MORE}
            active={props.active}
          />
        </div>
      </>
      <>
        <Box className="actions">
          <CreateButton />
        </Box>
        <AppSettings
          open={openAppSettings}
          initialTab={settingsTab}
          autoCheckForUpdates={autoCheckForUpdates}
          onClose={handleCloseSettings}
        />
        <About
          open={openAbout}
          version={version}
          onClose={handleCloseAbout}
        />
      </>
    </Header>
  );
}
