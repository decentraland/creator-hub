import { useCallback, useEffect, useState } from 'react';
import {
  BiUndo,
  BiRedo,
  BiSave,
  BiBadgeCheck,
  BiVideo,
  BiWalk,
  BiChevronDown,
  BiPlay,
  BiPause,
  BiStop,
} from 'react-icons/bi';
import { RiListSettingsLine } from 'react-icons/ri';
import { FaPencilAlt } from 'react-icons/fa';
import { AiOutlineInfoCircle as InfoIcon } from 'react-icons/ai';
import { IoCheckmark as CheckIcon } from 'react-icons/io5';
import cx from 'classnames';

import { withSdk } from '../../hoc/withSdk';
import {
  save,
  undo,
  redo,
  selectCanRedo,
  selectCanUndo,
  selectSceneInfo,
} from '../../redux/data-layer';
import { selectCanSave, selectInspectorPreferences } from '../../redux/app';
import { useInspectorUIState } from '../../hooks/sdk/useInspectorUIState';
import { useAppSelector, useAppDispatch } from '../../redux/hooks';
import { getHiddenPanels } from '../../redux/ui';
import { PanelName } from '../../redux/ui/types';
import {
  REDO,
  REDO_2,
  REDO_ALT,
  REDO_ALT_2,
  SAVE,
  SAVE_ALT,
  TOGGLE_FREE_CAMERA,
  UNDO,
  UNDO_ALT,
  useHotkey,
} from '../../hooks/useHotkey';
import type { EditorCameraMode } from '../../lib/renderer/types';
import { Dropdown } from '../ui';
import { redoCode, undoCode, useCodeState } from '../UIDesigner/code/store';
import { Gizmos } from './Gizmos';
import { Preferences } from './Preferences';
import { ToolbarButton } from './ToolbarButton';

import './Toolbar.css';

