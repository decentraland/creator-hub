import { useCallback, useEffect, useRef, useState } from 'react';
import cx from 'classnames';
import type { SpawnPointTarget } from '../../../lib/renderer/types';
import { withSdk } from '../../../hoc/withSdk';
import { useComponentValue } from '../../../hooks/sdk/useComponentValue';
import { useArrayState } from '../../../hooks/useArrayState';
import { recursiveCheck } from '../../../lib/utils/deep-equal';
import { useSnackbar } from '../../../hooks/useSnackbar';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { TextField } from '../../ui/TextField';
import { CheckboxField } from '../../ui/CheckboxField';
import { Vector3Field } from '../../ui/Vector3Field';
import { AddButton } from '../AddButton';
import MoreOptionsMenu from '../MoreOptionsMenu';
import { Button } from '../../Button';
import type { EditorComponentsTypes, SceneSpawnPoint } from '../../../lib/sdk/components';
import {
  fromSceneSpawnPoint,
  toSceneSpawnPoint,
  isSpawnAreaInBounds,
  isPositionInBounds,
  generateSpawnAreaName,
  generateDuplicateName,
  SPAWN_AREA_DEFAULTS,
  round2,
} from './utils';
import type { Props } from './types';

import '../SceneInspector/SceneInspector.css';

