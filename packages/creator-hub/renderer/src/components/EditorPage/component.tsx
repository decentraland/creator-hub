import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { useNavigate } from 'react-router-dom';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import CodeIcon from '@mui/icons-material/Code';
import GridViewIcon from '@mui/icons-material/GridView';
import PublicIcon from '@mui/icons-material/Public';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import SettingsIcon from '@mui/icons-material/Settings';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { CircularProgress as Loader, IconButton, Menu, MenuItem, Tooltip } from 'decentraland-ui2';
import Popover from '@mui/material/Popover';
import type { SceneMetricsData } from '/@/modules/rpc/scene-metrics';

import { isClientNotInstalledError } from '/shared/types/client';
import { isProjectError } from '/shared/types/projects';
import { isWorkspaceError } from '/shared/types/workspace';

import { t } from '/@/modules/store/translation/utils';
import { initRpc } from '/@/modules/rpc';
import { config } from '/@/config';
import { useEditor } from '/@/hooks/useEditor';
import { useSettings } from '/@/hooks/useSettings';
import { useSceneCustomCode } from '/@/hooks/useSceneCustomCode';
import { useDeploy } from '/@/hooks/useDeploy';
import { useConnectionStatus } from '/@/hooks/useConnectionStatus';
import { useDebugLogForwarding } from '/@/hooks/useDebugLogForwarding';
import { ConnectionStatus } from '/@/lib/connection';

import EditorPng from '/assets/images/editor.png';
import FallbackThumbnail from '/assets/images/scene-thumbnail-fallback.png';

import { addBase64ImagePrefix } from '/@/modules/image';

import cx from 'classnames';
import { useDispatch, useSelector } from '#store';
import { useFeatureFlags } from '/@/hooks/useFeatureFlags';
import { actions as snackbarActions } from '/@/modules/store/snackbar';
import { createGenericNotification } from '/@/modules/store/snackbar/utils';
import { Button } from '../Button';
import { Header } from '../Header';
import { Row } from '../Row';
import { ButtonGroup } from '../Button';
import { ConnectionStatusIndicator } from '../ConnectionStatusIndicator';
import { MobileQRCode } from '../Modals/MobileQRCode';
import { DeployModal } from './DeployModal';
import { PreviewOptions, PublishOptions } from './MenuOptions';
import { getPublishButtonText, getPublishOptions } from './utils';

import type { ModalType, ModalState } from './DeployModal';
import type { PreviewOptionsProps } from './MenuOptions';

import './styles.css';

