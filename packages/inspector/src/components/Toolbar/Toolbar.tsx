import { useCallback, useEffect, useState } from 'react';
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
  setInspectorPreferences,
} from '../../redux/data-layer';
import { selectCanSave, selectInspectorPreferences } from '../../redux/app';
import { getSceneRunStarted, setSceneRunIntent } from '../../redux/ui';
import { useInspectorUIState } from '../../hooks/sdk/useInspectorUIState';
import { useAppSelector, useAppDispatch } from '../../redux/hooks';
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
import { getConfig } from '../../lib/logic/config';
import type { EditorCameraMode } from '../../lib/renderer/types';
import { Dropdown } from '../ui';
import type { Props as OptionProps } from '../ui/Dropdown/Option/types';
import { Gizmos } from './Gizmos';
import {
  CameraIcon,
  ChevronDownIcon,
  EditIcon,
  InteractIcon,
  PauseIcon,
  PlayIcon,
  RedoIcon,
  SaveIcon,
  SoundOffIcon,
  SoundOnIcon,
  StopIcon,
  UndoIcon,
} from './icons';
import { MoreOptions, checkboxIcon as checkbox } from './MoreOptions';
import { ToolbarButton } from './ToolbarButton';

import './Toolbar.css';

const RUN_LABEL = 'Run scene';
const STOP_LABEL = 'Stop and reset scene to its initial state';

