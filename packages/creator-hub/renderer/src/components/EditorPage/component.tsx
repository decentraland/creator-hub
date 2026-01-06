import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import CodeIcon from '@mui/icons-material/Code';
import PublicIcon from '@mui/icons-material/Public';
import {
  Checkbox,
  FormControlLabel,
  FormGroup,
  ListItemButton,
  ListItemText,
  CircularProgress as Loader,
} from 'decentraland-ui2';

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
import { PublishProject } from '../Modals/PublishProject';
import { PublishHistory } from '../Modals/PublishHistory';
import { InstallClient } from '../Modals/InstallClient';
import { WarningModal } from '../Modals/WarningModal';
import { Button } from '../Button';
import { Header } from '../Header';
import { Row } from '../Row';
import { ButtonGroup } from '../Button';

import type {
  ModalType,
  ModalState,
  PreviewOptionsProps,
  PublishOption,
  PublishOptionsProps,
  ModalProps,
} from './types';

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

  const publishButtonText = useMemo(() => {
    if (loadingPublish) {
      return t('modal.publish_project.deploy.deploying.step.loading');
    }

    if (deployment?.status === 'pending') {
      const { catalyst, assetBundle, lods } = deployment.componentsStatus;

      if (catalyst === 'pending') {
        return t('modal.publish_project.deploy.deploying.step.uploading');
      }
      if (assetBundle === 'pending') {
        return t('modal.publish_project.deploy.deploying.step.converting');
      }
      if (lods === 'pending') {
        return t('modal.publish_project.deploy.deploying.step.optimizing');
      }

      return t('modal.publish_project.deploy.deploying.step.loading');
    }

    return t('editor.header.actions.publish');
  }, [loadingPublish, deployment?.status, deployment?.componentsStatus]);
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

  const handleClickPublishOptions = useCallback(
    async (option: PublishOption) => {
      if (!project) return;

      const rpc = iframeRef.current;
      if (rpc) saveAndGetThumbnail(rpc);

      switch (option.id) {
        case 'publish-scene':
          await handleOpenPublishModal();
          break;
        case 'deploy-world':
          await publishScene({ targetContent: config.get('WORLDS_CONTENT_SERVER_URL') });
          executeDeployment(project.path);
          break;
        case 'deploy-land':
          await publishScene({ target: config.get('PEER_URL') });
          executeDeployment(project.path);
          break;
      }
    },
    [
      handleOpenPublishModal,
      project,
      publishScene,
      saveAndGetThumbnail,
      executeDeployment,
      deployment?.status,
      openModal,
    ],
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
              <ButtonGroup
                color="primary"
                disabled={loadingPublish || isInstallingProject || isDetectingCustomCode}
                onClick={() => {
                  if (deployment?.status === 'pending') {
                    openModal('publish', 'deploy');
                  } else {
                    handleClickPublishOptions({ id: 'publish-scene' });
                  }
                }}
                startIcon={
                  loadingPublish || deployment?.status === 'pending' ? (
                    <Loader size={20} />
                  ) : (
                    <PublicIcon />
                  )
                }
                extra={
                  <PublishOptions
                    project={project}
                    isDeploying={loadingPublish || deployment?.status === 'pending'}
                    onClick={handleClickPublishOptions}
                  />
                }
              >
                {publishButtonText}
              </ButtonGroup>
            </div>
          </Header>
          <iframe
            className="inspector"
            src={iframeUrl}
            onLoad={handleIframeRef}
          ></iframe>
          <Modal
            type={modalState.type}
            project={project}
            onClose={handleCloseModal}
            initialStep={modalState.initialStep}
          />
        </>
      )}
    </main>
  );
}

function PreviewOptions({ onChange, options }: PreviewOptionsProps) {
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
        <FormControlLabel
          control={
            <Checkbox
              checked={!!options.enableLandscapeTerrains}
              onChange={handleChange({ enableLandscapeTerrains: !options.enableLandscapeTerrains })}
            />
          }
          label={t('editor.header.actions.preview_options.landscape_terrain_enabled')}
        />
      </FormGroup>
    </div>
  );
}

function PublishOptions({ project, isDeploying, onClick }: PublishOptionsProps) {
  const handleClick = useCallback(
    (id: 'publish-scene' | 'deploy-world' | 'deploy-land') => () => {
      onClick({ id });
    },
    [onClick],
  );

  const worldName = project?.worldConfiguration?.name;
  const landBase = project?.scene?.base;

  return (
    <div className="PublishOptions">
      {isDeploying && (
        <ListItemButton onClick={handleClick('publish-scene')}>
          <ListItemText primary={t('editor.header.actions.publish_options.publish_scene')} />
        </ListItemButton>
      )}
      {worldName && (
        <ListItemButton onClick={handleClick('deploy-world')}>
          <ListItemText
            primary={t('editor.header.actions.publish_options.republish_to_world', {
              name: worldName,
            })}
          />
        </ListItemButton>
      )}
      {!worldName && landBase && project?.scene?.base !== '0,0' && (
        <ListItemButton onClick={handleClick('deploy-land')}>
          <ListItemText
            primary={t('editor.header.actions.publish_options.republish_to_land', {
              coords: landBase,
            })}
          />
        </ListItemButton>
      )}
    </div>
  );
}

function Modal({ type, initialStep, ...props }: ModalProps) {
  switch (type) {
    case 'publish':
      return (
        <PublishProject
          open={type === 'publish'}
          initialStep={initialStep}
          {...props}
        />
      );
    case 'publish-history':
      return (
        <PublishHistory
          open={type === 'publish-history'}
          {...props}
        />
      );
    case 'install-client':
      return (
        <InstallClient
          open={type === 'install-client'}
          onClose={() => props.onClose(false)}
        />
      );
    case 'warning':
      return (
        <WarningModal
          open={type === 'warning'}
          onClose={props.onClose}
        />
      );
    default:
      return null;
  }
}
