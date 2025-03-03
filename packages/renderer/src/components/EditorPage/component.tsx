import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Checkbox,
  FormControlLabel,
  FormGroup,
  CircularProgress as Loader,
} from 'decentraland-ui2';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import CodeIcon from '@mui/icons-material/Code';
import PublicIcon from '@mui/icons-material/Public';

import { useSelector } from '#store';

import { isWorkspaceError } from '/shared/types/workspace';

import { t } from '/@/modules/store/translation/utils';
import { initRpc } from '/@/modules/rpc';
import { useEditor } from '/@/hooks/useEditor';
import { useSettings } from '/@/hooks/useSettings';

import EditorPng from '/assets/images/editor.png';

import { PublishProject } from '../Modals/PublishProject';
import { Button } from '../Button';
import { Header } from '../Header';
import { Row } from '../Row';
import { ButtonGroup } from '../Button';

import type { PreviewOptionsProps } from './types';

import './styles.css';

type ModalType = 'publish';

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
  const iframeRef = useRef<ReturnType<typeof initRpc>>();
  const [modalOpen, setModalOpen] = useState<ModalType | undefined>();

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
    if (isWorkspaceError(error, 'PROJECT_NOT_FOUND')) navigate('/scenes');
    return () => {
      const rpc = iframeRef.current;
      if (rpc) {
        rpc.dispose();
        iframeRef.current = undefined;
      }
    };
  }, [error]);

  const isReady = !!project && inspectorPort > 0;

  const handleBack = useCallback(async () => {
    const rpc = iframeRef.current;
    if (rpc) await refreshProject(rpc);
    killPreview();
    navigate('/scenes');
  }, [navigate, iframeRef.current]);

  const handleOpenModal = useCallback(
    (type: ModalType) => () => {
      const rpc = iframeRef.current;
      if (rpc) {
        saveAndGetThumbnail(rpc);
        setModalOpen(type);
      }
    },
    [iframeRef.current],
  );

  const handleCloseModal = useCallback(() => {
    setModalOpen(undefined);
  }, []);

  const handleChangePreviewOptions = useCallback(
    (options: PreviewOptionsProps['options']) => {
      updateAppSettings({ ...settings, previewOptions: options });
    },
    [settings, updateAppSettings],
  );

  const handleOpenPreview = useCallback(() => {
    openPreview(settings.previewOptions);
  }, [openPreview, settings.previewOptions]);

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
              <div className="title">{project?.title}</div>
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
                disabled={loadingPreview || isInstallingProject}
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
                disabled={loadingPublish || isInstallingProject}
                onClick={handleOpenModal('publish')}
                startIcon={loadingPublish ? <Loader size={20} /> : <PublicIcon />}
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
          {project && (
            <PublishProject
              open={modalOpen === 'publish'}
              project={project}
              onClose={handleCloseModal}
            />
          )}
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
      <span className="title">Preview options</span>
      <FormGroup>
        <FormControlLabel
          control={
            <Checkbox
              checked={!!options.debugger}
              onChange={handleChange({ debugger: !options.debugger })}
            />
          }
          label="Open Console Window during preview"
        />
      </FormGroup>
    </div>
  );
}