const Toolbar = withSdk(({ sdk }) => {
  const canSave = useAppSelector(selectCanSave);
  const preferences = useAppSelector(selectInspectorPreferences);
  const isAutosaveEnabled = preferences?.autosaveEnabled ?? true;
  const canUndo = useAppSelector(selectCanUndo);
  const canRedo = useAppSelector(selectCanRedo);
  const sceneInfoContent = useAppSelector(selectSceneInfo).content;
  const dispatch = useAppDispatch();
  const [uiState, updateUIState] = useInspectorUIState();

  const showSceneInfoButton = !!sceneInfoContent;
  const isSceneInfoPanelOpen = !!uiState?.sceneInfoPanelVisible;

  const handleInspector = useCallback(() => {
    sdk.renderer.debug?.toggle();
  }, [sdk]);

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
  useHotkey([TOGGLE_FREE_CAMERA], handleToggleFreeCamera);
  const handleSetCameraMode = useCallback(
    (mode: EditorCameraMode) => {
      if (!editorCamera || editorCamera.getMode() === mode) return;
      editorCamera.setMode(mode);
    },
    [editorCamera],
  );

  const sceneRun = sdk.renderer.sceneRun;
  const sceneRunStarted = useAppSelector(getSceneRunStarted);
  const [sceneRunning, setSceneRunning] = useState<boolean>(sceneRun?.isRunning() ?? false);
  useEffect(() => {
    if (!sceneRun) return;
    setSceneRunning(sceneRun.isRunning());
    return sceneRun.onRunChange(setSceneRunning);
  }, [sceneRun]);
  const sceneRunPaused = sceneRunStarted && !sceneRunning;
  const handleToggleSceneRun = useCallback(() => {
    if (!sceneRun) return;
    const next = !sceneRun.isRunning();
    dispatch(setSceneRunIntent({ running: next }));
    sceneRun.setRunning(next);
  }, [dispatch, sceneRun]);
  const handleResetScene = useCallback(() => {
    dispatch(setSceneRunIntent({ running: false, reset: true }));
    void sceneRun?.reset();
  }, [dispatch, sceneRun]);

  const interaction = sdk.renderer.interaction;
  const [editingEnabled, setEditingEnabled] = useState<boolean>(
    interaction?.isEditingEnabled() ?? true,
  );
  useEffect(() => {
    if (!interaction) return;
    setEditingEnabled(interaction.isEditingEnabled());
    return interaction.onEditingChange(setEditingEnabled);
  }, [interaction]);
  const handleToggleInteract = useCallback(() => {
    if (!interaction) return;
    interaction.setEditingEnabled(!interaction.isEditingEnabled());
  }, [interaction]);

  const audio = sdk.renderer.audio;
  const [muted, setMuted] = useState<boolean>(audio?.isMuted() ?? false);
  useEffect(() => {
    if (!audio) return;
    setMuted(audio.isMuted());
    return audio.onMuteChange(setMuted);
  }, [audio]);
  const handleToggleMute = useCallback(() => {
    if (!audio) return;
    audio.setMuted(!audio.isMuted());
  }, [audio]);

  const handleSaveClick = useCallback(() => dispatch(save()), []);
  const handleUndo = useCallback(() => dispatch(undo()), [dispatch]);
  const handleRedo = useCallback(() => dispatch(redo()), [dispatch]);
  const handleToggleSceneInfo = useCallback(() => {
    updateUIState({ sceneInfoPanelVisible: !isSceneInfoPanelOpen });
  }, [isSceneInfoPanelOpen, updateUIState]);
  useHotkey([SAVE, SAVE_ALT], handleSaveClick);
  useHotkey([UNDO, UNDO_ALT], handleUndo);
  useHotkey([REDO, REDO_2, REDO_ALT, REDO_ALT_2], handleRedo);

  const invertRotation = !!preferences?.freeCameraInvertRotation;
  const handleToggleInvertRotation = useCallback(() => {
    dispatch(setInspectorPreferences({ freeCameraInvertRotation: !invertRotation }));
    sdk.renderer.camera.setInvertRotation(!invertRotation);
  }, [dispatch, sdk, invertRotation]);
  const handleToggleAutosave = useCallback(() => {
    dispatch(setInspectorPreferences({ autosaveEnabled: !isAutosaveEnabled }));
  }, [dispatch, isAutosaveEnabled]);

  const handleEditScene = useCallback(async () => {
    sdk.operations.updateSelectedEntity(sdk.engine.RootEntity, false);
    await sdk.operations.dispatch();
  }, [sdk]);

  const invertRotationOption: OptionProps = {
    value: 'invert-rotation',
    label: 'Invert Camera Rotation',
    className: 'invert-rotation',
    leftIcon: checkbox(invertRotation),
    selected: invertRotation,
    onClick: handleToggleInvertRotation,
  };

  const isBabylon = getConfig().renderer !== 'bevy';
  const moreOptions: OptionProps[] = [
    {
      value: 'autosave',
      label: 'Enable Autosave',
      leftIcon: checkbox(isAutosaveEnabled),
      selected: isAutosaveEnabled,
      onClick: handleToggleAutosave,
    },
    ...(showSceneInfoButton
      ? [
          {
            value: 'scene-info',
            label: 'Scene Info',
            leftIcon: checkbox(isSceneInfoPanelOpen),
            selected: isSceneInfoPanelOpen,
            onClick: handleToggleSceneInfo,
          },
        ]
      : []),
    ...(isBabylon
      ? [
          invertRotationOption,
          {
            value: 'inspector',
            label: 'Inspector',
            leftIcon: <span className="CheckSpacer" />,
            onClick: handleInspector,
          },
        ]
      : []),
  ];

  return (
    <div className="Toolbar">
      <div className="LeftContent">
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
        <Gizmos />
        {editorCamera && (
          <div className="CameraModeWrap">
            <div className="CameraModeTooltip">
              <strong>Camera Toggle</strong>
              <span>Select if you prefer to move the camera freely or through the player.</span>
            </div>
            <Dropdown
              className="camera-mode"
              value={cameraMode}
              trigger={
                <>
                  <CameraIcon />
                  <span className="CameraModeLabel">
                    {cameraMode === 'free' ? 'Free' : 'Player'}
                  </span>
                  <span className="CameraModeChevron">
                    <ChevronDownIcon />
                  </span>
                </>
              }
              options={[
                {
                  value: 'free',
                  label: 'Free',
                  leftIcon:
                    cameraMode === 'free' ? <CheckIcon /> : <span className="CheckSpacer" />,
                  onClick: () => handleSetCameraMode('free'),
                },
                {
                  value: 'avatar',
                  label: 'Player',
                  leftIcon:
                    cameraMode === 'avatar' ? <CheckIcon /> : <span className="CheckSpacer" />,
                  onClick: () => handleSetCameraMode('avatar'),
                },
                invertRotationOption,
              ]}
            />
          </div>
        )}
        {interaction && (
          <ToolbarButton
            className="interact"
            aria-pressed={!editingEnabled}
            aria-label="Interact with the scene"
            onClick={handleToggleInteract}
            title={
              editingEnabled
                ? 'Interact with the scene — turn off editing so clicks reach the running scene'
                : 'Interacting with the scene — click to re-enable editing'
            }
          >
            <InteractIcon />
          </ToolbarButton>
        )}
        {audio && (
          <ToolbarButton
            className="mute"
            aria-pressed={muted}
            aria-label="Mute scene audio"
            onClick={handleToggleMute}
            title={muted ? 'Unmute scene audio' : 'Mute scene audio'}
          >
            {muted ? <SoundOffIcon /> : <SoundOnIcon />}
          </ToolbarButton>
        )}
      </div>
      {sceneRun && (
        <div className="RuntimeControls">
          <ToolbarButton
            className={sceneRunStarted ? 'scene-reset' : 'scene-run'}
            aria-label={sceneRunStarted ? STOP_LABEL : RUN_LABEL}
            title={sceneRunStarted ? STOP_LABEL : RUN_LABEL}
            onClick={sceneRunStarted ? handleResetScene : handleToggleSceneRun}
          >
            {sceneRunStarted ? <StopIcon /> : <PlayIcon />}
          </ToolbarButton>
          <ToolbarButton
            className={cx('scene-pause', { running: sceneRunStarted && sceneRunning })}
            aria-label={sceneRunPaused ? 'Resume scene' : 'Pause scene'}
            title={sceneRunPaused ? 'Resume scene' : 'Pause scene'}
            disabled={!sceneRunStarted}
            onClick={handleToggleSceneRun}
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
        {!isAutosaveEnabled && (
          <ToolbarButton
            className="save"
            onClick={canSave ? handleSaveClick : undefined}
            title={canSave ? 'Save changes' : 'All changes saved'}
          >
            <SaveIcon />
          </ToolbarButton>
        )}
        <MoreOptions options={moreOptions} />
      </div>
    </div>
  );
});

export default Toolbar;