export function EditorPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    error,
    project,
    refreshProject,
    saveAndGetThumbnail,
    inspectorPort,
    openPreview,
    openCode,
    updateScene,
    loadingPreview,
    loadingPublish,
    isInstallingProject,
    killPreview,
    publishScene,
    getMobileQR,
    supportsMultiInstance,
    isPreviewRunning,
  } = useEditor();
  const { settings, updateAppSettings } = useSettings();
  const { flags: featureFlags } = useFeatureFlags();
  const viewportToolbar = settings.viewportToolbar ?? true;
  const inspectorFlags = useMemo(
    () => ({ ...featureFlags, viewportToolbar }),
    [featureFlags, viewportToolbar],
  );
  const { executeDeployment, getDeployment } = useDeploy();
  const deployment = project ? getDeployment(project.path) : undefined;

  const isDeploying = loadingPublish || deployment?.status === 'pending';

  const publishButtonText = useMemo(
    () => getPublishButtonText({ loadingPublish, deployment }),
    [loadingPublish, deployment],
  );

  const userId = useSelector(state => state.analytics.userId);
  const { detectCustomCode, isLoading: isDetectingCustomCode } = useSceneCustomCode(project);
  const { status } = useConnectionStatus();
  const iframeRef = useRef<ReturnType<typeof initRpc>>();
  const [modalState, setModalState] = useState<ModalState>({ type: undefined });
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [metricsAnchor, setMetricsAnchor] = useState<null | HTMLElement>(null);
  const [metricsData, setMetricsData] = useState<SceneMetricsData | null>(null);
  const [mobileQRData, setMobileQRData] = useState<{ url: string; qr: string } | null>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const metricsCardRef = useRef<HTMLDivElement>(null);
  const [titleSmall, setTitleSmall] = useState(false);
  const parcelCount = project ? project.layout.rows * project.layout.cols : 0;
  const hasMetricsWarning =
    metricsData !== null &&
    (metricsData.entitiesOutOfBoundaries.length > 0 ||
      (Object.keys(metricsData.metrics) as (keyof typeof metricsData.metrics)[]).some(
        key => metricsData.metrics[key] > metricsData.limits[key],
      ));

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    setTitleSmall(false);
    requestAnimationFrame(() => {
      if (el.scrollWidth > el.clientWidth) {
        setTitleSmall(true);
      }
    });
  }, [project?.title]);

  const isOffline = status === ConnectionStatus.OFFLINE;
  const showDebugPanel = settings.previewOptions.debugger;

  useDebugLogForwarding(iframeRef, isPreviewRunning, showDebugPanel, project?.path);

  const handleIframeRef = useCallback(
    (e: React.SyntheticEvent<HTMLIFrameElement, Event>) => {
      const iframe = e.currentTarget;
      if (project) {
        const rpc = initRpc(iframe, project, { writeFile: updateScene });
        iframeRef.current = rpc;
        void rpc.scene.setFeatureFlags(inspectorFlags).catch(console.error);
      }
    },
    [project, updateScene, inspectorFlags],
  );

  useEffect(() => {
    const rpc = iframeRef.current;
    if (rpc) {
      void rpc.scene.setFeatureFlags(inspectorFlags).catch(console.error);
    }
  }, [inspectorFlags]);

  useEffect(() => {
    if (isWorkspaceError(error, 'PROJECT_NOT_FOUND') || isProjectError(error)) {
      navigate('/scenes');
    }

    return () => {
      const rpc = iframeRef.current;
      if (rpc) {
        rpc.dispose();
        iframeRef.current = undefined;
      }
    };
  }, [error]);

  const isReady = !!project && inspectorPort > 0;

  const openModal = useCallback((type: ModalType, initialStep?: ModalState['initialStep']) => {
    setModalState({ type, initialStep });
  }, []);

  const handleOpenPreviewWithErrorHandling = useCallback(async () => {
    try {
      await openPreview(settings.previewOptions);
    } catch (error: any) {
      if (isClientNotInstalledError(error)) {
        setModalState({ type: 'install-client' });
      }
    }
  }, [openPreview, settings.previewOptions]);

  const handleActionWithWarningCheck = useCallback(
    async (action: () => void | Promise<void>) => {
      if (!settings.previewOptions.showWarnings) {
        await action();
        return;
      }

      const hasCustomCode = await detectCustomCode();

      if (hasCustomCode) {
        setModalState({
          type: 'warning',
          onContinue: action,
        });
        return;
      }

      await action();
    },
    [settings.previewOptions.showWarnings, detectCustomCode],
  );

  const handleBack = useCallback(async () => {
    const rpc = iframeRef.current;
    if (rpc) await refreshProject(rpc);
    killPreview();
    navigate('/scenes');
  }, [navigate, iframeRef.current]);

  const handleUndo = useCallback(() => {
    iframeRef.current?.scene.undo().catch(console.error);
  }, []);

  const handleRedo = useCallback(() => {
    iframeRef.current?.scene.redo().catch(console.error);
  }, []);

  const handleEditScene = useCallback(() => {
    iframeRef.current?.scene.editScene().catch(console.error);
  }, []);

  const handleToggleMetrics = useCallback(() => {
    if (metricsAnchor) {
      setMetricsAnchor(null);
      return;
    }
    iframeRef.current?.metricsClient
      .fetchAll()
      .then(data => {
        setMetricsData(data);
        setMetricsAnchor(metricsCardRef.current);
      })
      .catch(console.error);
  }, [metricsAnchor]);

  const handleCleanUnusedAssets = useCallback(() => {
    // TODO: implement via RPC once the method is available
  }, []);

  const handleOpenMenu = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    setMenuAnchor(e.currentTarget);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  const handleToggleSceneInfo = useCallback(() => {
    iframeRef.current?.scene.toggleSceneInfo().catch(console.error);
    setMenuAnchor(null);
  }, []);

  const handleOpenPublishModal = useCallback(async () => {
    await handleActionWithWarningCheck(() => openModal('publish'));
  }, [handleActionWithWarningCheck, openModal]);

  const handleCloseModal = useCallback(
    async (continued: boolean = false) => {
      setModalState({ type: undefined });
      if (continued && modalState.onContinue) {
        await modalState.onContinue();
      }
    },
    [modalState],
  );

  const handleChangePreviewOptions = useCallback(
    (options: PreviewOptionsProps['options']) => {
      updateAppSettings({ ...settings, previewOptions: options });
    },
    [settings, updateAppSettings],
  );

  const handleShowMobileQR = useCallback(async () => {
    if (!project) return;

    try {
      const data = await getMobileQR(settings.previewOptions);
      if (data) {
        setMobileQRData(data);
      }
    } catch (error: unknown) {
      dispatch(
        snackbarActions.pushSnackbar(
          createGenericNotification('error', t('snackbar.generic.mobile_qr_failed')),
        ),
      );
    }
  }, [project, getMobileQR, settings.previewOptions, dispatch]);

  const handleCloseMobileQR = useCallback(() => {
    setMobileQRData(null);
  }, []);

  const handleOpenPreview = useCallback(async () => {
    await handleActionWithWarningCheck(handleOpenPreviewWithErrorHandling);
  }, [handleActionWithWarningCheck, handleOpenPreviewWithErrorHandling]);

  const handlePublishScene = useCallback(async () => {
    const rpc = iframeRef.current;
    if (rpc) saveAndGetThumbnail(rpc);
    await handleOpenPublishModal();
  }, [saveAndGetThumbnail, handleOpenPublishModal]);

  const handleDeployWorld = useCallback(async () => {
    if (!project) return;
    const rpc = iframeRef.current;
    if (rpc) saveAndGetThumbnail(rpc);
    try {
      await publishScene({ targetContent: config.get('WORLDS_CONTENT_SERVER_URL') });
      executeDeployment(project.path);
    } catch {
      openModal('publish', 'deploy');
    }
  }, [project, saveAndGetThumbnail, publishScene, executeDeployment, openModal]);

  const handleDeployLand = useCallback(async () => {
    if (!project) return;
    const rpc = iframeRef.current;
    if (rpc) saveAndGetThumbnail(rpc);
    try {
      await publishScene({ target: config.get('PEER_URL') });
      executeDeployment(project.path);
    } catch {
      openModal('publish', 'deploy');
    }
  }, [project, saveAndGetThumbnail, publishScene, executeDeployment, openModal]);

  const publishOptions = useMemo(
    () =>
      getPublishOptions({
        project,
        isDeploying,
        actions: {
          onPublishScene: handlePublishScene,
          onDeployWorld: handleDeployWorld,
          onDeployLand: handleDeployLand,
        },
      }),
    [project, isDeploying, handlePublishScene, handleDeployWorld, handleDeployLand],
  );

  // inspector url
  const htmlUrl = `http://localhost:${import.meta.env.VITE_INSPECTOR_PORT || inspectorPort}`;
  let binIndexJsUrl = `${htmlUrl}/bin/index.js`;

  // query params
  const params = new URLSearchParams();

  // params.append('dataLayerRpcWsUrl', `ws://localhost:${previewPort}/data-layer`); // this connects the inspector to the data layer running on the preview server

  params.append('dataLayerRpcParentUrl', window.location.origin);

  if (import.meta.env.VITE_ASSET_PACKS_CONTENT_URL) {
    // this is for local development of the asset-packs repo, or to use a different environment like .zone
    params.append('contentUrl', import.meta.env.VITE_ASSET_PACKS_CONTENT_URL);
  }

  if (import.meta.env.VITE_ASSET_PACKS_JS_PORT && import.meta.env.VITE_ASSET_PACKS_JS_PATH) {
    // this is for local development of the asset-packs repo
    const b64 = btoa(import.meta.env.VITE_ASSET_PACKS_JS_PATH);
    binIndexJsUrl = `http://localhost:${import.meta.env.VITE_ASSET_PACKS_JS_PORT}/content/contents/b64-${b64}`;
  }

  // this is the asset-packs javascript file
  params.append('binIndexJsUrl', binIndexJsUrl);

  // pass feature flags as initial state to avoid race condition with RPC handler registration
  params.append('featureFlags', JSON.stringify(inspectorFlags));

  // these are analytics related
  if (import.meta.env.VITE_SEGMENT_INSPECTOR_API_KEY) {
    params.append('segmentKey', import.meta.env.VITE_SEGMENT_INSPECTOR_API_KEY);
  }

  // analytics
  params.append('segmentAppId', 'creator-hub');
  if (userId) {
    params.append('segmentUserId', userId);
  }
  if (project) {
    params.append('projectId', project.id);
  }

  // iframe src
  const iframeUrl = `${htmlUrl}?${params}`;

  const renderLoading = () => (
    <div className="loading">
      <img src={EditorPng} />
      <Row>
        <Loader />
        {t('editor.loading.title')}
      </Row>
    </div>
  );

  return (
    <main className={cx('Editor', { 'experimental-ui': viewportToolbar })}>
      {!isReady ? (
        renderLoading()
      ) : (
        <>
          <Header hideUserMenu>
            <>
              {viewportToolbar ? (
                <>
                  <div className="scene-pill">
                    <div
                      className="back"
                      onClick={handleBack}
                    >
                      <ArrowBackIosIcon />
                    </div>
                    <img
                      className="scene-thumbnail"
                      src={
                        project.thumbnail
                          ? addBase64ImagePrefix(project.thumbnail)
                          : FallbackThumbnail
                      }
                      alt=""
                    />
                    <div className="scene-info">
                      <span
                        ref={titleRef}
                        className={cx('scene-title', { small: titleSmall })}
                      >
                        {project.title}
                      </span>
                      <span className="scene-parcels">
                        {t('scene_list.parcel_count', { parcels: parcelCount })}
                      </span>
                    </div>
                    <Tooltip title="Scene Settings">
                      <IconButton
                        size="small"
                        disabled={!isReady}
                        onClick={handleEditScene}
                      >
                        <SettingsIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <IconButton
                      size="small"
                      disabled={!isReady}
                      onClick={handleOpenMenu}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </div>
                  <Menu
                    anchorEl={menuAnchor}
                    open={Boolean(menuAnchor)}
                    onClose={handleCloseMenu}
                  >
                    <MenuItem onClick={handleToggleSceneInfo}>Scene Info</MenuItem>
                  </Menu>
                  <div className="editor-actions-pill">
                    <Button
                      disabled={!isReady}
                      onClick={handleUndo}
                      startIcon={<UndoIcon />}
                    >
                      Undo
                    </Button>
                    <Tooltip title="Redo">
                      <span>
                        <IconButton
                          size="small"
                          disabled={!isReady}
                          onClick={handleRedo}
                        >
                          <RedoIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="back"
                    onClick={handleBack}
                  >
                    <ArrowBackIosIcon />
                  </div>
                  <span className="title">{project.title}</span>
                </>
              )}
            </>
            <div className="actions">
              <div
                ref={metricsCardRef}
                className="header-card optimization-card"
              >
                <div className="optimization-info">
                  <span className="optimization-title">Scene Optimization</span>
                  <div className="optimization-progress">
                    <div
                      className="optimization-progress-fill progress-blue"
                      style={{ width: '70%' }}
                    />
                  </div>
                </div>
                <div className="optimization-button-wrapper">
                  <Button
                    color="secondary"
                    onClick={handleToggleMetrics}
                    startIcon={<GridViewIcon />}
                  />
                  {hasMetricsWarning && <span className="optimization-badge" />}
                </div>
              </div>
              <div className="header-card">
                <Button
                  color="secondary"
                  onClick={openCode}
                  startIcon={<CodeIcon />}
                >
                  {t('editor.header.actions.code')}
                </Button>
              </div>
              <div className="header-card">
                <ButtonGroup
                  color="secondary"
                  disabled={
                    loadingPreview || isInstallingProject || isDetectingCustomCode || isOffline
                  }
                  onClick={handleOpenPreview}
                  startIcon={loadingPreview ? <Loader size={20} /> : <PlayCircleIcon />}
                  extra={
                    <PreviewOptions
                      options={settings.previewOptions}
                      onChange={handleChangePreviewOptions}
                      onShowMobileQR={handleShowMobileQR}
                      supportsMultiInstance={supportsMultiInstance}
                    />
                  }
                >
                  {t('editor.header.actions.preview')}
                </ButtonGroup>
              </div>
              <div className="header-card">
                {publishOptions.length > 0 ? (
                  <ButtonGroup
                    color="primary"
                    disabled={
                      loadingPublish || isInstallingProject || isDetectingCustomCode || isOffline
                    }
                    onClick={() => {
                      if (deployment?.status === 'pending') {
                        openModal('publish', 'deploy');
                      } else {
                        handlePublishScene();
                      }
                    }}
                    startIcon={isDeploying ? <Loader size={20} /> : <PublicIcon />}
                    extra={<PublishOptions options={publishOptions} />}
                  >
                    {publishButtonText}
                  </ButtonGroup>
                ) : (
                  <Button
                    color="primary"
                    disabled={
                      loadingPublish || isInstallingProject || isDetectingCustomCode || isOffline
                    }
                    onClick={handlePublishScene}
                    startIcon={isDeploying ? <Loader size={20} /> : <PublicIcon />}
                  >
                    {publishButtonText}
                  </Button>
                )}
              </div>
              <ConnectionStatusIndicator />
            </div>
          </Header>
          <iframe
            className="inspector"
            src={iframeUrl}
            onLoad={handleIframeRef}
          ></iframe>
          <DeployModal
            type={modalState.type}
            project={project}
            onClose={handleCloseModal}
            initialStep={modalState.initialStep}
          />
          {mobileQRData && (
            <MobileQRCode
              open={!!mobileQRData}
              onClose={handleCloseMobileQR}
              url={mobileQRData.url}
              qr={mobileQRData.qr}
            />
          )}
          <Popover
            open={!!metricsAnchor}
            anchorEl={metricsAnchor}
            onClose={() => setMetricsAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            PaperProps={{ style: { marginTop: '16px' } }}
          >
            {metricsData && (
              <div className="metrics-popover">
                <div className="metrics-popover-header">Scene Optimization</div>
                <div className="metrics-popover-subtitle">Suggested Specs per Parcel</div>
                <div className="metrics-popover-subtitle">{parcelCount} Parcels</div>
                <div className="metrics-popover-items">
                  {Object.entries(metricsData.metrics).map(([key, value]) => {
                    const limit = metricsData.limits[key as keyof typeof metricsData.limits];
                    const exceeded = value > limit;
                    return (
                      <div
                        key={key}
                        className="metrics-popover-item"
                      >
                        <span className="metrics-popover-item-key">{key.toUpperCase()}</span>
                        <span
                          className={
                            exceeded
                              ? 'metrics-popover-item-value exceeded'
                              : 'metrics-popover-item-value'
                          }
                        >
                          <span className="primary">{value}</span>
                          {'/'}
                          <span className="secondary">{limit}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
                {metricsData.entitiesOutOfBoundaries.length > 0 && (
                  <div className="metrics-popover-warning">
                    {metricsData.entitiesOutOfBoundaries.length} entit
                    {metricsData.entitiesOutOfBoundaries.length === 1 ? 'y is' : 'ies are'} out of
                    bounds
                  </div>
                )}
                <div className="metrics-popover-actions">
                  <Button
                    color="secondary"
                    onClick={handleCleanUnusedAssets}
                  >
                    Clean unused Assets
                  </Button>
                </div>
              </div>
            )}
          </Popover>
        </>
      )}
    </main>
  );
}
