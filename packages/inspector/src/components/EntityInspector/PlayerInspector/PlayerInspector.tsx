import { useCallback, useEffect, useRef, useState } from 'react';
import cx from 'classnames';
import type { Vector3 } from '@babylonjs/core';

import { withSdk } from '../../../hoc/withSdk';
import { useComponentValue } from '../../../hooks/sdk/useComponentValue';
import { useArrayState } from '../../../hooks/useArrayState';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { TextField } from '../../ui/TextField';
import { CheckboxField } from '../../ui/CheckboxField';
import { AddButton } from '../AddButton';
import MoreOptionsMenu from '../MoreOptionsMenu';
import { Button } from '../../Button';
import type { EditorComponentsTypes, SceneSpawnPoint } from '../../../lib/sdk/components';
import { fromSceneSpawnPoint, toSceneSpawnPoint } from '../SceneInspector/utils';
import type { Props } from './types';

import '../SceneInspector/SceneInspector.css';

export default withSdk<Props>(({ sdk }) => {
  const { Scene } = sdk.components;
  const rootEntity = sdk.engine.RootEntity;

  const [componentValue, setComponentValue, isComponentEqual] = useComponentValue<
    EditorComponentsTypes['Scene']
  >(rootEntity, Scene);

  const [spawnPoints, addSpawnPoint, modifySpawnPoint, removeSpawnPoint] =
    useArrayState<SceneSpawnPoint>(componentValue === null ? [] : componentValue.spawnPoints);

  const [selectedSpawnPointIndex, setSelectedSpawnPointIndex] = useState<number | null>(null);

  const spawnPointManager = sdk.sceneContext.spawnPoints;
  const gizmoManager = sdk.gizmos;

  const handleSpawnPointPositionChange = useCallback(
    (index: number, position: Vector3) => {
      if (index >= 0 && index < spawnPoints.length) {
        const spawnPoint = spawnPoints[index];
        const input = fromSceneSpawnPoint(spawnPoint);
        const newInput = {
          ...input,
          position: {
            x: position.x,
            y: position.y,
            z: position.z,
          },
        };
        modifySpawnPoint(index, toSceneSpawnPoint(spawnPoint.name, newInput));
      }
    },
    [spawnPoints, modifySpawnPoint],
  );

  const handleCameraTargetPositionChange = useCallback(
    (index: number, position: Vector3) => {
      if (index >= 0 && index < spawnPoints.length) {
        const spawnPoint = spawnPoints[index];
        const input = fromSceneSpawnPoint(spawnPoint);
        const newInput = {
          ...input,
          cameraTarget: {
            x: position.x,
            y: position.y,
            z: position.z,
          },
        };
        modifySpawnPoint(index, toSceneSpawnPoint(spawnPoint.name, newInput));
      }
    },
    [spawnPoints, modifySpawnPoint],
  );

  const positionChangeRef = useRef(handleSpawnPointPositionChange);
  positionChangeRef.current = handleSpawnPointPositionChange;

  const cameraTargetPositionChangeRef = useRef(handleCameraTargetPositionChange);
  cameraTargetPositionChangeRef.current = handleCameraTargetPositionChange;

  useEffect(() => {
    const unsubscribe = spawnPointManager.onSelectionChange(({ index, target }) => {
      setSelectedSpawnPointIndex(index);

      if (index !== null) {
        if (target === 'cameraTarget') {
          const node = spawnPointManager.getCameraTargetNode(index);
          if (node) {
            gizmoManager.attachToSpawnPoint(node, index, (i, p) =>
              cameraTargetPositionChangeRef.current(i, p),
            );
          }
        } else {
          const node = spawnPointManager.getSpawnPointNode(index);
          if (node) {
            gizmoManager.attachToSpawnPoint(node, index, (i, p) => positionChangeRef.current(i, p));
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

  const handleSpawnPointClick = useCallback(
    (index: number) => {
      if (selectedSpawnPointIndex === index) {
        spawnPointManager.selectSpawnPoint(null);
      } else {
        spawnPointManager.selectSpawnPoint(index);
      }
    },
    [selectedSpawnPointIndex, spawnPointManager],
  );

  const handleAddSpawnPoint = useCallback(() => {
    addSpawnPoint({
      name: `Spawn Point ${spawnPoints.length + 1}`,
      default: true,
      position: {
        x: { $case: 'range', value: [0, 3] },
        y: { $case: 'range', value: [0, 0] },
        z: { $case: 'range', value: [0, 3] },
      },
      cameraTarget: { x: 8, y: 1, z: 8 },
    });
  }, [spawnPoints, addSpawnPoint]);

  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (isComponentEqual({ ...componentValue, spawnPoints }) || isFocused) {
      return;
    }

    setComponentValue({ ...componentValue, spawnPoints });
  }, [spawnPoints, isFocused, componentValue]);

  const handleFocusInput = useCallback(
    ({ type }: React.FocusEvent<HTMLInputElement>) => {
      if (type === 'focus') {
        setIsFocused(true);
      } else {
        setIsFocused(false);
      }
    },
    [setIsFocused],
  );

  const handleBlurInput = useCallback(() => {
    setIsFocused(false);
  }, [setIsFocused]);

  const renderSpawnPoint = useCallback(
    (spawnPoint: SceneSpawnPoint, index: number) => {
      const input = fromSceneSpawnPoint(spawnPoint);
      const isSelected = selectedSpawnPointIndex === index;
      return (
        <Block
          className={cx('SpawnPointContainer', { selected: isSelected })}
          key={spawnPoint.name}
          onClick={() => handleSpawnPointClick(index)}
        >
          <Block className="RightContent">
            <MoreOptionsMenu>
              <Button
                className="RemoveButton"
                onClick={e => {
                  e.stopPropagation();
                  if (isSelected) {
                    spawnPointManager.selectSpawnPoint(null);
                  }
                  removeSpawnPoint(index);
                }}
              >
                Delete
              </Button>
            </MoreOptionsMenu>
          </Block>
          <Block label="Position">
            <TextField
              leftLabel="X"
              type="number"
              value={input.position.x}
              onFocus={handleFocusInput}
              onBlur={handleBlurInput}
              onChange={event => {
                const value = parseFloat(event.target.value);
                if (isNaN(value)) return;
                const newInput = { ...input, position: { ...input.position, x: value } };
                modifySpawnPoint(index, toSceneSpawnPoint(spawnPoint.name, newInput));
              }}
              autoSelect
            />
            <TextField
              leftLabel="Y"
              type="number"
              value={input.position.y}
              onFocus={handleFocusInput}
              onBlur={handleBlurInput}
              onChange={event => {
                const value = parseFloat(event.target.value);
                if (isNaN(value)) return;
                const newInput = { ...input, position: { ...input.position, y: value } };
                modifySpawnPoint(index, toSceneSpawnPoint(spawnPoint.name, newInput));
              }}
              autoSelect
            />
            <TextField
              leftLabel="Z"
              type="number"
              value={input.position.z}
              onFocus={handleFocusInput}
              onBlur={handleBlurInput}
              onChange={event => {
                const value = parseFloat(event.target.value);
                if (isNaN(value)) return;
                const newInput = { ...input, position: { ...input.position, z: value } };
                modifySpawnPoint(index, toSceneSpawnPoint(spawnPoint.name, newInput));
              }}
              autoSelect
            />
          </Block>
          <CheckboxField
            label="Random Offset"
            checked={input.randomOffset}
            onChange={event => {
              const newInput = { ...input, randomOffset: event.target.checked };
              if (!event.target.checked) {
                newInput.maxOffset = 0;
              } else {
                newInput.maxOffset = 1.5;
              }
              modifySpawnPoint(index, toSceneSpawnPoint(spawnPoint.name, newInput));
            }}
          />
          {input.randomOffset ? (
            <TextField
              label="Max Offset"
              type="number"
              value={input.maxOffset}
              onFocus={handleFocusInput}
              onBlur={handleBlurInput}
              onChange={event => {
                const value = parseFloat(event.target.value);
                if (isNaN(value)) return;
                const newInput = { ...input, maxOffset: value };
                modifySpawnPoint(index, toSceneSpawnPoint(spawnPoint.name, newInput));
              }}
              autoSelect
            />
          ) : null}
          <Block label="Camera Target">
            <TextField
              leftLabel="X"
              type="number"
              value={input.cameraTarget.x}
              onFocus={handleFocusInput}
              onBlur={handleBlurInput}
              onChange={event => {
                const value = parseFloat(event.target.value);
                if (isNaN(value)) return;
                const newInput = { ...input, cameraTarget: { ...input.cameraTarget, x: value } };
                modifySpawnPoint(index, toSceneSpawnPoint(spawnPoint.name, newInput));
              }}
              autoSelect
            />
            <TextField
              leftLabel="Y"
              type="number"
              value={input.cameraTarget.y}
              onFocus={handleFocusInput}
              onBlur={handleBlurInput}
              onChange={event => {
                const value = parseFloat(event.target.value);
                if (isNaN(value)) return;
                const newInput = { ...input, cameraTarget: { ...input.cameraTarget, y: value } };
                modifySpawnPoint(index, toSceneSpawnPoint(spawnPoint.name, newInput));
              }}
              autoSelect
            />
            <TextField
              leftLabel="Z"
              type="number"
              value={input.cameraTarget.z}
              onFocus={handleFocusInput}
              onBlur={handleBlurInput}
              onChange={event => {
                const value = parseFloat(event.target.value);
                if (isNaN(value)) return;
                const newInput = { ...input, cameraTarget: { ...input.cameraTarget, z: value } };
                modifySpawnPoint(index, toSceneSpawnPoint(spawnPoint.name, newInput));
              }}
              autoSelect
            />
          </Block>
        </Block>
      );
    },
    [
      modifySpawnPoint,
      removeSpawnPoint,
      selectedSpawnPointIndex,
      handleSpawnPointClick,
      spawnPointManager,
    ],
  );

  if (componentValue === null) {
    return null;
  }

  return (
    <Container
      className="Scene"
      label="Spawn Settings"
      gap
    >
      {spawnPoints.map((spawnPoint, index) => renderSpawnPoint(spawnPoint, index))}
      <AddButton onClick={handleAddSpawnPoint}>Add Spawn Point</AddButton>
    </Container>
  );
});
