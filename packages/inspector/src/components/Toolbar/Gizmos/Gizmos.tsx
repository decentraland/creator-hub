import React, { useCallback, useEffect, useState } from 'react';
import { BsCaretDown } from 'react-icons/bs';
import { BiCheckbox, BiCheckboxChecked } from 'react-icons/bi';
import cx from 'classnames';

import { withSdk } from '../../../hoc/withSdk';
import { useComponentValue } from '../../../hooks/sdk/useComponentValue';
import { useSelectedEntity } from '../../../hooks/sdk/useSelectedEntity';
import { useOutsideClick } from '../../../hooks/useOutsideClick';
import { useHotkey } from '../../../hooks/useHotkey';
import { useSnapToggle } from '../../../hooks/editor/useSnap';
import { useGizmoAlignment } from '../../../hooks/editor/useGizmoAlignment';
import { ROOT } from '../../../lib/sdk/tree';
import { GizmoType } from '../../../lib/utils/gizmo';
import { ToolbarButton } from '../ToolbarButton';
import { Snap } from './Snap';
import { useAppSelector } from '../../../redux/hooks';
import { selectInspectorPreferences } from '../../../redux/app';

import './Gizmos.css';

export const Gizmos = withSdk(({ sdk }) => {
  const [showPanel, setShowPanel] = useState(false);
  const { isEnabled, toggle } = useSnapToggle();
  const preferences = useAppSelector(selectInspectorPreferences);

  const handleClosePanel = useCallback(() => setShowPanel(false), []);
  const handleTogglePanel = useCallback(() => setShowPanel(!showPanel), [showPanel]);

  const entity = useSelectedEntity();

  const [selection, setSelection] = useComponentValue(entity || ROOT, sdk.components.Selection);

  const handlePositionGizmo = useCallback(
    () =>
      setSelection({
        gizmo: selection.gizmo !== GizmoType.POSITION ? GizmoType.POSITION : GizmoType.FREE,
      }),
    [selection, setSelection],
  );
  const handleRotationGizmo = useCallback(
    () =>
      setSelection({
        gizmo: selection.gizmo !== GizmoType.ROTATION ? GizmoType.ROTATION : GizmoType.FREE,
      }),
    [selection, setSelection],
  );
  const handleScaleGizmo = useCallback(
    () =>
      setSelection({
        gizmo: selection.gizmo !== GizmoType.SCALE ? GizmoType.SCALE : GizmoType.FREE,
      }),
    [selection, setSelection],
  );

  const handleFreeGizmo = useCallback(
    () => setSelection({ gizmo: GizmoType.FREE }),
    [selection, setSelection],
  );

  // Camera mode determines which hotkeys to use for gizmos
  // Orbit mode: W/E/R/Q (no conflict with camera)
  // Free Camera mode: M/R/X/F (legacy keys - no conflict with WASD movement)
  const isOrbitMode = preferences?.cameraMode !== 'free';

  // Orbit Camera hotkeys: W/E/R/Q
  useHotkey(['W'], isOrbitMode ? handlePositionGizmo : () => {});
  useHotkey(['E'], isOrbitMode ? handleRotationGizmo : () => {});
  useHotkey(['Q'], isOrbitMode ? handleFreeGizmo : () => {});

  // R key works in both modes (Scale in Orbit, Rotate in Free Camera)
  useHotkey(['R'], isOrbitMode ? handleScaleGizmo : handleRotationGizmo);

  // Free Camera hotkeys: M/X/F (legacy - no conflict with WASD)
  useHotkey(['M'], !isOrbitMode ? handlePositionGizmo : () => {});
  useHotkey(['X'], !isOrbitMode ? handleScaleGizmo : () => {});
  useHotkey(['F'], !isOrbitMode ? handleFreeGizmo : () => {});

  const { isGizmoWorldAligned, setGizmoWorldAligned } = useGizmoAlignment();

  const disableGizmos = !entity;

  const SnapToggleIcon = isEnabled ? BiCheckboxChecked : BiCheckbox;
  const WorldAlignmentIcon = isGizmoWorldAligned ? BiCheckboxChecked : BiCheckbox;

  const ref = useOutsideClick(handleClosePanel);

  useEffect(() => {
    setShowPanel(false);
  }, [selection]);

  return (
    <div
      className="Gizmos"
      ref={ref}
    >
      <ToolbarButton
        className={cx('gizmo free', { active: selection?.gizmo === GizmoType.FREE })}
        disabled={disableGizmos}
        onClick={handleFreeGizmo}
        title="Free movement tool"
      />
      <ToolbarButton
        className={cx('gizmo position', { active: selection?.gizmo === GizmoType.POSITION })}
        disabled={disableGizmos}
        onClick={handlePositionGizmo}
        title="Translation tool"
      />
      <ToolbarButton
        className={cx('gizmo rotation', { active: selection?.gizmo === GizmoType.ROTATION })}
        disabled={disableGizmos}
        onClick={handleRotationGizmo}
        title="Rotation tool"
      />
      <ToolbarButton
        className={cx('gizmo scale', { active: selection?.gizmo === GizmoType.SCALE })}
        disabled={disableGizmos}
        onClick={handleScaleGizmo}
        title="Scaling tool"
      />
      <BsCaretDown
        className="open-panel"
        onClick={handleTogglePanel}
      />
      <div className={cx('panel', { visible: showPanel })}>
        <div className="title">
          <label>Snap</label>
          <SnapToggleIcon
            className="icon"
            onClick={toggle}
          />
        </div>
        <div className="snaps">
          <Snap gizmo={GizmoType.POSITION} />
          <Snap gizmo={GizmoType.ROTATION} />
          <Snap gizmo={GizmoType.SCALE} />
        </div>
        <div className="title">
          <label>Align to world</label>
          <WorldAlignmentIcon
            className="icon"
            onClick={() => setGizmoWorldAligned(!isGizmoWorldAligned)}
          />
        </div>
      </div>
    </div>
  );
});

export default React.memo(Gizmos);
