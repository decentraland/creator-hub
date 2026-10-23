import React, { useCallback, useEffect, useRef, useState } from 'react';
import cx from 'classnames';

import { withSdk } from '../../../hoc/withSdk';
import { useComponentValue } from '../../../hooks/sdk/useComponentValue';
import { useSelectedEntity } from '../../../hooks/sdk/useSelectedEntity';
import { useOutsideClick } from '../../../hooks/useOutsideClick';
import { useSnapToggle } from '../../../hooks/editor/useSnap';
import { useGizmoAlignment } from '../../../hooks/editor/useGizmoAlignment';
import { ROOT } from '../../../lib/sdk/tree';
import { GizmoType } from '../../../lib/utils/gizmo';
import {
  AlignWorldIcon,
  ChevronDownIcon,
  GizmoMoveIcon,
  GizmoRotateIcon,
  GizmoScaleIcon,
  GizmoSelectIcon,
  SnapIcon,
} from '../icons';
import { ToolbarButton } from '../ToolbarButton';
import { Snap } from './Snap';

import './Gizmos.css';

export const Gizmos = withSdk(({ sdk }) => {
  const [showPanel, setShowPanel] = useState(false);
  const { isEnabled, toggle } = useSnapToggle();

  const handleClosePanel = useCallback(() => setShowPanel(false), []);
  const handleTogglePanel = useCallback(() => setShowPanel(!showPanel), [showPanel]);
  const snapRef = useRef<HTMLButtonElement>(null);
  const caretRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const entity = useSelectedEntity();

  const spawnPointManager = sdk.renderer.spawnPoints;
  const [isSpawnAreaSelected, setIsSpawnAreaSelected] = useState(
    () => spawnPointManager.getSelectedIndex() !== null,
  );

  useEffect(() => {
    const unsubscribe = spawnPointManager.onSelectionChange(({ index }) => {
      setIsSpawnAreaSelected(index !== null);
    });
    return () => unsubscribe();
  }, [spawnPointManager]);

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

  const { isGizmoWorldAligned, setGizmoWorldAligned } = useGizmoAlignment();

  const disableGizmos = !entity || isSpawnAreaSelected;

  const ref = useOutsideClick(handleClosePanel);

  useEffect(() => {
    setShowPanel(false);
  }, [selection]);

  useEffect(() => {
    if (isEnabled) return;
    if (panelRef.current?.contains(document.activeElement)) snapRef.current?.focus();
    setShowPanel(false);
  }, [isEnabled]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'Escape' || !showPanel) return;
      setShowPanel(false);
      caretRef.current?.focus();
    },
    [showPanel],
  );

  return (
    <div
      className="Gizmos"
      ref={ref}
      onKeyDown={handleKeyDown}
    >
      <ToolbarButton
        className="gizmo free"
        aria-pressed={selection?.gizmo === GizmoType.FREE && !isSpawnAreaSelected}
        disabled={disableGizmos}
        onClick={handleFreeGizmo}
        title="Free movement tool"
      >
        <GizmoSelectIcon />
      </ToolbarButton>
      <ToolbarButton
        className="gizmo position"
        aria-pressed={selection?.gizmo === GizmoType.POSITION || isSpawnAreaSelected}
        disabled={disableGizmos}
        onClick={handlePositionGizmo}
        title="Translation tool"
      >
        <GizmoMoveIcon />
      </ToolbarButton>
      <ToolbarButton
        className="gizmo rotation"
        aria-pressed={selection?.gizmo === GizmoType.ROTATION && !isSpawnAreaSelected}
        disabled={disableGizmos}
        onClick={handleRotationGizmo}
        title="Rotation tool"
      >
        <GizmoRotateIcon />
      </ToolbarButton>
      <ToolbarButton
        className="gizmo scale"
        aria-pressed={selection?.gizmo === GizmoType.SCALE && !isSpawnAreaSelected}
        disabled={disableGizmos}
        onClick={handleScaleGizmo}
        title="Scaling tool"
      >
        <GizmoScaleIcon />
      </ToolbarButton>
      <ToolbarButton
        ref={snapRef}
        className="snap"
        aria-pressed={isEnabled}
        title="Snap"
        onClick={toggle}
      >
        <SnapIcon />
      </ToolbarButton>
      <ToolbarButton
        className="align-world"
        aria-pressed={isGizmoWorldAligned}
        title="Align to world"
        onClick={() => setGizmoWorldAligned(!isGizmoWorldAligned)}
      >
        <AlignWorldIcon />
      </ToolbarButton>
      {isEnabled && (
        <button
          ref={caretRef}
          type="button"
          className="open-panel"
          aria-label="Snap increments"
          aria-expanded={showPanel}
          onClick={handleTogglePanel}
        >
          <ChevronDownIcon />
        </button>
      )}
      <div
        ref={panelRef}
        className={cx('panel', { visible: showPanel && isEnabled })}
      >
        <div className="snaps">
          <Snap gizmo={GizmoType.POSITION} />
          <Snap gizmo={GizmoType.ROTATION} />
          <Snap gizmo={GizmoType.SCALE} />
        </div>
      </div>
    </div>
  );
});

export default React.memo(Gizmos);