const Toolbar = withSdk(({ sdk }) => {
  const canSave = useAppSelector(selectCanSave);
  const preferences = useAppSelector(selectInspectorPreferences);
  const isAutosaveEnabled = preferences?.autosaveEnabled ?? true;
  const dataCanUndo = useAppSelector(selectCanUndo);
  const dataCanRedo = useAppSelector(selectCanRedo);
  const { canUndo: codeCanUndo, canRedo: codeCanRedo } = useCodeState();
  const sceneInfoContent = useAppSelector(selectSceneInfo).content;
  const hiddenPanels = useAppSelector(getHiddenPanels);
  const dispatch = useAppDispatch();
  const [uiState, updateUIState] = useInspectorUIState();

  const showSceneInfoButton = !!sceneInfoContent;
  const isSceneInfoPanelOpen = !!uiState?.sceneInfoPanelVisible;
  const isUIDesignerOpen = !hiddenPanels[PanelName.UI_DESIGNER];

  // With the UI Designer open, undo/redo operate on the code store's splice
  // history (the .tsx source snapshots); otherwise on the 3D scene's CRDT
  // history. One owner per mode — buttons AND hotkeys route the same way.
  const canUndo = isUIDesignerOpen ? codeCanUndo : dataCanUndo;
  const canRedo = isUIDesignerOpen ? codeCanRedo : dataCanRedo;

  // TODO: Remove withSdk
  const handleInspector = useCallback(() => {
    sdk.renderer.debug?.toggle();
  }, [sdk]);

  // Editor camera toggle — only for renderers whose native camera isn't already a
  // free editor camera (Bevy exposes `editorCamera`; Babylon omits it). Tracks the
  // mode so the button reflects on/off, and stays in sync if the mode changes
  // elsewhere.
  const editorCamera = sdk.renderer.editorCamera;
  const [cameraMode, setCameraMode] = useState<EditorCameraMode>(
    editorCamera?.getMode() ?? 'avatar',
  );
  useEffect(() => {
    if (!editorCamera) return;
    setCameraMode(editorCamera.getMode());
    return editorCamera.onModeChange(setCameraMode);
  }, [editorCamera]);
  const handleToggleFreeCamera = useCallback(() => {
    if (!editorCamera) return;
    editorCamera.setMode(editorCamera.getMode() === 'free' ? 'avatar' : 'free');
  }, [editorCamera]);
  // Same reasoning as the Renderer's camera keys: bare backtick, and there is no
  // scene camera to steer in 2D (the button itself is already hidden below).
  useHotkey([TOGGLE_FREE_CAMERA], handleToggleFreeCamera, undefined, {
    enabled: !isUIDesignerOpen,
  });
  const handleSetCameraMode = useCallback(
    (mode: EditorCameraMode) => {
      if (!editorCamera || editorCamera.getMode() === mode) return;
      editorCamera.setMode(mode);
    },
    [editorCamera],
  );

  // Scene run/freeze toggle — only for renderers that execute the scene's SDK7
  // code (Bevy exposes `sceneRun`; Babylon omits it). The editor default is
  // frozen (static); this runs it live so the user can test it.
  const sceneRun = sdk.renderer.sceneRun;
  const [sceneRunning, setSceneRunning] = useState<boolean>(sceneRun?.isRunning() ?? false);
  useEffect(() => {
    if (!sceneRun) return;
    setSceneRunning(sceneRun.isRunning());
    return sceneRun.onRunChange(setSceneRunning);
  }, [sceneRun]);
  const handleToggleSceneRun = useCallback(() => {
    if (!sceneRun) return;
    sceneRun.setRunning(!sceneRun.isRunning());
  }, [sceneRun]);
  const handleResetScene = useCallback(() => {
    void sceneRun?.reset();
  }, [sceneRun]);

  const handleSaveClick = useCallback(() => dispatch(save()), []);
  const handleUndo = useCallback(() => {
    if (isUIDesignerOpen) void undoCode();
    else dispatch(undo());
  }, [isUIDesignerOpen]);
  const handleRedo = useCallback(() => {
    if (isUIDesignerOpen) void redoCode();
    else dispatch(redo());
  }, [isUIDesignerOpen]);
  const handleToggleSceneInfo = useCallback(() => {
    updateUIState({ sceneInfoPanelVisible: !isSceneInfoPanelOpen });
  }, [isSceneInfoPanelOpen, updateUIState]);
  useHotkey([SAVE, SAVE_ALT], handleSaveClick);
  useHotkey([UNDO, UNDO_ALT], handleUndo);
  useHotkey([REDO, REDO_2, REDO_ALT, REDO_ALT_2], handleRedo);

  const handleEditScene = useCallback(async () => {
    sdk.operations.updateSelectedEntity(sdk.engine.RootEntity, false);
    await sdk.operations.dispatch();
  }, [sdk]);

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
      <ToolbarButton
        className="undo"
        title="Undo"
        disabled={!canUndo}
        onClick={canUndo ? handleUndo : undefined}
      >
        <BiUndo />
      </ToolbarButton>
      <ToolbarButton
        className="redo"
        title="Redo"
        disabled={!canRedo}
        onClick={canRedo ? handleRedo : undefined}
      >
        <BiRedo />
      </ToolbarButton>
      {/* UI Designer uses direct-manipulation canvas editing (drag = move,
          border handles = resize) — no move/resize mode toggle, so the tool
          buttons are gone and only the 3D scene's Gizmos remain (hidden while
          the designer is open). The camera-mode toggle is 3D-only for the same
          reason: there is no scene camera to steer in 2D. */}
      {isUIDesignerOpen ? null : <Gizmos />}
      {editorCamera && !isUIDesignerOpen && (
        <div className="CameraModeWrap">
          {/* CSS-only tooltip (a hover React-state tooltip would remount the
              dropdown and eat its click). Matches the design's title + hint. */}
          <div className="CameraModeTooltip">
            <strong>Camera Toggle</strong>
            <span>Select if you prefer to move the camera freely or through the player.</span>
          </div>
          <Dropdown
            className="camera-mode"
            value={cameraMode}
            trigger={
              <>
                {cameraMode === 'free' ? <BiVideo /> : <BiWalk />}
                <span className="CameraModeLabel">{cameraMode === 'free' ? 'Free' : 'Player'}</span>
                <BiChevronDown className="CameraModeChevron" />
              </>
            }
            options={[
              {
                value: 'free',
                label: 'Free',
                // A custom trigger suppresses the Dropdown's built-in selected
                // checkmark, so surface it via leftIcon (a spacer keeps the labels
                // aligned when the option isn't the active one).
                leftIcon: cameraMode === 'free' ? <CheckIcon /> : <span className="CheckSpacer" />,
                onClick: () => handleSetCameraMode('free'),
              },
              {
                value: 'avatar',
                label: 'Player',
                leftIcon:
                  cameraMode === 'avatar' ? <CheckIcon /> : <span className="CheckSpacer" />,
                onClick: () => handleSetCameraMode('avatar'),
              },
            ]}
          />
        </div>
      )}
      {/* Run / Stop drive the 3D scene's SDK7 execution, which 2D has nothing to
          say about — the designer edits .tsx on disk. 3D-only for the same reason
          as the rest of the chrome below. */}
      {sceneRun && !isUIDesignerOpen && (
        <>
          <ToolbarButton
            className={cx('scene-run', { active: sceneRunning })}
            onClick={handleToggleSceneRun}
            title={sceneRunning ? 'Pause scene' : 'Run scene'}
          >
            {sceneRunning ? <BiPause /> : <BiPlay />}
          </ToolbarButton>
          <ToolbarButton
            className="scene-reset"
            onClick={handleResetScene}
            title="Stop and reset scene to its initial state"
          >
            <BiStop />
          </ToolbarButton>
        </>
      )}
      {/* 3D-only chrome. Preferences offers camera-rotation (no scene camera in
          2D) and autosave (code mode writes each splice straight to disk, so the
          ECS save path never runs); the renderer debug inspector has no 2D
          counterpart. Both are inert while the designer is open. */}
      {!isUIDesignerOpen && (
        <>
          <Preferences />
          <ToolbarButton
            className="babylonjs-inspector"
            onClick={handleInspector}
            title="Inspector"
          >
            <RiListSettingsLine />
          </ToolbarButton>
        </>
      )}
      <div className="RightContent">
        {/* Selects the scene ROOT entity so EntityInspector shows scene settings —
            but the right rail is UIDesignerRightRail in 2D, so it does nothing. */}
        {!isUIDesignerOpen && (
          <ToolbarButton
            className="edit-scene"
            onClick={handleEditScene}
            title="Edit Scene"
          >
            <FaPencilAlt />
          </ToolbarButton>
        )}
        {showSceneInfoButton && (
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
