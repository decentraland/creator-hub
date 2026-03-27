import { useCallback } from 'react';
import { BiSave, BiBadgeCheck, BiUndo, BiRedo } from 'react-icons/bi';
import { RiListSettingsLine } from 'react-icons/ri';
import { AiOutlineInfoCircle as InfoIcon } from 'react-icons/ai';
import { FaPencilAlt } from 'react-icons/fa';
import cx from 'classnames';

import { withSdk } from '../../hoc/withSdk';
import {
  save,
  selectSceneInfo,
  undo,
  redo,
  selectCanUndo,
  selectCanRedo,
} from '../../redux/data-layer';
import { selectCanSave, selectInspectorPreferences } from '../../redux/app';
import { isFeatureFlagEnabled } from '../../redux/feature-flags';
import { useInspectorUIState } from '../../hooks/sdk/useInspectorUIState';
import { useAppSelector, useAppDispatch } from '../../redux/hooks';
import {
  SAVE,
  SAVE_ALT,
  UNDO,
  UNDO_ALT,
  REDO,
  REDO_2,
  REDO_ALT,
  REDO_ALT_2,
  useHotkey,
} from '../../hooks/useHotkey';
import { Gizmos } from './Gizmos';
import { Preferences } from './Preferences';
import { ToolbarButton } from './ToolbarButton';

import './Toolbar.css';

const Toolbar = withSdk(({ sdk }) => {
  const canSave = useAppSelector(selectCanSave);
  const preferences = useAppSelector(selectInspectorPreferences);
  const isAutosaveEnabled = preferences?.autosaveEnabled ?? true;
  const sceneInfoContent = useAppSelector(selectSceneInfo).content;
  const canUndo = useAppSelector(selectCanUndo);
  const canRedo = useAppSelector(selectCanRedo);
  const viewportToolbar = useAppSelector(state => isFeatureFlagEnabled(state, 'viewportToolbar'));
  const dispatch = useAppDispatch();
  const [uiState, updateUIState] = useInspectorUIState();

  const showSceneInfoButton = !!sceneInfoContent;
  const isSceneInfoPanelOpen = !!uiState?.sceneInfoPanelVisible;

  // TODO: Remove withSdk
  const handleInspector = useCallback(() => {
    const { debugLayer } = sdk.scene;
    if (debugLayer.isVisible()) {
      debugLayer.hide();
    } else {
      void debugLayer.show({ showExplorer: true, embedMode: true });
    }
  }, [sdk]);

  const handleSaveClick = useCallback(() => dispatch(save()), []);
  const handleUndo = useCallback(() => dispatch(undo()), []);
  const handleRedo = useCallback(() => dispatch(redo()), []);
  const handleToggleSceneInfo = useCallback(() => {
    updateUIState({ sceneInfoPanelVisible: !isSceneInfoPanelOpen });
  }, [isSceneInfoPanelOpen, updateUIState]);

  const handleEditScene = useCallback(async () => {
    sdk.operations.updateSelectedEntity(sdk.engine.RootEntity, false);
    await sdk.operations.dispatch();
  }, [sdk]);

  useHotkey([SAVE, SAVE_ALT], handleSaveClick);
  useHotkey([UNDO, UNDO_ALT], handleUndo);
  useHotkey([REDO, REDO_2, REDO_ALT, REDO_ALT_2], handleRedo);

  return (
    <div className="Toolbar">
      {!isAutosaveEnabled && (
        <ToolbarButton
          className="save"
          onClick={canSave ? handleSaveClick : undefined}
          title={canSave ? 'Save changes' : 'All changes saved'}
        >
          {canSave ? <BiSave /> : <BiBadgeCheck />}
        </ToolbarButton>
      )}
      {!viewportToolbar && (
        <>
          <ToolbarButton
            className="undo"
            onClick={canUndo ? handleUndo : undefined}
            title="Undo"
          >
            <BiUndo />
          </ToolbarButton>
          <ToolbarButton
            className="redo"
            onClick={canRedo ? handleRedo : undefined}
            title="Redo"
          >
            <BiRedo />
          </ToolbarButton>
        </>
      )}
      <Gizmos />
      <Preferences />
      <ToolbarButton
        className="babylonjs-inspector"
        onClick={handleInspector}
        title="Inspector"
      >
        <RiListSettingsLine />
      </ToolbarButton>
      <div className="RightContent">
        {!viewportToolbar && (
          <ToolbarButton
            className="edit-scene"
            onClick={handleEditScene}
            title="Edit Scene"
          >
            <FaPencilAlt />
          </ToolbarButton>
        )}
        {showSceneInfoButton && !viewportToolbar && (
          <ToolbarButton
            className={cx('scene-info', { active: isSceneInfoPanelOpen })}
            onClick={handleToggleSceneInfo}
            title="Scene Info"
          >
            <InfoIcon />
          </ToolbarButton>
        )}
      </div>
    </div>
  );
});

export default Toolbar;
