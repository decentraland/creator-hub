import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import CodeIcon from '@mui/icons-material/Code';
import PublicIcon from '@mui/icons-material/Public';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SyncIcon from '@mui/icons-material/Sync';
import { CircularProgress as Loader } from 'decentraland-ui2';

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

import EditorPng from '/assets/images/editor.png';

import { useSelector } from '#store';
import { Button } from '../Button';
import { Header } from '../Header';
import { Row } from '../Row';
import { ButtonGroup } from '../Button';
import { DeployModal } from './DeployModal';
import { PreviewOptions, PublishOptions } from './MenuOptions';
import { getPublishButtonText, getPublishOptions } from './utils';

import type { ModalType, ModalState } from './DeployModal';
import type { PreviewOptionsProps } from './MenuOptions';

import './styles.css';

export function EditorPage() {
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
  } = useEditor();
  const { settings, updateAppSettings } = useSettings();
  const { executeDeployment, getDeployment } = useDeploy();
  const deployment = project ? getDeployment(project.path) : undefined;

  const isDeploying = loadingPublish || deployment?.status === 'pending';

  const publishButtonText = useMemo(
    () => getPublishButtonText({ loadingPublish, deployment }),
    [loadingPublish, deployment],
  );

  const userId = useSelector(state => state.analytics.userId);
  const { detectCustomCode, isLoading: isDetectingCustomCode } = useSceneCustomCode(project);
  const iframeRef = useRef<ReturnType<typeof initRpc>>();
  const [modalState, setModalState] = useState<ModalState>({ type: undefined });

  const handleIframeRef = useCallback(
    (e: React.SyntheticEvent<HTMLIFrameElement, Event>) => {
      const iframe = e.currentTarget;
      if (project) {
        iframeRef.current = initRpc(iframe, project, { writeFile: updateScene });
      }
    },
    [project, updateScene],
  );

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
    await publishScene({ targetContent: config.get('WORLDS_CONTENT_SERVER_URL') });
    executeDeployment(project.path);
  }, [project, saveAndGetThumbnail, publishScene, executeDeployment]);

  const handleDeployLand = useCallback(async () => {
    if (!project) return;
    const rpc = iframeRef.current;
    if (rpc) saveAndGetThumbnail(rpc);
    await publishScene({ target: config.get('PEER_URL') });
    executeDeployment(project.path);
  }, [project, saveAndGetThumbnail, publishScene, executeDeployment]);

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

  const handleExportScene = useCallback(async () => {
    const rpc = iframeRef.current;
    if (!rpc || !rpc.scene) return;

    try {
      // Request the inspector to trigger the export
      // The inspector will collect entities and send them via RPC
      await rpc.scene.exportSceneTrigger();
    } catch (error) {
      console.error('Failed to trigger export:', error);
    }
  }, [iframeRef.current]);

  const handleOpenBlenderWorkflow = useCallback(() => {
    openModal('blender-workflow');
  }, [openModal]);

  const handleQuickSync = useCallback(async () => {
    // Check if we have a last used .blend file
    const lastBlendFile = localStorage.getItem('lastBlenderFile');
    
    if (!lastBlendFile) {
      // No file linked, open full modal
      openModal('blender-workflow');
      return;
    }

    // Quick sync without modal - just show preview
    openModal('blender-workflow');
  }, [openModal]);

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
            </>
            <div className="actions">
              <Button
                color="secondary"
                onClick={openCode}
                startIcon={<CodeIcon />}
              >
                {t('editor.header.actions.code')}
              </Button>
              <Button
                color="secondary"
                onClick={handleExportScene}
                startIcon={<FileDownloadIcon />}
              >
                Export
              </Button>
              <Button
                color="secondary"
                onClick={handleOpenBlenderWorkflow}
                startIcon={<SyncIcon />}
              >
                Sync from Blender
              </Button>
              <ButtonGroup
                color="secondary"
                disabled={loadingPreview || isInstallingProject || isDetectingCustomCode}
                onClick={handleOpenPreview}
                startIcon={loadingPreview ? <Loader size={20} /> : <PlayCircleIcon />}
                extra={
                  <PreviewOptions
                    options={settings.previewOptions}
                    onChange={handleChangePreviewOptions}
                  />
                }
              >
                {t('editor.header.actions.preview')}
              </ButtonGroup>
              {publishOptions.length > 0 ? (
                <ButtonGroup
                  color="primary"
                  disabled={loadingPublish || isInstallingProject || isDetectingCustomCode}
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
                  disabled={loadingPublish || isInstallingProject || isDetectingCustomCode}
                  onClick={handlePublishScene}
                  startIcon={<PublicIcon />}
                >
                  {publishButtonText}
                </Button>
              )}
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
            rpc={iframeRef.current}
          />
        </>
      )}
    </main>
  );
}
