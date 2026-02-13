import { useCallback, useEffect, useRef, useState } from 'react';
import cx from 'classnames';
import type { Vector3 } from '@babylonjs/core';

import { withSdk } from '../../../hoc/withSdk';
import { useComponentValue } from '../../../hooks/sdk/useComponentValue';
import { useArrayState } from '../../../hooks/useArrayState';
import { useSnackbar } from '../../../hooks/useSnackbar';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { TextField } from '../../ui/TextField';
import { CheckboxField } from '../../ui/CheckboxField';
import { AddButton } from '../AddButton';
import MoreOptionsMenu from '../MoreOptionsMenu';
import { Button } from '../../Button';
import type { EditorComponentsTypes, SceneSpawnPoint } from '../../../lib/sdk/components';
import {
  fromSceneSpawnPoint,
  toSceneSpawnPoint,
  isValidSpawnAreaName,
  isSpawnAreaInBounds,
  isPositionInBounds,
  SPAWN_AREA_DEFAULTS,
} from './utils';
import type { Props } from './types';

import '../SceneInspector/SceneInspector.css';

type Vec3 = { x: number; y: number; z: number };

function PositionFields({
  value,
  onFocus,
  onBlur,
  onChange,
}: {
  value: Vec3;
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  onChange: (axis: keyof Vec3, val: number) => void;
}) {
  return (
    <>
      {(['x', 'y', 'z'] as const).map(axis => (
        <TextField
          key={axis}
          leftLabel={axis.toUpperCase()}
          type="number"
          value={value[axis]}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={event => {
            const parsed = parseFloat(event.target.value);
            if (!isNaN(parsed)) onChange(axis, parsed);
          }}
          autoSelect
        />
      ))}
    </>
  );
}

function generateSpawnAreaName(existingNames: string[]): string {
  let counter = 1;
  while (existingNames.includes(`SpawnArea${counter}`)) {
    counter++;
  }
  return `SpawnArea${counter}`;
}

