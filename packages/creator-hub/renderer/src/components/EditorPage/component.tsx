import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import CodeIcon from '@mui/icons-material/Code';
import PublicIcon from '@mui/icons-material/Public';
import RefreshIcon from '@mui/icons-material/Refresh';
import { CircularProgress as Loader, Tooltip } from 'decentraland-ui2';

import { isClientNotInstalledError } from '/shared/types/client';
import { isProjectError } from '/shared/types/projects';
import { RENDERER } from '/shared/types/settings';
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
import { useMobileDebugForwarding } from '/@/hooks/useMobileDebugForwarding';
import { ConnectionStatus } from '/@/lib/connection';

import EditorPng from '/assets/images/editor.png';

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
    startBevyRealm,
    killBevyRealm,
  } = useEditor();
  const { settings, updateAppSettings } = useSettings();
  const { flags: featureFlags } = useFeatureFlags();
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
  const [mobileQRData, setMobileQRData] = useState<{ url: string; qr: string } | null>(null);
  // When the Bevy renderer is selected the engine loads from a headless
  // sdk-commands realm, and the inspector shares its data-layer WS. We start it
  // for the project and hold the URLs to thread into the iframe config below.
  const useBevy = settings.renderer === RENDERER.BEVY;
  const [bevyRealm, setBevyRealm] = useState<{ url: string; wsUrl: string } | null>(null);
  // A broken scene (e.g. a TS error) makes the Bevy realm's `sdk-commands start`
  // fail, or the scene never finishes loading — leaving the editor stuck on the
  // loader with no way out. Capture the failure (or a load timeout) so the loading
  // screen can offer Back + Open code + the error message (#1380).
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadTimedOut, setLoadTimedOut] = useState(false);

  const isOffline = status === ConnectionStatus.OFFLINE;
  const showDebugPanel = settings.previewOptions.debugger;

  useDebugLogForwarding(iframeRef, isPreviewRunning, showDebugPanel, project?.path);
  useMobileDebugForwarding(iframeRef, isPreviewRunning, project?.path);

  const handleIframeRef = useCallback(
    (e: React.SyntheticEvent<HTMLIFrameElement, Event>) => {
      const iframe = e.currentTarget;
      if (project) {
        if (iframeRef.current) {
          iframeRef.current.dispose();
          iframeRef.current = undefined;
        }
        const rpc = initRpc(iframe, project, { writeFile: updateScene });
        iframeRef.current = rpc;
        void rpc.scene.setFeatureFlags(featureFlags).catch(console.error);
      }
    },
    [project, updateScene, featureFlags],
  );

  const handleRefresh = useCallback(() => {
    const rpc = iframeRef.current;
    if (!rpc) return;
    const { iframe } = rpc;
    const { src } = iframe;
    rpc.dispose();
    iframeRef.current = undefined;
    iframe.src = src;
  }, []);

  useEffect(() => {
    const rpc = iframeRef.current;
    if (rpc) {
      void rpc.scene.setFeatureFlags(featureFlags).catch(console.error);
    }
  }, [featureFlags]);

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

  // Start (or tear down) the Bevy realm as the renderer setting / project changes.
  // The iframe render is gated on the realm being ready when Bevy is selected, so
  // the inspector boots already pointed at the right data-layer + realm.
  const projectPath = project?.path;
  useEffect(() => {
    if (!projectPath || !useBevy) {
      setBevyRealm(null);
      return;
    }
    // Wait for dependency install to finish before starting the realm. On a
    // freshly created scene CH installs deps, then this effect fires — starting
    // `sdk-commands start` while node_modules is still being written fails with
    // "Could not find package.json for module @dcl/sdk-commands". Gating on
    // isInstallingProject (in the deps below) re-runs this once install completes,
    // and keeps the loader spinning (not the error screen) meanwhile.
    if (isInstallingProject) {
      setBevyRealm(null);
      return;
    }
    let cancelled = false;
    setLoadError(null);
    setLoadTimedOut(false);
    void startBevyRealm(projectPath)
      .then(realm => {
        if (!cancelled) setBevyRealm(realm ?? null);
      })
      .catch(error => {
        console.error('[Bevy] Failed to start realm:', error);
        if (!cancelled) {
          setBevyRealm(null);
          // Surface the failure so the loader shows Back + the error instead of
          // spinning forever. `sdk-commands start` rejects with the build error
          // line (see bevy-realm.ts waitFor) — show it.
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      });
    return () => {
      cancelled = true;
      void killBevyRealm(projectPath);
    };
  }, [projectPath, useBevy, isInstallingProject, startBevyRealm, killBevyRealm]);

  const isReady = !!project && inspectorPort > 0 && (!useBevy || bevyRealm !== null);

  // A load timeout backstop: even if the realm "starts", a broken scene can leave
  // the editor never becoming ready. After a grace period on the loader, offer the
  // same escape hatch (Back + Open code) rather than an infinite spinner. Don't run
  // the timer while deps are still installing — a fresh scene's npm install can
  // exceed the grace period and isn't a load failure.
  useEffect(() => {
    if (isReady || loadError || isInstallingProject) {
      setLoadTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setLoadTimedOut(true), 45_000);
    return () => clearTimeout(timer);
  }, [isReady, loadError, isInstallingProject, projectPath, useBevy]);

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
    // Refresh the project (saves + regenerates the thumbnail) on the way out, but
    // never let it block navigation. The thumbnail is a Babylon-canvas screenshot
    // over the scene RPC, which has no server under Bevy — skip it in that mode,
    // and guard the Babylon path so a throw can't wedge Back. (`takeScreenshot`
    // is also timeout-bounded, so even an unexpected stall can't hang here.)
    if (rpc && !useBevy) {
      try {
        await refreshProject(rpc);
      } catch (error) {
        console.error('[Editor] refreshProject on back failed:', error);
      }
    }
    killPreview();
    navigate('/scenes');
  }, [navigate, useBevy, refreshProject, killPreview]);

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

  // The thumbnail comes from a Babylon-canvas screenshot over the scene RPC, which
  // has no server under the Bevy renderer (the request would just time out and
  // yield no thumbnail). Skip it in Bevy mode rather than fire a doomed request.
  // (`takeScreenshot` is also timeout-guarded so this can never hang the flow.)
  const saveThumbnailIfSupported = useCallback(() => {
    const rpc = iframeRef.current;
    if (rpc && !useBevy) saveAndGetThumbnail(rpc);
  }, [useBevy, saveAndGetThumbnail]);

  const handlePublishScene = useCallback(async () => {
    saveThumbnailIfSupported();
    await handleOpenPublishModal();
  }, [saveThumbnailIfSupported, handleOpenPublishModal]);

  const handleDeployWorld = useCallback(async () => {
    if (!project) return;
    saveThumbnailIfSupported();
    try {
      await publishScene({ targetContent: config.get('WORLDS_CONTENT_SERVER_URL') });
      executeDeployment(project.path);
    } catch {
      openModal('publish', 'deploy');
    }
  }, [project, saveThumbnailIfSupported, publishScene, executeDeployment, openModal]);

  const handleDeployLand = useCallback(async () => {
    if (!project) return;
    saveThumbnailIfSupported();
    try {
      await publishScene({ target: config.get('PEER_URL') });
      executeDeployment(project.path);
    } catch {
      openModal('publish', 'deploy');
    }
  }, [project, saveThumbnailIfSupported, publishScene, executeDeployment, openModal]);

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

  // Always tell the inspector which renderer to use, so IT doesn't offer an
  // independent (un-plumbed) choice via its own toolbar picker — the host owns
  // renderer selection and supplies each renderer's config. Without this, picking
  // Bevy inside the inspector mounts the engine with no realm and boots the wrong
  // (default) world.
  params.append('renderer', useBevy ? RENDERER.BEVY : RENDERER.BABYLON);

  // The parent-window scene-RPC control channel (host↔inspector feature flags,
  // notifications, file/dir open) is wired whenever this is set — for BOTH
  // renderers. Babylon also uses it as its data-layer transport; Bevy instead
  // uses the realm WS (set below, which takes precedence), but still needs this
  // channel or the host's feature flags never reach it (e.g. SceneMinimap).
  params.append('dataLayerRpcParentUrl', window.location.origin);

  if (useBevy && bevyRealm) {
    // Bevy editor: the inspector shares the realm's data-layer WS so entity ids
    // align with the engine (forward edits land on the right entities), and the
    // engine loads the scene from the realm. `dataLayerRpcWsUrl` takes precedence
    // over `dataLayerRpcParentUrl` in the inspector, so we set the WS instead of
    // the parent-window data-layer here.
    params.append('dataLayerRpcWsUrl', bevyRealm.wsUrl);
    params.append('bevyRealm', bevyRealm.url);
    if (project) {
      // The engine loads the scene at its real parcel; the base coord is bevyPosition.
      params.append('bevyPosition', project.scene.base);
    }
    // The super-user editor-agent portable experience (viewport pick + gizmo),
    // shipped as a static realm at public/bevy-agent and served same-origin by the
    // inspector http-server. The engine loads it as a realm (GETs
    // `<systemScene>/about`); the export nests `<realmName>/about`, hence the
    // doubled path segment. A dev server can override via VITE_BEVY_SYSTEM_SCENE.
    params.append(
      'bevySystemScene',
      import.meta.env.VITE_BEVY_SYSTEM_SCENE || `${htmlUrl}/bevy-agent/bevy-agent`,
    );
  }

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

  const renderLoading = () => {
    // Recoverable stuck-load state (#1380): the realm failed to start (broken code)
    // or the scene never finished loading. Offer Back + Open code + the error,
    // instead of an infinite spinner with no way out.
    const stuck = loadError !== null || loadTimedOut;
    if (stuck) {
      return (
        <div className="loading loading-error">
          <img src={EditorPng} />
          <div className="loading-error-title">{t('editor.loading.failed.title')}</div>
          <div className="loading-error-message">
            {loadError ?? t('editor.loading.failed.timeout')}
          </div>
          <Row>
            <Button
              color="secondary"
              startIcon={<ArrowBackIosIcon />}
              onClick={handleBack}
            >
              {t('editor.loading.failed.back')}
            </Button>
            <Button
              color="secondary"
              startIcon={<CodeIcon />}
              onClick={openCode}
            >
              {t('editor.header.actions.code')}
            </Button>
          </Row>
        </div>
      );
    }
    return (
      <div className="loading">
        <img src={EditorPng} />
        <Row>
          <Loader />
          {t('editor.loading.title')}
        </Row>
      </div>
    );
  };

  return (
    <main className="Editor">
      {!isReady ? (
        renderLoading()
      ) : (
        <>
          <Header hideUserMenu>
            <>
              <div
                className="back"
                onClick={handleBack}
              >
                <ArrowBackIosIcon />
              </div>
              <div className="title">{project.title}</div>
              <Tooltip title={t('editor.header.actions.refresh')}>
                <div
                  className="refresh"
                  onClick={handleRefresh}
                  aria-label="refresh-inspector"
                >
                  <RefreshIcon />
                </div>
              </Tooltip>
            </>
            <div className="actions">
              <Button
                color="secondary"
                onClick={openCode}
                startIcon={<CodeIcon />}
              >
                {t('editor.header.actions.code')}
              </Button>
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
                    projectPath={project.path}
                  />
                }
              >
                {t('editor.header.actions.preview')}
              </ButtonGroup>
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
              <ConnectionStatusIndicator />
            </div>
          </Header>
          <iframe
            className="inspector"
            src={iframeUrl}
            onLoad={handleIframeRef}
            // Grant cross-origin isolation to the inspector iframe so the Bevy
            // engine (nested one level deeper) can use SharedArrayBuffer. The
            // renderer document + inspector server carry COOP/COEP, but a
            // cross-origin child frame only becomes crossOriginIsolated when the
            // embedder explicitly delegates it via this Permissions-Policy. Inert
            // for the Babylon renderer.
            allow="cross-origin-isolated"
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
        </>
      )}
    </main>
  );
}
