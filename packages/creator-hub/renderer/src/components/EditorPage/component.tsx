import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useEditor } from '/@/hooks/useEditor';
import { useSettings } from '/@/hooks/useSettings';
import { useSceneCustomCode } from '/@/hooks/useSceneCustomCode';

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
  } = useEditor();
  const { settings, updateAppSettings } = useSettings();
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

  const openModal = useCallback((type: ModalType) => {
    setModalState({ type });
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
    const rpc = iframeRef.current;
    if (!rpc) return;
    saveAndGetThumbnail(rpc);

    await handleActionWithWarningCheck(() => openModal('publish'));
  }, [iframeRef.current, saveAndGetThumbnail, handleActionWithWarningCheck, openModal]);

  const handleCloseModal = useCallback(
    async (continued: boolean = false) => {
      if (continued && modalState.onContinue) {
        await modalState.onContinue();
      }
      setModalState({ type: undefined });
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleClickPublishOptions = useCallback(
    (option: PublishOption) => {
      switch (option.id) {
        case 'history':
          return openModal('publish-history');
        default:
          return;
      }
    },
    [openModal],
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
              <Button
                color="primary"
                disabled={loadingPublish || isInstallingProject || isDetectingCustomCode}
                onClick={handleOpenPublishModal}
                startIcon={loadingPublish ? <Loader size={20} /> : <PublicIcon />}
                // extra={<PublishOptions onClick={handleClickPublishOptions} />}
              >
                {t('editor.header.actions.publish')}
              </Button>
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
        {/* <FormControlLabel
          control={
            <Checkbox
              checked={!!options.openNewInstance}
              onChange={handleChange({ openNewInstance: !options.openNewInstance })}
            />
          }
          label={t('editor.header.actions.preview_options.open_new_instance')}
        /> */}
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PublishOptions({ onClick }: PublishOptionsProps) {
  const handleClick = useCallback(
    (id: 'history') => () => {
      onClick({ id });
    },
    [onClick],
  );

  return (
    <div className="PublishOptions">
      <ListItemButton>
        <ListItemText
          onClick={handleClick('history')}
          primary={t('editor.header.actions.publish_options.history')}
        />
      </ListItemButton>
    </div>
  );
}

function Modal({ type, ...props }: ModalProps) {
  switch (type) {
    case 'publish':
      return (
        <PublishProject
          open={type === 'publish'}
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
