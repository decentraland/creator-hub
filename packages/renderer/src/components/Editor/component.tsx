import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Loader from '@mui/material/CircularProgress';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import { Modal } from 'decentraland-ui2/dist/components/Modal/Modal';

import { t } from '/@/modules/store/translation/utils';
import { useEditor } from '/@/hooks/useEditor';

import WorldsPng from '/assets/images/worlds.png';
import LandPng from '/assets/images/land.png';

import { Button } from '../Button';
import { Header } from '../Header';

import './styles.css';
import { OptionBox } from './OptionBox';

type ModalType = 'publish';

export function Editor() {
  const navigate = useNavigate();
  const ref = useRef(false);
  const { project, inspectorPort, runScene, previewPort, loadingPreview, openPreview } =
    useEditor();
  const [open, setOpen] = useState<ModalType | undefined>();

  const isReady = !!project && inspectorPort > 0 && previewPort > 0;

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const handleOpenModal = useCallback((type: ModalType) => () => {
    setOpen(type);
  }, []);

  const handleCloseModal = useCallback(() => {
    setOpen(undefined);
  }, []);

  useEffect(() => {
    if (ref.current) return;
    runScene();
    ref.current = true;
  }, []);

  // inspector url
  const htmlUrl = `http://localhost:${import.meta.env.VITE_INSPECTOR_PORT || inspectorPort}`;
  let binIndexJsUrl = `${htmlUrl}/bin/index.js`;

  // query params
  const params = new URLSearchParams();

  params.append('dataLayerRpcWsUrl', `ws://0.0.0.0:${previewPort}/data-layer`); // this connects the inspector to the data layer running on the preview server

  if (import.meta.env.VITE_ASSET_PACKS_CONTENT_URL) {
    // this is for local development of the asset-packs repo, or to use a different environment like .zone
    params.append('contentUrl', import.meta.env.VITE_ASSET_PACKS_CONTENT_URL);
  }

  if (import.meta.env.VITE_ASSET_PACKS_JS_PORT && import.meta.env.VITE_ASSET_PACKS_JS_PATH) {
    // this is for local development of the asset-packs repo
    const b64 = btoa(import.meta.env.VITE_ASSET_PACKS_JS_PATH);
    binIndexJsUrl = `http://localhost:${
      import.meta.env.VITE_ASSET_PACKS_JS_PORT
    }/content/contents/b64-${b64}`;
  }

  // this is the asset-packs javascript file
  params.append('binIndexJsUrl', binIndexJsUrl);

  // these are analytics related
  if (import.meta.env.VITE_INSPECTOR_SEGMENT_API_KEY) {
    params.append('segmentKey', import.meta.env.VITE_INSPECTOR_SEGMENT_API_KEY);
  }

  if (import.meta.env.VITE_INSPECTOR_SEGMENT_APP_ID) {
    params.append('segmentAppId', import.meta.env.VITE_INSPECTOR_SEGMENT_APP_ID);
  }

  // TODO: these are to identify events, but I wouldn't know what values to use
  // params.append('segmentUserId', ???);
  // params.append('projectId', ???);

  // iframe src
  const iframeUrl = `${htmlUrl}?${params}`;

  return (
    <div className="Editor">
      <Header>
        <>
          <div className="back" onClick={handleBack}><ArrowBackIosIcon /></div>
          <div className="title">{project?.title}</div>
        </>
        <>
          <Button color="secondary">{t('editor.header.actions.code')}</Button>
          <Button
            color="secondary"
            disabled={loadingPreview}
            onClick={openPreview}
          >
            {t('editor.header.actions.preview')}
          </Button>
          <Button color="primary" onClick={handleOpenModal('publish')}>{t('editor.header.actions.publish')}</Button>
        </>
      </Header>
      {isReady ? (
        <iframe
          className="inspector"
          src={iframeUrl}
        ></iframe>
      ) : (
        <div className="loading">
          <Loader />
        </div>
      )}
      <Modal
        open={open === 'publish'}
        title={t('editor.modal.publish.title', { title: project?.title })}
        onClose={handleCloseModal}
        size="small"
      >
        <div className="PublishModal">
          <span className="select">{t('editor.modal.publish.select')}</span>
          <div className="options">
            <OptionBox
              thumbnailSrc={WorldsPng}
              title={t('editor.modal.publish.worlds.title')}
              description={t('editor.modal.publish.worlds.description')}
              buttonText={t('editor.modal.publish.worlds.action')}
              onClickPublish={() => null}
              learnMoreUrl={'123'}
            />
            <OptionBox
              thumbnailSrc={LandPng}
              title={t('editor.modal.publish.land.title')}
              description={t('editor.modal.publish.land.description')}
              buttonText={t('editor.modal.publish.land.action')}
              onClickPublish={() => null}
              learnMoreUrl={'asd'}
            />
          </div>
          <span className="alternative_servers">{t('editor.modal.publish.alternative_servers')}</span>
        </div>
      </Modal>
    </div>
  );
}
