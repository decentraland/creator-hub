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

  const handleFieldChange = useCallback(
    (index: number, field: 'position' | 'cameraTarget', position: Vector3) => {
      if (index < 0 || index >= spawnPoints.length) return;
      const spawnPoint = spawnPoints[index];
      const input = fromSceneSpawnPoint(spawnPoint);
      const newInput = {
        ...input,
        [field]: { x: position.x, y: position.y, z: position.z },
      };
      modifySpawnPoint(index, toSceneSpawnPoint(spawnPoint.name, newInput));
    },
    [spawnPoints, modifySpawnPoint],
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

  const handleFocusInput = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlurInput = useCallback(() => {
    setIsFocused(false);
  }, []);

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
            <PositionFields
              value={input.position}
              onFocus={handleFocusInput}
              onBlur={handleBlurInput}
              onChange={(axis, val) => {
                const newInput = { ...input, position: { ...input.position, [axis]: val } };
                modifySpawnPoint(index, toSceneSpawnPoint(spawnPoint.name, newInput));
              }}
            />
          </Block>
          <CheckboxField
            label="Random Offset"
            checked={input.randomOffset}
            onChange={event => {
              const newInput = {
                ...input,
                randomOffset: event.target.checked,
                maxOffset: event.target.checked ? 1.5 : 0,
              };
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
            <PositionFields
              value={input.cameraTarget}
              onFocus={handleFocusInput}
              onBlur={handleBlurInput}
              onChange={(axis, val) => {
                const newInput = {
                  ...input,
                  cameraTarget: { ...input.cameraTarget, [axis]: val },
                };
                modifySpawnPoint(index, toSceneSpawnPoint(spawnPoint.name, newInput));
              }}
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
      handleFocusInput,
      handleBlurInput,
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