export default withSdk<Props>(({ sdk }) => {
  const { Scene } = sdk.components;
  const rootEntity = sdk.engine.RootEntity;

  const [componentValue, setComponentValue, isComponentEqual] = useComponentValue<
    EditorComponentsTypes['Scene']
  >(rootEntity, Scene);

  const [spawnPoints, addSpawnPoint, modifySpawnPoint, removeSpawnPoint, setSpawnPoints] =
    useArrayState<SceneSpawnPoint>(componentValue?.spawnPoints ?? []);

  // Render-time sync: ensure spawnPoints stays in sync with componentValue.spawnPoints
  // before effects run. useArrayState defers its sync to a useEffect, which means
  // downstream effects (like the sync effect below) can see stale spawnPoints and
  // accidentally push old data back to the engine — causing an infinite update loop
  // when an external source (e.g. PlayerTree) modifies spawnPoints.
  const prevCvSpawnPointsRef = useRef(componentValue?.spawnPoints);
  if (prevCvSpawnPointsRef.current !== componentValue?.spawnPoints) {
    prevCvSpawnPointsRef.current = componentValue?.spawnPoints;
    const cvSpawnPoints = componentValue?.spawnPoints ?? [];
    if (recursiveCheck(cvSpawnPoints, spawnPoints, 2)) {
      setSpawnPoints([...cvSpawnPoints]);
    }
  }

  // Spawn-point handles go through the renderer-agnostic contract. A renderer
  // without in-scene handles no-ops them; the panel still edits spawn-point
  // values via the form. (Named *controller* to avoid colliding with the
  // `spawnPoints` array-state above.)
  const spawnPointController = sdk.renderer.spawnPoints;

  const [selectedSpawnPointIndex, setSelectedSpawnPointIndex] = useState<number | null>(() =>
    spawnPointController.getSelectedIndex(),
  );

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

  const handleFieldChange = useCallback(
    (
      index: number,
      field: 'position' | 'cameraTarget',
      position: { x: number; y: number; z: number },
    ) => {
      if (index < 0 || index >= spawnPoints.length) return;
      const spawnPoint = spawnPoints[index];
      const input = fromSceneSpawnPoint(spawnPoint);
      const newPos = { x: round2(position.x), y: round2(position.y), z: round2(position.z) };

      if (layout) {
        if (field === 'position') {
          const effectiveOffset = input.randomOffset ? input.maxOffset : 0;
          if (!isSpawnAreaInBounds(layout, newPos, effectiveOffset)) {
            showBoundsWarning('Spawn area must be within scene bounds');
            spawnPointController.setPosition(index, 'position', input.position);
            return;
          }
        } else if (field === 'cameraTarget') {
          if (!isPositionInBounds(layout, newPos)) {
            showBoundsWarning('Camera target must be within scene bounds');
            spawnPointController.setPosition(index, 'cameraTarget', input.cameraTarget);
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
      spawnPointController,
      modifySpawnPoint,
      layout,
      showBoundsWarning,
      clearBoundsWarning,
    ],
  );

  const fieldChangeRef = useRef(handleFieldChange);
  fieldChangeRef.current = handleFieldChange;

  useEffect(() => {
    const attachGizmo = (index: number | null, target: SpawnPointTarget | null) => {
      setSelectedSpawnPointIndex(index);
      if (index === null) {
        spawnPointController.detachGizmo();
        return;
      }
      spawnPointController.attachGizmo(index, target ?? 'position', (i, p) =>
        fieldChangeRef.current(i, target ?? 'position', p),
      );
    };

    // Attach handle for any already-selected spawn point
    const currentIndex = spawnPointController.getSelectedIndex();
    if (currentIndex !== null) {
      attachGizmo(currentIndex, spawnPointController.getSelectedTarget());
    }

    const unsubscribe = spawnPointController.onSelectionChange(({ index, target }) => {
      attachGizmo(index, target);
    });
    return () => {
      unsubscribe();
      spawnPointController.detachGizmo();
      spawnPointController.select(null);
    };
  }, [spawnPointController]);

  const handleAddSpawnArea = useCallback(() => {
    const existingNames = spawnPoints.map(sp => sp.name);
    const name = generateSpawnAreaName(existingNames);
    addSpawnPoint(
      toSceneSpawnPoint({
        name,
        default: false,
        position: { ...SPAWN_AREA_DEFAULTS.position },
        cameraTarget: { ...SPAWN_AREA_DEFAULTS.cameraTarget },
        maxOffset: SPAWN_AREA_DEFAULTS.maxOffset,
        randomOffset: true,
      }),
    );
  }, [spawnPoints, addSpawnPoint]);

  const [isFocused, setIsFocused] = useState(false);
  const [revertKey, setRevertKey] = useState(0);

  const revertAndWarn = useCallback(
    (message: string) => {
      showBoundsWarning(message);
      setRevertKey(k => k + 1);
    },
    [showBoundsWarning],
  );

  useEffect(() => {
    if (isComponentEqual({ ...componentValue, spawnPoints }) || isFocused) {
      return;
    }

    setComponentValue({ ...componentValue, spawnPoints });
  }, [spawnPoints, isFocused, componentValue, isComponentEqual, setComponentValue]);

  const handleFocusInput = useCallback(() => setIsFocused(true), []);
  const handleBlurInput = useCallback(() => setIsFocused(false), []);

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
          spawnPointController.select(null);
        } else if (selectedSpawnPointIndex !== null && selectedSpawnPointIndex > index) {
          spawnPointController.select(selectedSpawnPointIndex - 1);
        }
        const wasDefault = input.default;
        removeSpawnPoint(index);
        if (wasDefault) {
          setSpawnPoints(prev => {
            if (prev.some(sp => sp.default)) return prev;
            if (prev.length === 0) return prev;
            return prev.map((sp, i) => (i === 0 ? { ...sp, default: true } : sp));
          });
        }
      };

      const handleDuplicate = (e: React.MouseEvent) => {
        e.stopPropagation();
        const existingNames = spawnPoints.map(sp => sp.name);
        const name = generateDuplicateName(input.name, existingNames);
        addSpawnPoint(
          toSceneSpawnPoint({
            ...input,
            name,
            default: false,
          }),
        );
      };

      return (
        <Container
          className={cx('SpawnAreaContainer', { selected: isSelected })}
          key={`spawn-area-${index}${isSelected ? '-selected' : ''}`}
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
                <Button onClick={handleDuplicate}>Duplicate</Button>
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
                  Delete
                </Button>
              </MoreOptionsMenu>
            </div>
          }
          border
        >
          <Block label="Position">
            <Vector3Field
              key={`pos-${revertKey}`}
              value={input.position}
              onFocus={handleFocusInput}
              onBlur={handleBlurInput}
              onChange={(axis, val) => {
                const newPosition = { ...input.position, [axis]: val };
                if (layout) {
                  const effectiveOffset = input.randomOffset ? input.maxOffset : 0;
                  if (!isSpawnAreaInBounds(layout, newPosition, effectiveOffset)) {
                    revertAndWarn('Spawn area must be within scene bounds');
                    return;
                  }
                }
                clearBoundsWarning();
                handleModify({ position: newPosition });
              }}
            />
          </Block>
          <Block label="Spawn Camera Target">
            <Vector3Field
              key={`cam-${revertKey}`}
              value={input.cameraTarget}
              onFocus={handleFocusInput}
              onBlur={handleBlurInput}
              onChange={(axis, val) => {
                const newCameraTarget = { ...input.cameraTarget, [axis]: val };
                if (layout && !isPositionInBounds(layout, newCameraTarget)) {
                  revertAndWarn('Camera target must be within scene bounds');
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
                  revertAndWarn('Randomized area extends outside scene bounds');
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
                const maxOffset =
                  enableRandom && input.maxOffset === 0
                    ? SPAWN_AREA_DEFAULTS.maxOffset
                    : input.maxOffset;
                handleModify({ randomOffset: enableRandom, maxOffset });
              }}
            />
          </Block>
        </Container>
      );
    },
    [
      modifySpawnPoint,
      removeSpawnPoint,
      addSpawnPoint,
      selectedSpawnPointIndex,
      handleFocusInput,
      handleBlurInput,
      spawnPointController,
      spawnPoints,
      layout,
      revertAndWarn,
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
