import { useCallback } from 'react';

import { withSdk } from '../../../hoc/withSdk';
import { getSceneClient } from '../../../lib/rpc/scene';
import { selectSceneInfo } from '../../../redux/data-layer';
import { useInspectorUIState } from '../../../hooks/sdk/useInspectorUIState';
import { useAppSelector, useAppDispatch } from '../../../redux/hooks';
import {
  getSceneRunIntent,
  getSceneRunStarted,
  setSceneRunIntent,
  togglePanel,
} from '../../../redux/ui';
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
import { EditIcon, PauseIcon, PlayIcon, RedoIcon, StopIcon, UndoIcon } from '../../Toolbar/icons';
import { MoreOptions, checkboxIcon } from '../../Toolbar/MoreOptions';
import { ToolbarButton } from '../../Toolbar/ToolbarButton';
import { Tools } from './Tools';

import '../../Toolbar/Toolbar.css';

const RUN_LABEL = 'Run scene';
const STOP_LABEL = 'Stop and reset scene to its initial state';

const UIDesignerToolbar = withSdk(({ sdk }) => {
  const { canUndo, canRedo } = useCodeState();
  const sceneInfoContent = useAppSelector(selectSceneInfo).content;
  const dispatch = useAppDispatch();
  const [uiState, updateUIState] = useInspectorUIState();

  const showSceneInfoButton = !!sceneInfoContent;
  const isSceneInfoPanelOpen = !!uiState?.sceneInfoPanelVisible;
  const sceneRun = sdk.renderer.sceneRun;
  const sceneRunning = useAppSelector(getSceneRunIntent);
  const sceneRunStarted = useAppSelector(getSceneRunStarted);
  const sceneRunPaused = sceneRunStarted && !sceneRunning;

  const handleUndo = useCallback(() => {
    void undoCode();
  }, []);
  const handleRedo = useCallback(() => {
    void redoCode();
  }, []);
  useHotkey([UNDO, UNDO_ALT], handleUndo);
  useHotkey([REDO, REDO_2, REDO_ALT, REDO_ALT_2], handleRedo);

  const leaveUIDesigner = useCallback(() => {
    dispatch(togglePanel({ panel: PanelName.UI_DESIGNER, enabled: false }));
    void getSceneClient()?.setUiDesignerMode(false).catch(console.error);
  }, [dispatch]);
  const handlePlay = useCallback(() => {
    dispatch(setSceneRunIntent({ running: true }));
    leaveUIDesigner();
    sceneRun?.setRunning(true);
  }, [dispatch, leaveUIDesigner, sceneRun]);
  const handlePause = useCallback(() => {
    dispatch(setSceneRunIntent({ running: false }));
    sceneRun?.setRunning(false);
  }, [dispatch, sceneRun]);
  const handleStop = useCallback(() => {
    dispatch(setSceneRunIntent({ running: false, reset: true }));
    void sceneRun?.reset();
  }, [dispatch, sceneRun]);
  const handleEditScene = useCallback(async () => {
    leaveUIDesigner();
    sdk.operations.updateSelectedEntity(sdk.engine.RootEntity, false);
    await sdk.operations.dispatch();
  }, [leaveUIDesigner, sdk]);

  const handleToggleSceneInfo = useCallback(() => {
    updateUIState({ sceneInfoPanelVisible: !isSceneInfoPanelOpen });
  }, [isSceneInfoPanelOpen, updateUIState]);

  return (
    <div className="Toolbar ui-designer-toolbar">
      <ToolbarButton
        className="undo"
        title="Undo"
        disabled={!canUndo}
        onClick={canUndo ? handleUndo : undefined}
      >
        <UndoIcon />
      </ToolbarButton>
      <ToolbarButton
        className="redo"
        title="Redo"
        disabled={!canRedo}
        onClick={canRedo ? handleRedo : undefined}
      >
        <RedoIcon />
      </ToolbarButton>
      <Tools />
      {sceneRun && (
        <div className="RuntimeControls">
          <ToolbarButton
            className={sceneRunStarted ? 'scene-reset' : 'scene-run'}
            aria-label={sceneRunStarted ? STOP_LABEL : RUN_LABEL}
            title={sceneRunStarted ? STOP_LABEL : RUN_LABEL}
            onClick={sceneRunStarted ? handleStop : handlePlay}
          >
            {sceneRunStarted ? <StopIcon /> : <PlayIcon />}
          </ToolbarButton>
          <ToolbarButton
            className="scene-pause"
            aria-label="Pause scene"
            aria-pressed={sceneRunPaused}
            title={sceneRunPaused ? 'Resume scene' : 'Pause scene'}
            disabled={!sceneRunStarted}
            onClick={sceneRunPaused ? handlePlay : handlePause}
          >
            <PauseIcon />
          </ToolbarButton>
        </div>
      )}
      <div className="RightContent">
        <ToolbarButton
          className="edit-scene"
          onClick={handleEditScene}
          title="Edit Scene"
        >
          <EditIcon />
        </ToolbarButton>
        {showSceneInfoButton && (
          <MoreOptions
            options={[
              {
                value: 'scene-info',
                label: 'Scene Info',
                leftIcon: checkboxIcon(isSceneInfoPanelOpen),
                selected: isSceneInfoPanelOpen,
                onClick: handleToggleSceneInfo,
              },
            ]}
          />
        )}
      </div>
    </div>
  );
});

export default UIDesignerToolbar;
