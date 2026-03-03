import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import cx from 'classnames';
import { IconButton, Typography, Button, Tooltip } from 'decentraland-ui2';

import logo from '/assets/images/logo-editor.png';
import iconScenes from '/assets/images/icon-scenes.svg';
import iconTemplates from '/assets/images/icon-templates.svg';
import iconLearn from '/assets/images/icon-learn.svg';
import iconResources from '/assets/images/icon-resources.svg';
import iconSettings from '/assets/images/icon-settings.svg';
import dclLogo from '/assets/images/dcl-logo.svg';
import iconCollapse from '/assets/images/icon-collapse.svg';
import iconDownloadUpdate from '/assets/images/icon-download-update.svg';
import iconClose from '/assets/images/icon-close.svg';
import { t } from '/@/modules/store/translation/utils';
import type { TranslationPath } from '/@/modules/store/translation/types';
import { useEditor } from '/@/hooks/useEditor';
import { actions, installUpdate } from '/@/modules/store/settings';
import { actions as workspaceActions } from '/@/modules/store/workspace';
import { useDispatch, useSelector } from '#store';
import type { AppState } from '#store';

import './styles.css';

export type SidebarItem = 'scenes' | 'templates' | 'learn' | 'resources' | 'settings';

const NAV_ITEMS: { id: SidebarItem; iconSrc: string; path: string; translationKey: string }[] = [
  { id: 'scenes', iconSrc: iconScenes, path: '/scenes', translationKey: 'navbar.menu.scenes' },
  {
    id: 'templates',
    iconSrc: iconTemplates,
    path: '/templates',
    translationKey: 'navbar.menu.templates',
  },
  { id: 'learn', iconSrc: iconLearn, path: '/learn', translationKey: 'navbar.menu.learn' },
  {
    id: 'resources',
    iconSrc: iconResources,
    path: '/more',
    translationKey: 'navbar.menu.resources',
  },
];

const AUTO_COLLAPSE_WIDTH = 850;

function getActiveItem(pathname: string): SidebarItem | null {
  if (pathname === '/' || pathname.startsWith('/scenes')) return 'scenes';
  if (pathname.startsWith('/templates')) return 'templates';
  if (pathname.startsWith('/learn')) return 'learn';
  if (pathname.startsWith('/more') || pathname.startsWith('/resources')) return 'resources';
  if (pathname.startsWith('/settings')) return 'settings';
  return null;
}

