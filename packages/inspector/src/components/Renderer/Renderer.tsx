/* eslint-disable no-console */
import React, { useCallback, useEffect, useState } from 'react';
import { useDrop } from 'react-dnd';
import cx from 'classnames';
import { Vector3 } from '@babylonjs/core';
import type { Entity } from '@dcl/ecs';

import { DIRECTORY } from '../../lib/data-layer/host/fs-utils';
import { useAppSelector } from '../../redux/hooks';
import type {
  CatalogAssetDrop,
  IDrop,
  LocalAssetDrop,
  CustomAssetDrop,
} from '../../lib/sdk/drag-drop';
import { getNode, DROP_TYPES, isDropType, DropTypesEnum } from '../../lib/sdk/drag-drop';
import { useRenderer } from '../../hooks/sdk/useRenderer';
import { useSdk } from '../../hooks/sdk/useSdk';
import { getPointerCoords } from '../../lib/babylon/decentraland/mouse-utils';
import { snapPosition } from '../../lib/babylon/decentraland/snap-manager';
import { ROOT } from '../../lib/sdk/tree';
import type { CustomAsset } from '../../lib/logic/catalog';
import { isGround, isSmart, type Asset } from '../../lib/logic/catalog';
import { useImportAssetToFilesystem } from '../../hooks/useImportAssetToFilesystem';
import { areGizmosDisabled, getHiddenPanels, isGroundGridDisabled } from '../../redux/ui';
import { PanelName } from '../../redux/ui/types';
import type { AssetNodeItem } from '../ProjectAssetExplorer/types';
import { Loading } from '../Loading';
import { isModel } from '../EntityInspector/GltfInspector/utils';
import { useIsMounted } from '../../hooks/useIsMounted';
import {
  useHotkey,
  BACKSPACE,
  DELETE,
  COPY,
  PASTE,
  COPY_ALT,
  PASTE_ALT,
  ZOOM_IN,
  ZOOM_IN_ALT,
  ZOOM_OUT_ALT,
  ZOOM_OUT,
  RESET_CAMERA,
  DUPLICATE,
  DUPLICATE_ALT,
  FOCUS_SELECTED,
} from '../../hooks/useHotkey';
import { analytics, Event } from '../../lib/logic/analytics';
import { checkAssetCompatibility } from '../../lib/sdk/operations/add-asset/compatibility';
import type { IncompatibleComponent } from '../../lib/sdk/operations/add-asset/compatibility';
import { IncompatibleAssetModal } from '../IncompatibleAssetModal';
import { Warnings } from '../Warnings';
import { CameraSpeed } from './CameraSpeed';
import { Shortcuts } from './Shortcuts';
import { Metrics } from './Metrics';
import { SceneMinimap } from './SceneMinimap';
import { AxisHelper } from './AxisHelper';

import './Renderer.css';

const ZOOM_DELTA = new Vector3(0, 0, 1.1);
const fixedNumber = (val: number) => Math.round(val * 1e2) / 1e2;

const SINGLE_TILE_HINT_OFFSET = 30;

