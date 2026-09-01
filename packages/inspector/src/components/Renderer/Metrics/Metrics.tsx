import React, { useCallback, useEffect, useMemo } from 'react';
import { FiAlertTriangle as WarningIcon } from 'react-icons/fi';
import { IoGridOutline as SquaresGridIcon } from 'react-icons/io5';
import cx from 'classnames';

import { CrdtMessageType } from '@dcl/ecs';

import type { WithSdkProps } from '../../../hoc/withSdk';
import { withSdk } from '../../../hoc/withSdk';
import { useChange } from '../../../hooks/sdk/useChange';
import { useOutsideClick } from '../../../hooks/useOutsideClick';
import type { Layout } from '../../../lib/utils/layout';
import { PARCEL_SIZE } from '../../../lib/utils/scene';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import {
  getMetrics,
  getLimits,
  getEntitiesOutOfBoundaries,
  getHasCustomCode,
  setEntitiesOutOfBoundaries,
  setMetrics,
  setLimits,
} from '../../../redux/scene-metrics';
import type { SceneMetrics } from '../../../redux/scene-metrics/types';
import { Button } from '../../Button';
import { getSceneLimits } from './utils';

import './Metrics.css';

const ICON_SIZE = 18;

const Metrics = withSdk<WithSdkProps>(({ sdk }) => {
  const ROOT = sdk.engine.RootEntity;
  const PLAYER_ROOT = sdk.engine.PlayerEntity;
  const CAMERA_ROOT = sdk.engine.CameraEntity;
  const dispatch = useAppDispatch();
  const metrics = useAppSelector(getMetrics);
  const limits = useAppSelector(getLimits);
  const entitiesOutOfBoundaries = useAppSelector(getEntitiesOutOfBoundaries);
  const hasCustomCode = useAppSelector(getHasCustomCode);
  const [showMetrics, setShowMetrics] = React.useState(false);
  const [sceneLayout, setSceneLayout] = React.useState<Layout>({
    base: { x: 0, y: 0 },
    parcels: [],
  });

  const getNodes = useCallback(
    () =>
      sdk.components.Nodes.getOrNull(ROOT)?.value.filter(
        node => ![ROOT, PLAYER_ROOT, CAMERA_ROOT].includes(node.entity),
      ) ?? [],
    [sdk],
  );

  const handleUpdateMetrics = useCallback(() => {
    const { triangles, bodies, materials, textures } = sdk.renderer.metrics.getSceneMetrics();
    dispatch(
      setMetrics({
        triangles,
        // Entity count is an ECS concept (the Nodes tree), not a renderer one,
        // so the inspector still derives it itself.
        entities: getNodes().length,
        bodies,
        materials,
        textures,
      }),
    );
  }, [sdk, dispatch, getNodes]);

  const handleUpdateSceneLayout = useCallback(() => {
    const scene = sdk.components.Scene.getOrNull(ROOT);
    if (scene) {
      setSceneLayout(scene.layout as Layout);
      dispatch(setLimits(getSceneLimits(scene.layout.parcels.length)));
    }
  }, [sdk, setSceneLayout]);

  const handleSceneChange = useCallback(() => {
    dispatch(setEntitiesOutOfBoundaries(sdk.renderer.metrics.getEntitiesOutsideLayout()));
  }, [sdk, dispatch]);

  useEffect(() => {
    const unsubscribe = sdk.renderer.metrics.onChange(() => {
      handleUpdateMetrics();
      handleSceneChange();
    });

    handleUpdateSceneLayout();

    return unsubscribe;
  }, []);

  useChange(
    ({ operation, component }) => {
      if (
        operation === CrdtMessageType.PUT_COMPONENT &&
        component?.componentId === sdk.components.Scene.componentId
      ) {
        handleUpdateSceneLayout();
      }
    },
    [handleUpdateSceneLayout],
  );

  const limitsExceeded = useMemo<Record<string, boolean>>(() => {
    return Object.fromEntries(
      Object.entries(metrics)
        .map(([key, value]) => [key, value > limits[key as keyof SceneMetrics]])
        .filter(([, value]) => value),
    );
  }, [metrics, limits]);

  const isAnyLimitExceeded = (limitsExceeded: Record<string, any>): boolean => {
    return (
      Object.values(limitsExceeded).length > 0 ||
      entitiesOutOfBoundaries.length > 0 ||
      hasCustomCode
    );
  };

  const handleToggleMetricsOverlay = useCallback(
    (e: React.MouseEvent<HTMLButtonElement> | MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setShowMetrics(value => !value);
    },
    [showMetrics, setShowMetrics],
  );

  const overlayRef = useOutsideClick(handleToggleMetricsOverlay);

  const getWarningMessages = (): string[] => {
    const baseMessage = 'Your scene contains too many';
    const warnings: string[] = [];

    Object.entries(limitsExceeded).forEach(([key, isExceeded]) => {
      if (isExceeded) {
        warnings.push(`${baseMessage} ${key}`);
      }
    });

    if (entitiesOutOfBoundaries.length > 0) {
      warnings.push(
        `${entitiesOutOfBoundaries.length} entit${
          entitiesOutOfBoundaries.length === 1 ? 'y is' : 'ies are'
        } out of bounds and may not display correctly in-world.`,
      );
    }

    if (hasCustomCode) {
      warnings.push(
        'This scene includes code elements that may only become visible once the scene is running.',
      );
    }

    return warnings;
  };

  const warningMessages = getWarningMessages();

  return (
    <div className="Metrics">
      <div className="Buttons">
        <Button
          className={cx({ Active: showMetrics, LimitExceeded: isAnyLimitExceeded(limitsExceeded) })}
          onClick={handleToggleMetricsOverlay}
        >
          <SquaresGridIcon size={ICON_SIZE} />
          {isAnyLimitExceeded(limitsExceeded) && <span className="WarningDot" />}
        </Button>
      </div>
      {showMetrics && (
        <div
          ref={overlayRef}
          className="Overlay"
        >
          <h2 className="Header">Scene Optimization</h2>
          <div className="Description">Suggested Specs per Parcel</div>
          <div className="Description">
            {sceneLayout.parcels.length} Parcels = {sceneLayout.parcels.length * PARCEL_SIZE}
            <div>
              m<sup>2</sup>
            </div>
          </div>
          <div className="Items">
            {Object.entries(metrics).map(([key, value]) => (
              <div
                className="Item"
                key={key}
              >
                <div className="Title">{key.toUpperCase()}</div>
                <div className={cx('Description', { LimitExceeded: limitsExceeded[key] })}>
                  <span className="primary">{value}</span>
                  {'/'}
                  <span className="secondary">{limits[key as keyof SceneMetrics]}</span>
                </div>
              </div>
            ))}
          </div>
          {warningMessages.length > 0 && (
            <div className="WarningsContainer">
              <div className="Description">WARNINGS</div>
              {warningMessages.map((message, index) => (
                <div
                  className="WarningItem"
                  key={index}
                >
                  <WarningIcon className="WarningIcon" />
                  <span className="WarningText">{message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default React.memo(Metrics);
