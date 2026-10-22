import { useCallback } from 'react';
import { BiUndo, BiRedo, BiBadgeCheck, BiPlay, BiPause, BiStop } from 'react-icons/bi';
import { AiOutlineInfoCircle as InfoIcon } from 'react-icons/ai';

import { withSdk } from '../../../hoc/withSdk';
import { getSceneClient } from '../../../lib/rpc/scene';
import { selectSceneInfo } from '../../../redux/data-layer';
import { useInspectorUIState } from '../../../hooks/sdk/useInspectorUIState';
import { useAppSelector, useAppDispatch } from '../../../redux/hooks';
import { getSceneRunIntent, setSceneRunIntent, togglePanel } from '../../../redux/ui';
import { PanelName } from '../../../redux/ui/types';
import {
  REDO,
  REDO_2,
  REDO_ALT,
  REDO_ALT_2,
  UNDO,
  UNDO_ALT,
  useHotkey,
} from '../../../hooks/useHotkey';
import { redoCode, undoCode, useCodeState } from '../code/store';
import { ToolbarButton } from '../../Toolbar/ToolbarButton';
import { Tools } from './Tools';

import '../../Toolbar/Toolbar.css';

const UIDesignerToolbar = withSdk(({ sdk }) => {
  const { canUndo, canRedo } = useCodeState();
  const sceneInfoContent = useAppSelector(selectSceneInfo).content;
  const dispatch = useAppDispatch();
  const [uiState, updateUIState] = useInspectorUIState();

  const showSceneInfoButton = !!sceneInfoContent;
  const isSceneInfoPanelOpen = !!uiState?.sceneInfoPanelVisible;
  const sceneRun = sdk.renderer.sceneRun;
  const sceneRunning = useAppSelector(getSceneRunIntent);

  const handleUndo = useCallback(() => {
    void undoCode();
  }, []);
  const handleRedo = useCallback(() => {
    void redoCode();
  }, []);
  useHotkey([UNDO, UNDO_ALT], handleUndo);
  useHotkey([REDO, REDO_2, REDO_ALT, REDO_ALT_2], handleRedo);

  const handlePlay = useCallback(() => {
    dispatch(setSceneRunIntent({ running: true }));
    dispatch(togglePanel({ panel: PanelName.UI_DESIGNER, enabled: false }));
    void getSceneClient()?.setUiDesignerMode(false).catch(console.error);
    sceneRun?.setRunning(true);
  }, [dispatch, sceneRun]);
  const handlePause = useCallback(() => {
    dispatch(setSceneRunIntent({ running: false }));
    sceneRun?.setRunning(false);
  }, [dispatch, sceneRun]);
  const handleStop = useCallback(() => {
    dispatch(setSceneRunIntent({ running: false }));
    void sceneRun?.reset();
  }, [dispatch, sceneRun]);

  const handleToggleSceneInfo = useCallback(() => {
    updateUIState({ sceneInfoPanelVisible: !isSceneInfoPanelOpen });
  }, [isSceneInfoPanelOpen, updateUIState]);

  return (
    <div className="Toolbar ui-designer-toolbar">
      <ToolbarButton
        className="save ui-designer-icon-btn"
        disabled
        title="All changes saved"
      >
        <BiBadgeCheck />
      </ToolbarButton>
      <ToolbarButton
        className="undo ui-designer-icon-btn"
        title="Undo"
        disabled={!canUndo}
        onClick={canUndo ? handleUndo : undefined}
      >
        <BiUndo />
      </ToolbarButton>
      <ToolbarButton
        className="redo ui-designer-icon-btn"
        title="Redo"
        disabled={!canRedo}
        onClick={canRedo ? handleRedo : undefined}
      >
        <BiRedo />
      </ToolbarButton>
      <Tools />
      {sceneRun && (
        <>
          <ToolbarButton
            className="scene-run ui-designer-toggle"
            aria-pressed={sceneRunning}
            aria-label="Run scene"
            onClick={sceneRunning ? handlePause : handlePlay}
            title={sceneRunning ? 'Pause scene' : 'Run scene'}
          >
            {sceneRunning ? <BiPause /> : <BiPlay />}
          </ToolbarButton>
          <ToolbarButton
            className="scene-reset ui-designer-icon-btn"
            onClick={handleStop}
            title="Stop and reset scene to its initial state"
          >
            <BiStop />
          </ToolbarButton>
        </>
      )}
      <div className="RightContent">
        {showSceneInfoButton && (
          <ToolbarButton
            className="scene-info ui-designer-toggle"
            aria-pressed={isSceneInfoPanelOpen}
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

export default UIDesignerToolbar;
