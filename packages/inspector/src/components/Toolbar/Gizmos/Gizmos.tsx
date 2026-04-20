import React, { useCallback, useEffect, useState } from 'react';
import { BsMagnet, BsChevronRight, BsX, BsGlobe, BsGrid3X3 } from 'react-icons/bs';
import { Vector3 as BabylonVector3, Ray, TransformNode } from '@babylonjs/core';
import cx from 'classnames';

import { withSdk } from '../../../hoc/withSdk';
import { useComponentValue } from '../../../hooks/sdk/useComponentValue';
import { useSelectedEntity } from '../../../hooks/sdk/useSelectedEntity';
import { useHotkey } from '../../../hooks/useHotkey';
import { useObjectSnapToggle, useSnapToggle } from '../../../hooks/editor/useSnap';
import { useGizmoAlignment } from '../../../hooks/editor/useGizmoAlignment';
import { ROOT } from '../../../lib/sdk/tree';
import { GizmoType } from '../../../lib/utils/gizmo';
import { TransformUtils } from '../../../lib/babylon/decentraland/gizmos/utils';
import { ToolbarButton } from '../ToolbarButton';
import { Snap } from './Snap';

import './Gizmos.css';

export const Gizmos = withSdk(({ sdk }) => {
  const [showPanel, setShowPanel] = useState(false);
  const { isEnabled, toggle } = useSnapToggle();
  const { isEnabled: isObjectSnapEnabled, toggle: toggleObjectSnap } = useObjectSnapToggle();

  const handleTogglePanel = useCallback(() => setShowPanel(prev => !prev), []);

  const entity = useSelectedEntity();

  const spawnPointManager = sdk.sceneContext.spawnPoints;
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

  const handleSnapToFloor = useCallback(async () => {
    if (!entity) return;

    const ecsEntity = sdk.sceneContext.getEntityOrNull(entity);
    if (!ecsEntity) return;

    const boundingBox = ecsEntity.getGroupMeshesBoundingBox();
    if (!boundingBox) return;

    const absPos = ecsEntity.getAbsolutePosition();
    const bbMin = boundingBox.boundingBox.minimumWorld;
    const bbMax = boundingBox.boundingBox.maximumWorld;
    const bottomWorldY = bbMin.y;
    const offsetY = absPos.y - bottomWorldY;

    const ownMeshes = new Set(
      ecsEntity.gltfContainer
        ? ecsEntity.gltfContainer.getChildMeshes(false)
        : ecsEntity.getChildMeshes(false),
    );

    // Cast a 3x3 grid of rays across the bounding box XZ footprint.
    // Start from ABOVE the entity (bbMax.y + margin) so the ray always crosses
    // the floor — even when the entity is partially clipping below it.
    // Take the highest hit so the object rests on the surface without clipping.
    const GRID = 3;
    let highestHitY = -Infinity;
    const rayStartY = bbMax.y + 0.001;

    for (let xi = 0; xi < GRID; xi++) {
      for (let zi = 0; zi < GRID; zi++) {
        const tx = xi / (GRID - 1);
        const tz = zi / (GRID - 1);
        const rx = bbMin.x + tx * (bbMax.x - bbMin.x);
        const rz = bbMin.z + tz * (bbMax.z - bbMin.z);

        const rayOrigin = new BabylonVector3(rx, rayStartY, rz);
        const ray = new Ray(rayOrigin, BabylonVector3.Down(), 1000);
        // Do NOT filter by isPickable — the editor floor (EnvironmentHelper ground)
        // has isPickable=false but is a valid snap target.
        const hit = sdk.scene.pickWithRay(ray, mesh => !ownMeshes.has(mesh));

        if (hit?.pickedPoint && hit.pickedPoint.y > highestHitY) {
          highestHitY = hit.pickedPoint.y;
        }
      }
    }

    // Fall back to world Y=0 (the scene floor) when no mesh surface was found below.
    if (highestHitY === -Infinity) highestHitY = 0;

    const newWorldY = highestHitY + offsetY;
    const parent = ecsEntity.parent instanceof TransformNode ? ecsEntity.parent : null;
    const newLocalPos = TransformUtils.convertToLocalPosition(
      new BabylonVector3(absPos.x, newWorldY, absPos.z),
      parent,
    );

    sdk.operations.updateValue(sdk.components.Transform, entity, {
      position: { x: newLocalPos.x, y: newLocalPos.y, z: newLocalPos.z },
    });
    await sdk.operations.dispatch();
  }, [entity, sdk]);

  const disableGizmos = !entity || isSpawnAreaSelected;

  useHotkey(
    ['1'],
    disableGizmos
      ? () => {}
      : () => {
          if (selection?.gizmo !== GizmoType.FREE) handleFreeGizmo();
        },
  );
  useHotkey(
    ['2'],
    disableGizmos
      ? () => {}
      : () => {
          if (selection?.gizmo !== GizmoType.POSITION) handlePositionGizmo();
        },
  );
  useHotkey(
    ['3'],
    disableGizmos
      ? () => {}
      : () => {
          if (selection?.gizmo !== GizmoType.ROTATION) handleRotationGizmo();
        },
  );
  useHotkey(
    ['4'],
    disableGizmos
      ? () => {}
      : () => {
          if (selection?.gizmo !== GizmoType.SCALE) handleScaleGizmo();
        },
  );

  return (
    <>
      <div className="Gizmos">
        <ToolbarButton
          className={cx('gizmo free', {
            active: selection?.gizmo === GizmoType.FREE && !isSpawnAreaSelected,
          })}
          disabled={disableGizmos}
          onClick={handleFreeGizmo}
          title="Free movement tool"
          data-shortcut="[1]"
        />
        <ToolbarButton
          className={cx('gizmo position', {
            active: selection?.gizmo === GizmoType.POSITION || isSpawnAreaSelected,
          })}
          disabled={disableGizmos}
          onClick={handlePositionGizmo}
          title="Translation tool"
          data-shortcut="[2]"
        />
        <ToolbarButton
          className={cx('gizmo rotation', {
            active: selection?.gizmo === GizmoType.ROTATION && !isSpawnAreaSelected,
          })}
          disabled={disableGizmos}
          onClick={handleRotationGizmo}
          title="Rotation tool"
          data-shortcut="[3]"
        />
        <ToolbarButton
          className={cx('gizmo scale', {
            active: selection?.gizmo === GizmoType.SCALE && !isSpawnAreaSelected,
          })}
          disabled={disableGizmos}
          onClick={handleScaleGizmo}
          title="Scaling tool"
          data-shortcut="[4]"
        />
      </div>
      <div className="SnapToggle">
        <div className={cx('panel', { visible: showPanel })}>
          <Snap gizmo={GizmoType.POSITION} />
          <Snap gizmo={GizmoType.ROTATION} />
          <Snap gizmo={GizmoType.SCALE} />
          <div
            className={cx('world-align-btn', { active: isGizmoWorldAligned })}
            onClick={() => setGizmoWorldAligned(!isGizmoWorldAligned)}
            data-tooltip="Align to world"
            data-position="bottom center"
            data-inverted
          >
            <BsGlobe />
          </div>
        </div>
        <ToolbarButton
          className={cx('snap-toggle-btn', { active: isEnabled, 'panel-open': showPanel })}
          onClick={toggle}
          title="Toggle snap"
          data-position="bottom center"
          data-inverted
        >
          <BsGrid3X3 />
        </ToolbarButton>
        <div
          className={cx('open-panel', { active: showPanel })}
          onClick={handleTogglePanel}
          data-tooltip={showPanel ? undefined : 'Open snap settings'}
          data-position="bottom center"
          data-inverted
        >
          {showPanel ? <BsX /> : <BsChevronRight />}
        </div>
        <ToolbarButton
          className={cx('object-snap-btn', { active: isObjectSnapEnabled })}
          onClick={toggleObjectSnap}
          title="Snap to objects"
          data-position="bottom center"
          data-inverted
        >
          <BsMagnet />
        </ToolbarButton>
        <ToolbarButton
          className="snap-to-floor-btn"
          onClick={handleSnapToFloor}
          title="Snap to floor"
          data-position="bottom center"
          data-inverted
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <rect
              x="4"
              y="2"
              width="8"
              height="8"
            />
            <line
              x1="1"
              y1="14"
              x2="15"
              y2="14"
              strokeWidth="2"
            />
          </svg>
        </ToolbarButton>
      </div>
    </>
  );
});

export default React.memo(Gizmos);
