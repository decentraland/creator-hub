import { useCallback, useState } from 'react';
import { BiCog, BiCheckboxChecked, BiCheckbox } from 'react-icons/bi';
import cx from 'classnames';

import { withSdk } from '../../../hoc/withSdk';
import { ToolbarButton } from '../ToolbarButton';
import { useOutsideClick } from '../../../hooks/useOutsideClick';
import { useXRayToggle, useSelectThroughToggle } from '../../../hooks/editor/useBoxSelection';

import './Preferences.css';
import { useAppSelector, useAppDispatch } from '../../../redux/hooks';
import { selectInspectorPreferences } from '../../../redux/app';
import { setInspectorPreferences } from '../../../redux/data-layer';

export const Preferences = withSdk(({ sdk }) => {
  const [showPanel, setShowPanel] = useState(false);
  const preferences = useAppSelector(selectInspectorPreferences);
  const dispatch = useAppDispatch();
  const { isEnabled: isXRayEnabled, toggle: toggleXRay } = useXRayToggle();
  const { isEnabled: isSelectThroughEnabled, toggle: toggleSelectThrough } =
    useSelectThroughToggle();

  const togglePanel = useCallback(() => {
    setShowPanel(!showPanel);
  }, [showPanel]);
  const handleClosePanel = useCallback(() => setShowPanel(false), []);
  const ref = useOutsideClick(handleClosePanel);

  const toggleFreeCameraInvertRotation = useCallback(() => {
    dispatch(
      setInspectorPreferences({
        freeCameraInvertRotation: !preferences?.freeCameraInvertRotation,
      }),
    );
    // TODO: this should be done by the saga but we dont have the sdk.editorCamera on the store
    sdk.editorCamera.setFreeCameraInvertRotation(!preferences?.freeCameraInvertRotation);
  }, [preferences?.freeCameraInvertRotation]);

  const toggleAutosaveEnabled = useCallback(() => {
    dispatch(setInspectorPreferences({ autosaveEnabled: !preferences?.autosaveEnabled }));
  }, [preferences?.autosaveEnabled]);

  const toggleCameraMode = useCallback(() => {
    const newMode = preferences?.cameraMode === 'free' ? 'orbit' : 'free';
    dispatch(setInspectorPreferences({ cameraMode: newMode }));
    // Hot-switch the camera
    sdk.editorCamera.switchCameraMode(newMode);
  }, [preferences?.cameraMode, sdk]);

  const FreeCameraInvertRotationIcon = preferences?.freeCameraInvertRotation
    ? BiCheckboxChecked
    : BiCheckbox;
  const AutosaveEnabledIcon = preferences?.autosaveEnabled ? BiCheckboxChecked : BiCheckbox;
  const FreeCameraModeIcon = preferences?.cameraMode === 'free' ? BiCheckboxChecked : BiCheckbox;
  const XRayIcon = isXRayEnabled ? BiCheckboxChecked : BiCheckbox;
  const SelectThroughIcon = isSelectThroughEnabled ? BiCheckboxChecked : BiCheckbox;

  return (
    <div
      className="Preferences"
      ref={ref}
    >
      <ToolbarButton
        className="preferences"
        onClick={togglePanel}
        title="Preferences"
      >
        <BiCog />
      </ToolbarButton>
      <div className={cx('panel', { visible: showPanel })}>
        <div className="preference-row">
          <label>Free Camera Mode (WASD)</label>
          <FreeCameraModeIcon
            className="icon"
            onClick={toggleCameraMode}
          />
        </div>
        <div className="preference-row">
          <label>Invert camera rotation</label>
          <FreeCameraInvertRotationIcon
            className="icon"
            onClick={toggleFreeCameraInvertRotation}
          />
        </div>
        <div className="preference-row">
          <label>Enable autosave</label>
          <AutosaveEnabledIcon
            className="icon"
            onClick={toggleAutosaveEnabled}
          />
        </div>
        <div className="preference-row">
          <label>X-Ray</label>
          <XRayIcon
            className="icon"
            onClick={toggleXRay}
            title="Show selected objects through other geometry"
          />
        </div>
        <div className="preference-row">
          <label>Select Through</label>
          <SelectThroughIcon
            className="icon"
            onClick={toggleSelectThrough}
            title="Box selection includes objects behind other objects"
          />
        </div>
      </div>
    </div>
  );
});

export default Preferences;
