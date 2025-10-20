import React, { useCallback } from 'react';
import { AiOutlineClose as CloseIcon, AiOutlineInfoCircle as InfoIcon } from 'react-icons/ai';

import { useAppSelector } from '../../redux/hooks';
import { selectSceneInfo } from '../../redux/scene-info';
import { useInspectorUIState } from '../../hooks/sdk/useInspectorUIState';
import { Loading } from '../Loading';
import { MarkdownRenderer } from './MarkdownRenderer';

import './SceneInfoPanel.css';

const SceneInfoPanel: React.FC = () => {
  const { content, isLoading } = useAppSelector(selectSceneInfo);
  const [, updateUIState] = useInspectorUIState();

  const handleClose = useCallback(() => {
    updateUIState({ sceneInfoPanelVisible: false });
  }, [updateUIState]);

  return (
    <div className="SceneInfoPanel">
      <div className="SceneInfoHeader">
        <div className="TitleWrapper">
          <InfoIcon />
          <div className="Title">Scene Info</div>
          {isLoading && (
            <div className="Loading">
              <Loading
                dimmer={false}
                size="small"
              />
            </div>
          )}
        </div>

        <div className="Actions">
          <button
            className="CloseButton"
            onClick={handleClose}
            title="Close panel"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
      {!!content && <MarkdownRenderer content={content} />}
    </div>
  );
};

export default React.memo(SceneInfoPanel);
