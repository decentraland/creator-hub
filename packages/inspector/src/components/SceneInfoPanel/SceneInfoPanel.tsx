import React, { useCallback } from 'react';
import { AiOutlineClose as CloseIcon, AiOutlineInfoCircle as InfoIcon } from 'react-icons/ai';

import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { toggleInfoPanel, selectSceneInfo } from '../../redux/scene-info';
import { Loading } from '../Loading';
import { MarkdownRenderer } from './MarkdownRenderer';

import './SceneInfoPanel.css';

const SceneInfoPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const { content, isLoading } = useAppSelector(selectSceneInfo);

  const handleClose = useCallback(() => {
    dispatch(toggleInfoPanel(false));
  }, []);

  return (
    <div className="SceneInfoPanel">
      <div className="SceneInfoHeader">
        <div className="TitleWrapper">
          <InfoIcon />
          <div className="Title">Scene Info</div>
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
      <div className="Content">
        {isLoading ? (
          <div className="Loading">
            <Loading dimmer={false} />
          </div>
        ) : content ? (
          <MarkdownRenderer content={content} />
        ) : null}
      </div>
    </div>
  );
};

export default React.memo(SceneInfoPanel);
