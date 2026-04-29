import { useMemo } from 'react';
import type { Entity } from '@dcl/ecs';

import { withSdk } from '../../hoc/withSdk';
import { useAppSelector } from '../../redux/hooks';
import { selectCustomAssets } from '../../redux/app';
import { CAMERA, PLAYER, ROOT } from '../../lib/sdk/tree';

import './EntityIcon.css';

const EntityIcon = withSdk<{ value: Entity }>(({ sdk, value }) => {
  const customAssets = useAppSelector(selectCustomAssets);

  const isSmart = useMemo(
    () =>
      sdk.components.Actions.has(value) ||
      sdk.components.Triggers.has(value) ||
      sdk.components.States.has(value) ||
      sdk.components.TextShape.has(value) ||
      sdk.components.NftShape.has(value) ||
      sdk.components.VisibilityComponent.has(value) ||
      sdk.components.VideoScreen.has(value) ||
      sdk.components.AdminTools.has(value),
    [sdk, value],
  );

  const isCustom = useMemo(() => {
    if (sdk.components.CustomAsset.has(value)) {
      const { assetId } = sdk.components.CustomAsset.get(value);
      const customAsset = customAssets.find(asset => asset.id === assetId);
      return !!customAsset;
    }
    return false;
  }, [sdk, value, customAssets]);

  const isTile = useMemo(() => sdk.components.Tile.has(value), [sdk, value]);

  const isGroup = useMemo(() => {
    const nodes = sdk.components.Nodes.getOrNull(ROOT)?.value;
    const node = nodes?.find(node => node.entity === value);
    return node && node.children.length > 0;
  }, [value]);

  if (value === ROOT) {
    return null;
  } else if (value === PLAYER) {
    return <span className="entity-type-icon player-icon"></span>;
  } else if (value === CAMERA) {
    return <span className="entity-type-icon camera-icon"></span>;
  } else if (isCustom) {
    return <span className="entity-type-icon custom-icon"></span>;
  } else if (isGroup) {
    return <span className="entity-type-icon group-icon"></span>;
  } else if (isSmart) {
    return <span className="entity-type-icon smart-icon"></span>;
  } else if (isTile) {
    return <span className="entity-type-icon tile-icon"></span>;
  } else {
    return <span className="entity-type-icon entity-icon"></span>;
  }
});

export default EntityIcon;
