import React, { useCallback } from 'react';
import { TextArea } from '../../../ui';
import { useAppDispatch, useAppSelector } from '../../../../redux/hooks';
import {
  getSceneInfoContent,
  saveSceneInfoContent,
  selectSceneInfo,
  setSceneInfoContent,
} from '../../../../redux/data-layer';
import { Loading } from '../../../Loading';
import './SceneInfoInput.css';

const SceneInfoInput: React.FC = () => {
  const dispatch = useAppDispatch();
  const sceneInfo = useAppSelector(selectSceneInfo);

  const handleSceneInfoRefresh = useCallback(() => {
    dispatch(getSceneInfoContent());
  }, []);

  const handleSceneInfoChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    dispatch(setSceneInfoContent(content)); // Only update local state while editing
  }, []);

  const handleSceneInfoSave = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    dispatch(saveSceneInfoContent(content)); // Save to scene on blur
  }, []);

  return (
    <TextArea
      className="SceneInfoInput"
      label={
        <span className="SceneInfoLabel">
          Scene Info Panel (supports <span className="MarkdownLink">markdown</span>)
          {sceneInfo.isLoading && (
            <span className="LoadingContainer">
              <Loading
                dimmer={false}
                size="mini"
              />
            </span>
          )}
        </span>
      }
      value={sceneInfo.content}
      onFocus={handleSceneInfoRefresh}
      onChange={handleSceneInfoChange}
      onBlur={handleSceneInfoSave}
      placeholder="Add markdown content to display in the Scene Info panel. Supports headings, lists, links, images, videos and more."
      rows={6}
      error={sceneInfo.error || undefined}
    />
  );
};

export default SceneInfoInput;