export default withSdk<Props>(({ sdk }) => {
  const { Scene } = sdk.components;
  const rootEntity = sdk.engine.RootEntity;

  const [componentValue, setComponentValue, isComponentEqual] = useComponentValue<
    EditorComponentsTypes['Scene']
  >(rootEntity, Scene);

  const [spawnPoints, addSpawnPoint, modifySpawnPoint, removeSpawnPoint] =
    useArrayState<SceneSpawnPoint>(componentValue === null ? [] : componentValue.spawnPoints);

  const [selectedSpawnPointIndex, setSelectedSpawnPointIndex] = useState<number | null>(null);

  const { pushNotification } = useSnackbar();
  const activeWarningMessage = useRef<string | null>(null);
  const showBoundsWarning = useCallback(
    (message: string) => {
      if (activeWarningMessage.current === message) return;
      activeWarningMessage.current = message;
      void pushNotification('warning', message);
    },
    [pushNotification],
  );
  const clearBoundsWarning = useCallback(() => {
    activeWarningMessage.current = null;
  }, []);

  const layout = componentValue?.layout;

  const spawnPointManager = sdk.sceneContext.spawnPoints;
  const gizmoManager = sdk.gizmos;

  const handleFieldChange = useCallback(
    (index: number, field: 'position' | 'cameraTarget', position: Vector3) => {
      if (index < 0 || index >= spawnPoints.length) return;
      const spawnPoint = spawnPoints[index];
      const input = fromSceneSpawnPoint(spawnPoint);
      const newPos = { x: position.x, y: position.y, z: position.z };

      if (layout) {
        if (field === 'position') {
          const effectiveOffset = input.randomOffset ? input.maxOffset : 0;
          if (!isSpawnAreaInBounds(layout, newPos, effectiveOffset)) {
            showBoundsWarning('Spawn area must be within scene bounds');
            const node = spawnPointManager.getSpawnPointNode(index);
            if (node) {
              node.position.set(input.position.x, input.position.y, input.position.z);
            }
            return;
          }
        } else if (field === 'cameraTarget') {
          if (!isPositionInBounds(layout, newPos)) {
            showBoundsWarning('Camera target must be within scene bounds');
            const node = spawnPointManager.getCameraTargetNode(index);
            if (node) {
              node.position.set(input.cameraTarget.x, input.cameraTarget.y, input.cameraTarget.z);
            }
            return;
          }
        }
      }

      clearBoundsWarning();
      const newInput = {
        ...input,
        [field]: newPos,
      };
      modifySpawnPoint(index, toSceneSpawnPoint(newInput));
    },
    [
      spawnPoints,
      modifySpawnPoint,
      layout,
      showBoundsWarning,
      clearBoundsWarning,
      spawnPointManager,
    ],
  );

  const fieldChangeRef = useRef(handleFieldChange);
  fieldChangeRef.current = handleFieldChange;

  useEffect(() => {
    const unsubscribe = spawnPointManager.onSelectionChange(({ index, target }) => {
      setSelectedSpawnPointIndex(index);

      if (index !== null) {
        if (target === 'cameraTarget') {
          const node = spawnPointManager.getCameraTargetNode(index);
          if (node) {
            gizmoManager.attachToSpawnPoint(node, index, (i, p) =>
              fieldChangeRef.current(i, 'cameraTarget', p),
            );
          }
        } else {
          const node = spawnPointManager.getSpawnPointNode(index);
          if (node) {
            gizmoManager.attachToSpawnPoint(node, index, (i, p) =>
              fieldChangeRef.current(i, 'position', p),
            );
          }
        }
      } else {
        gizmoManager.detachFromSpawnPoint();
      }
    });
    return () => {
      unsubscribe();
      gizmoManager.detachFromSpawnPoint();
    };
  }, [spawnPointManager, gizmoManager]);

  const handleAddSpawnArea = useCallback(() => {
    const existingNames = spawnPoints.map(sp => sp.name);
    const name = generateSpawnAreaName(existingNames);
    const { position, cameraTarget, maxOffset } = SPAWN_AREA_DEFAULTS;
    addSpawnPoint({
      name,
      default: false,
      position: {
        x: { $case: 'range', value: [position.x - maxOffset, position.x + maxOffset] },
        y: { $case: 'range', value: [position.y, position.y] },
        z: { $case: 'range', value: [position.z - maxOffset, position.z + maxOffset] },
      },
      cameraTarget: { ...cameraTarget },
    });
  }, [spawnPoints, addSpawnPoint]);

  const [isFocused, setIsFocused] = useState(false);
  const [revertKey, setRevertKey] = useState(0);

  useEffect(() => {
    if (isComponentEqual({ ...componentValue, spawnPoints }) || isFocused) {
      return;
    }

    setComponentValue({ ...componentValue, spawnPoints });
  }, [spawnPoints, isFocused, componentValue]);

  const handleFocusInput = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlurInput = useCallback(() => {
    setIsFocused(false);
  }, []);

  const renderSpawnArea = useCallback(
    (spawnPoint: SceneSpawnPoint, index: number) => {
      const input = fromSceneSpawnPoint(spawnPoint);
      const isSelected = selectedSpawnPointIndex === index;
      const isLastSpawnArea = spawnPoints.length <= 1;

      const handleModify = (changes: Partial<typeof input>) => {
        modifySpawnPoint(index, toSceneSpawnPoint({ ...input, ...changes }));
      };

      const handleResetToDefaults = (e: React.MouseEvent) => {
        e.stopPropagation();
        const { position, cameraTarget, maxOffset } = SPAWN_AREA_DEFAULTS;
        handleModify({
          position: { ...position },
          cameraTarget: { ...cameraTarget },
          maxOffset,
          randomOffset: true,
        });
      };

      const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isLastSpawnArea) return;
        if (isSelected) {
          spawnPointManager.selectSpawnPoint(null);
        }
        removeSpawnPoint(index);
      };

      const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newName = e.target.value;
        // Allow updating the name — validation feedback is shown via the error prop
        handleModify({ name: newName });
      };

      return (
        <Container
          className={cx('SpawnAreaContainer', { selected: isSelected })}
          key={`spawn-area-${index}`}
          label={input.name}
          initialOpen={isSelected}
          rightContent={
            <div
              className="SpawnAreaHeaderRight"
              onClick={e => e.stopPropagation()}
            >
              <CheckboxField
                label="Main Spawn"
                checked={input.default}
                onChange={e => handleModify({ default: e.target.checked })}
              />
              <MoreOptionsMenu>
                <Button onClick={handleResetToDefaults}>Reset to defaults</Button>
                <Button
                  className="RemoveButton"
                  disabled={isLastSpawnArea}
                  onClick={handleDelete}
                  title={
                    isLastSpawnArea
                      ? "This remaining Spawn Area can't be deleted, as at least one spawn area is mandatory."
                      : undefined
                  }
                >
                  Delete Spawn Area
                </Button>
              </MoreOptionsMenu>
            </div>
          }
          border
        >
          <TextField
            label="Name"
            type="text"
            value={input.name}
            error={
              !isValidSpawnAreaName(input.name) && 'Spaces and special characters are not allowed'
            }
            onFocus={handleFocusInput}
            onBlur={handleBlurInput}
            onChange={handleNameChange}
          />
          <Block label="Position">
            <PositionFields
              key={`pos-${revertKey}`}
              value={input.position}
              onFocus={handleFocusInput}
              onBlur={handleBlurInput}
              onChange={(axis, val) => {
                const newPosition = { ...input.position, [axis]: val };
                if (layout) {
                  const effectiveOffset = input.randomOffset ? input.maxOffset : 0;
                  if (!isSpawnAreaInBounds(layout, newPosition, effectiveOffset)) {
                    showBoundsWarning('Spawn area must be within scene bounds');
                    setRevertKey(k => k + 1);
                    return;
                  }
                }
                clearBoundsWarning();
                handleModify({ position: newPosition });
              }}
            />
          </Block>
          <Block label="Spawn Camera Target">
            <PositionFields
              key={`cam-${revertKey}`}
              value={input.cameraTarget}
              onFocus={handleFocusInput}
              onBlur={handleBlurInput}
              onChange={(axis, val) => {
                const newCameraTarget = { ...input.cameraTarget, [axis]: val };
                if (layout && !isPositionInBounds(layout, newCameraTarget)) {
                  showBoundsWarning('Camera target must be within scene bounds');
                  setRevertKey(k => k + 1);
                  return;
                }
                clearBoundsWarning();
                handleModify({ cameraTarget: newCameraTarget });
              }}
            />
          </Block>
          <Block label="Randomized Area">
            <TextField
              key={`offset-${revertKey}`}
              type="number"
              value={input.maxOffset}
              disabled={!input.randomOffset}
              onFocus={handleFocusInput}
              onBlur={handleBlurInput}
              onChange={event => {
                const value = parseFloat(event.target.value);
                if (isNaN(value) || value < 0) return;
                if (layout && !isSpawnAreaInBounds(layout, input.position, value)) {
                  showBoundsWarning('Randomized area extends outside scene bounds');
                  setRevertKey(k => k + 1);
                  return;
                }
                clearBoundsWarning();
                handleModify({ maxOffset: value });
              }}
              autoSelect
            />
            <CheckboxField
              label="Don't randomize"
              checked={!input.randomOffset}
              onChange={event => {
                const enableRandom = !event.target.checked;
                handleModify({
                  randomOffset: enableRandom,
                  ...(enableRandom && input.maxOffset === 0
                    ? { maxOffset: SPAWN_AREA_DEFAULTS.maxOffset }
                    : {}),
                });
              }}
            />
          </Block>
        </Container>
      );
    },
    [
      modifySpawnPoint,
      removeSpawnPoint,
      selectedSpawnPointIndex,
      handleFocusInput,
      handleBlurInput,
      spawnPointManager,
      spawnPoints.length,
      layout,
      showBoundsWarning,
      clearBoundsWarning,
      revertKey,
    ],
  );

  if (componentValue === null) {
    return null;
  }

  return (
    <Container
      className="Scene"
      label="Spawn Areas"
      gap
    >
      {spawnPoints.map((spawnPoint, index) => renderSpawnArea(spawnPoint, index))}
      <AddButton onClick={handleAddSpawnArea}>Add New Spawn Area</AddButton>
    </Container>
  );
});