export function Sidebar() {
  const location = useLocation();
  const activeItem = getActiveItem(location.pathname);
  const { version } = useEditor();
  const dispatch = useDispatch();
  const [collapsed, setCollapsed] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [demoUpdateShown, setDemoUpdateShown] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('demo') === 'update',
  );
  const [demoDependencyShown, setDemoDependencyShown] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('demo') === 'dependency',
  );
  const [previewAppUpdate, setPreviewAppUpdate] = useState(false);
  const [previewDependency, setPreviewDependency] = useState(false);

  const isDev = import.meta.env.DEV;
  const downloadingUpdate = useSelector((state: AppState) => state.settings.downloadingUpdate);
  const updateInfo = useSelector((state: AppState) => state.settings.updateInfo);
  const dependencyUpdateProject = useSelector(
    (state: AppState) => state.workspace.dependencyUpdateProject,
  );

  const hasUpdate = updateInfo.available || !!downloadingUpdate.version;
  const isDemoUpdate =
    (typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('demo') === 'update') ||
    (isDev && previewAppUpdate);
  const isDemoDependency =
    (typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('demo') === 'dependency') ||
    (isDev && previewDependency);

  const showUpdateCard =
    !collapsed && !updateDismissed && (hasUpdate || (isDemoUpdate && demoUpdateShown));
  const showDependencyUpdateCard =
    !collapsed && (!!dependencyUpdateProject || (isDemoDependency && demoDependencyShown));

  const updateVersion =
    downloadingUpdate.version ||
    updateInfo.version ||
    (showUpdateCard && isDemoUpdate ? '1.2.0' : '');

  useEffect(() => {
    const handleResize = () => {
      if (manualOverride) return;
      const shouldCollapse = window.innerWidth < AUTO_COLLAPSE_WIDTH;
      setCollapsed(shouldCollapse);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [manualOverride]);

  const handleToggleCollapse = useCallback(() => {
    setManualOverride(true);
    setCollapsed(prev => !prev);
  }, []);

  const handleClickSettings = useCallback(() => {
    dispatch(actions.setOpenAppSettingsModal(true));
  }, []);

  const handleDismissUpdate = useCallback(() => {
    if (isDemoUpdate) {
      setDemoUpdateShown(false);
      setPreviewAppUpdate(false);
    } else setUpdateDismissed(true);
  }, [isDemoUpdate]);

  const handleInstallUpdate = useCallback(() => {
    if (isDemoUpdate) {
      setDemoUpdateShown(false);
      setPreviewAppUpdate(false);
    } else dispatch(installUpdate());
  }, [dispatch, isDemoUpdate]);

  const handleDismissDependencyUpdate = useCallback(() => {
    if (isDemoDependency) {
      setDemoDependencyShown(false);
      setPreviewDependency(false);
    } else dispatch(workspaceActions.clearDependencyUpdateProject());
  }, [dispatch, isDemoDependency]);

  const handlePreviewAppUpdate = useCallback(() => {
    setPreviewAppUpdate(true);
    setDemoUpdateShown(true);
  }, []);

  const handlePreviewDependency = useCallback(() => {
    setPreviewDependency(true);
    setDemoDependencyShown(true);
  }, []);

  const handleUpdateDependencies = useCallback(() => {
    if (dependencyUpdateProject) {
      dispatch(workspaceActions.updatePackages(dependencyUpdateProject));
    }
  }, [dispatch, dependencyUpdateProject]);

  return (
    <aside className={cx('Sidebar', { collapsed })}>
      <div className="SidebarHeader">
        <img
          className="SidebarLogo"
          src={logo}
          alt="Creator Hub"
        />
        {!collapsed && (
          <Typography
            className="SidebarTitle"
            variant="subtitle1"
          >
            Creator Hub
          </Typography>
        )}
      </div>

      <div className="SidebarScrollable">
        <nav className="SidebarNav">
          {NAV_ITEMS.map(item => {
            const link = (
              <Link
                to={item.path}
                className={cx('SidebarNavItem', { active: activeItem === item.id })}
              >
                <span className="SidebarNavIcon">
                  <img
                    src={item.iconSrc}
                    alt=""
                  />
                </span>
                {!collapsed && (
                  <span className="SidebarNavLabel">
                    {t(item.translationKey as TranslationPath)}
                  </span>
                )}
              </Link>
            );
            return collapsed ? (
              <Tooltip
                key={item.id}
                title={t(item.translationKey as TranslationPath)}
                placement="right"
                arrow
              >
                <span className="SidebarNavItemWrapper">{link}</span>
              </Tooltip>
            ) : (
              <span
                key={item.id}
                className="SidebarNavItemWrapper"
              >
                {link}
              </span>
            );
          })}
        </nav>
      </div>

      <div className="SidebarFooter">
        {isDev && !collapsed && (
          <div className="SidebarDemoPreview">
            <span className="SidebarDemoPreviewLabel">Preview:</span>
            <button
              type="button"
              className="SidebarDemoPreviewBtn"
              onClick={handlePreviewAppUpdate}
            >
              App update
            </button>
            <button
              type="button"
              className="SidebarDemoPreviewBtn"
              onClick={handlePreviewDependency}
            >
              Dependencies
            </button>
          </div>
        )}
        {showDependencyUpdateCard &&
          (dependencyUpdateProject || (isDemoDependency && demoDependencyShown)) && (
            <div className="SidebarUpdateCard SidebarUpdateCard--dependency">
              <div className="SidebarUpdateHeader">
                <img
                  className="SidebarUpdateIcon"
                  src={iconDownloadUpdate}
                  alt=""
                />
                <button
                  className="SidebarUpdateClose"
                  onClick={handleDismissDependencyUpdate}
                >
                  <img
                    src={iconClose}
                    alt=""
                  />
                </button>
              </div>
              <Typography
                className="SidebarUpdateTitle"
                variant="subtitle2"
              >
                {t('snackbar.new_dependency_version.title')}
              </Typography>
              <Typography
                className="SidebarUpdateDesc"
                variant="body2"
              >
                {t('sidebar.dependency_update.description')}
              </Typography>
              <Button
                className="SidebarUpdateBtn"
                variant="contained"
                size="small"
                fullWidth
                onClick={
                  isDemoDependency ? handleDismissDependencyUpdate : handleUpdateDependencies
                }
              >
                {t('snackbar.new_dependency_version.actions.update')}
              </Button>
            </div>
          )}
        {showUpdateCard && (
          <div className="SidebarUpdateCard">
            <div className="SidebarUpdateHeader">
              <img
                className="SidebarUpdateIcon"
                src={iconDownloadUpdate}
                alt=""
              />
              <button
                className="SidebarUpdateClose"
                onClick={handleDismissUpdate}
              >
                <img
                  src={iconClose}
                  alt=""
                />
              </button>
            </div>
            <Typography
              className="SidebarUpdateTitle"
              variant="subtitle2"
            >
              {t('sidebar.update.title')}
            </Typography>
            <Typography
              className="SidebarUpdateDesc"
              variant="body2"
            >
              {t('sidebar.update.description', { version: updateVersion })}
            </Typography>
            <Button
              className="SidebarUpdateBtn"
              variant="contained"
              size="small"
              fullWidth
              onClick={handleInstallUpdate}
            >
              {t('sidebar.update.action')}
            </Button>
          </div>
        )}

        <div className="SidebarFooterDivider">
          {collapsed ? (
            <Tooltip
              title={t('navbar.menu.settings')}
              placement="right"
              arrow
            >
              <span className="SidebarNavItemWrapper">
                <button
                  className={cx('SidebarNavItem', { active: activeItem === 'settings' })}
                  onClick={handleClickSettings}
                >
                  <span className="SidebarNavIcon">
                    <img
                      src={iconSettings}
                      alt=""
                    />
                  </span>
                  {!collapsed && (
                    <span className="SidebarNavLabel">{t('navbar.menu.settings')}</span>
                  )}
                </button>
              </span>
            </Tooltip>
          ) : (
            <button
              className={cx('SidebarNavItem', { active: activeItem === 'settings' })}
              onClick={handleClickSettings}
            >
              <span className="SidebarNavIcon">
                <img
                  src={iconSettings}
                  alt=""
                />
              </span>
              <span className="SidebarNavLabel">{t('navbar.menu.settings')}</span>
            </button>
          )}
        </div>

        <div className="SidebarBrand">
          {!collapsed && (
            <img
              className="SidebarDclLogo"
              src={dclLogo}
              alt="Decentraland"
            />
          )}
          <button
            className={cx('SidebarCollapseBtn', { collapsed })}
            onClick={handleToggleCollapse}
          >
            <img
              src={iconCollapse}
              alt=""
            />
          </button>
        </div>
      </div>
    </aside>
  );
}