const Renderer: React.FC = () => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  useRenderer(() => canvasRef);
  const sdk = useSdk();
  const [isLoading, setIsLoading] = useState(false);
  const isMounted = useIsMounted();
  const { importCatalogAssetToFilesystem, importCustomAssetToFilesystem } =
    useImportAssetToFilesystem();
  const gizmosDisabled = useAppSelector(areGizmosDisabled);
  const groundGridDisabled = useAppSelector(isGroundGridDisabled);
  const [copyEntities, setCopyEntities] = useState<Entity[]>([]);
  const hiddenPanels = useAppSelector(getHiddenPanels);
  const [placeSingleTile, setPlaceSingleTile] = useState(false);
  const [showSingleTileHint, setShowSingleTileHint] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [incompatibleAssetInfo, setIncompatibleAssetInfo] = useState<{
    assetName: string;
    incompatibleComponents: IncompatibleComponent[];
  } | null>(null);

  useEffect(() => {
    if (sdk) {
      sdk.gizmos.setEnabled(!gizmosDisabled);
    }
  }, [sdk, gizmosDisabled]);

  useEffect(() => {
    if (sdk) {
      const layout = sdk.scene.getNodeByName('layout');
      if (layout) {
        layout.setEnabled(!groundGridDisabled);
      }
    }
  }, [sdk, groundGridDisabled]);

  const deleteSelectedEntities = useCallback(() => {
    if (!sdk) return;
    const selectedEntitites = sdk.operations.getSelectedEntities();
    selectedEntitites.forEach(entity => sdk.operations.removeEntity(entity));
    void sdk.operations.dispatch();
  }, [sdk]);

  const duplicateSelectedEntities = useCallback(() => {
    if (!sdk) return;
    const camera = sdk.scene.activeCamera!;
    camera.detachControl();
    const selectedEntitites = sdk.operations.getSelectedEntities();
    const preferredGizmo =
      selectedEntitites.length > 0
        ? sdk.components.Selection.getOrNull(selectedEntitites[0])?.gizmo
        : undefined;
    sdk.operations.removeSelectedEntities();
    let insertAfter =
      selectedEntitites.length > 1 ? selectedEntitites[selectedEntitites.length - 1] : undefined;
    selectedEntitites.forEach(entity => {
      const cloned = sdk.operations.duplicateEntity(entity, preferredGizmo, insertAfter);
      insertAfter = cloned;
    });
    void sdk.operations.dispatch();
    setTimeout(() => {
      camera.attachControl(canvasRef.current, true);
    }, 100);
  }, [sdk]);

  const copySelectedEntities = useCallback(() => {
    if (!sdk) return;
    const selectedEntitites = sdk.operations.getSelectedEntities();
    setCopyEntities([...selectedEntitites]);
  }, [sdk, setCopyEntities]);

  const pasteSelectedEntities = useCallback(() => {
    if (!sdk) return;
    const selectedEntities = sdk.operations.getSelectedEntities();
    const preferredGizmo =
      selectedEntities.length > 0
        ? sdk.components.Selection.getOrNull(selectedEntities[0])?.gizmo
        : undefined;
    sdk.operations.removeSelectedEntities();
    let insertAfter = copyEntities.length > 1 ? copyEntities[copyEntities.length - 1] : undefined;
    copyEntities.forEach(entity => {
      const cloned = sdk.operations.duplicateEntity(entity, preferredGizmo, insertAfter);
      insertAfter = cloned;
    });
    void sdk.operations.dispatch();
  }, [sdk, copyEntities]);

  const zoomIn = useCallback(() => {
    if (!sdk) return;
    const camera = sdk.editorCamera.getCamera();
    const dir = camera.getDirection(ZOOM_DELTA);
    camera.position.addInPlace(dir);
  }, [sdk]);

  const zoomOut = useCallback(() => {
    if (!sdk) return;
    const camera = sdk.editorCamera.getCamera();
    const dir = camera.getDirection(ZOOM_DELTA).negate();
    camera.position.addInPlace(dir);
  }, [sdk]);

  const resetCamera = useCallback(() => {
    if (!sdk) return;
    sdk.editorCamera.resetCamera();
  }, [sdk]);

  const focusOnSelected = useCallback(() => {
    if (!sdk) return;
    const selectedEntities = sdk.operations.getSelectedEntities();
    if (selectedEntities.length > 0) {
      const entityId = selectedEntities[0];
      const node = sdk.sceneContext.getEntityOrNull(entityId);
      if (node) {
        sdk.editorCamera.centerViewOnEntity(node);
      }
    }
  }, [sdk]);

  useHotkey([DELETE, BACKSPACE], deleteSelectedEntities, document.body);
  useHotkey([COPY, COPY_ALT], copySelectedEntities, document.body);
  useHotkey([PASTE, PASTE_ALT], pasteSelectedEntities, document.body);
  useHotkey([ZOOM_IN, ZOOM_IN_ALT], zoomIn, document.body);
  useHotkey([ZOOM_OUT, ZOOM_OUT_ALT], zoomOut, document.body);
  useHotkey([RESET_CAMERA], resetCamera, document.body);
  useHotkey([DUPLICATE, DUPLICATE_ALT], duplicateSelectedEntities, document.body);
  useHotkey([FOCUS_SELECTED], focusOnSelected, document.body);

  // listen to ctrl key to place single tile
  useEffect(() => {
    const prevDrag = document.ondrag;
    function handleDrag(event: MouseEvent) {
      if (event.shiftKey && !placeSingleTile) {
        setPlaceSingleTile(true);
      } else if (placeSingleTile && !event.shiftKey) {
        setPlaceSingleTile(false);
      }
      if (!placeSingleTile && event.clientX && event.clientY) {
        setMousePosition({ x: event.clientX, y: event.clientY });
      }
    }
    document.ondrag = handleDrag;
    return () => {
      document.ondrag = prevDrag;
    };
  }, [placeSingleTile, setPlaceSingleTile]);

  // clear hint
  useEffect(() => {
    const prevDragEnd = document.ondragend;
    function handleDragEnd() {
      setShowSingleTileHint(false);
    }
    document.ondragend = handleDragEnd;
    return () => {
      document.ondragend = prevDragEnd;
    };
  }, [showSingleTileHint, setShowSingleTileHint]);

  const getDropPosition = async () => {
    const pointerCoords = await getPointerCoords(sdk!.scene);
    return snapPosition(new Vector3(fixedNumber(pointerCoords.x), 0, fixedNumber(pointerCoords.z)));
  };

  const addAsset = async (
    asset: AssetNodeItem,
    position: Vector3,
    basePath: string,
    isCustom: boolean,
  ) => {
    if (!sdk) return;
    const { operations } = sdk;
    operations.addAsset(
      ROOT,
      asset.asset.src,
      asset.name,
      position,
      basePath,
      sdk.enumEntity,
      asset.composite,
      asset.asset.id,
      isCustom,
    );
    await operations.dispatch();
    analytics.track(Event.ADD_ITEM, {
      itemId: asset.asset.id,
      itemName: asset.name,
      itemPath: asset.asset.src,
      isSmart: isSmart(asset),
      isCustom,
    });
    canvasRef.current?.focus();
  };

  const setGround = async (asset: AssetNodeItem, basePath: string) => {
    if (!sdk) return;
    const { operations } = sdk;
    const src = `${basePath}/${asset.asset.src}`;
    operations.setGround(src);
    await operations.dispatch();
    analytics.track(Event.SET_GROUND, {
      itemId: asset.asset.id,
      itemName: asset.name,
      itemPath: asset.asset.src,
    });
    canvasRef.current?.focus();
  };

  const importCustomAsset = async (asset: CustomAsset) => {
    const position = await getDropPosition();
    const result = await importCustomAssetToFilesystem(asset);
    if (!result) return;

    const model: AssetNodeItem = {
      type: 'asset',
      name: asset.name,
      parent: null,
      asset: { type: 'gltf', src: '', id: asset.id },
      composite: asset.composite,
    };
    await addAsset(model, position, result.basePath, true);
  };

  const importCatalogAsset = async (asset: Asset) => {
    if (sdk) {
      const compat = checkAssetCompatibility(asset.composite, sdk.engine);
      if (!compat.compatible) {
        setIncompatibleAssetInfo({
          assetName: asset.name,
          incompatibleComponents: compat.incompatibleComponents,
        });
        return;
      }
    }

    const position = await getDropPosition();

    setIsLoading(true);
    const result = await importCatalogAssetToFilesystem(asset);
    if (!isMounted()) return;
    setIsLoading(false);

    const model: AssetNodeItem = {
      type: 'asset',
      name: asset.name,
      parent: null,
      asset: {
        type: result.assetPath ? 'gltf' : 'unknown',
        src: result.assetPath ?? '',
        id: asset.id,
      },
      composite: asset.composite,
    };
    if (isGround(asset) && !placeSingleTile) {
      await setGround(model, result.basePath);
    } else {
      if (isGround(asset)) {
        position.y += 0.25;
      }
      await addAsset(model, position, result.basePath, false);
    }
  };

  const [, drop] = useDrop(
    () => ({
      accept: DROP_TYPES,
      drop: async (item: IDrop, monitor) => {
        if (monitor.didDrop()) return;
        const itemType = monitor.getItemType();

        if (isDropType<CatalogAssetDrop>(item, itemType, DropTypesEnum.CatalogAsset)) {
          void importCatalogAsset(item.value);
          return;
        }

        if (isDropType<LocalAssetDrop>(item, itemType, DropTypesEnum.LocalAsset)) {
          const node = item.context.tree.get(item.value)!;
          const model = getNode(node, item.context.tree, isModel);
          if (model) {
            const position = await getDropPosition();
            await addAsset(model, position, DIRECTORY.ASSETS, false);
          }
        }

        if (isDropType<CustomAssetDrop>(item, itemType, DropTypesEnum.CustomAsset)) {
          void importCustomAsset(item.value);
          return;
        }
      },
      hover(item, monitor) {
        if (isDropType<CatalogAssetDrop>(item, monitor.getItemType(), DropTypesEnum.CatalogAsset)) {
          const asset = item.value;
          if (isGround(asset)) {
            if (!showSingleTileHint) {
              setShowSingleTileHint(true);
            }
          } else if (showSingleTileHint) {
            setShowSingleTileHint(false);
          }
        }
      },
    }),
    [addAsset, showSingleTileHint, setShowSingleTileHint],
  );

  drop(canvasRef);

  return (
    <div
      className={cx('Renderer', {
        'is-loaded': !isLoading,
        'is-loading': isLoading,
      })}
    >
      {isLoading && <Loading />}
      <Warnings />
      <CameraSpeed />
      <AxisHelper />
      {!hiddenPanels[PanelName.METRICS] && <Metrics />}
      <SceneMinimap />
      {!hiddenPanels[PanelName.SHORTCUTS] && (
        <Shortcuts
          canvas={canvasRef}
          onResetCamera={resetCamera}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
        />
      )}
      {incompatibleAssetInfo && (
        <IncompatibleAssetModal
          assetName={incompatibleAssetInfo.assetName}
          incompatibleComponents={incompatibleAssetInfo.incompatibleComponents}
          onClose={() => setIncompatibleAssetInfo(null)}
        />
      )}
      <canvas
        ref={canvasRef}
        id="canvas"
        touch-action="none"
      />
      <div
        style={{
          top: mousePosition.y + SINGLE_TILE_HINT_OFFSET,
          left: mousePosition.x + SINGLE_TILE_HINT_OFFSET,
        }}
        className={cx('single-tile-hint', { 'is-visible': !placeSingleTile && showSingleTileHint })}
      >
        Hold <b>SHIFT</b> to place a single tile
      </div>
    </div>
  );
};

export default React.memo(Renderer);
