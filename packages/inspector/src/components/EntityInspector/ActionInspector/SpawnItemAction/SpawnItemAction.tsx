import React, { useCallback, useMemo, useState } from 'react';
import { type ActionPayload, type ActionType } from '@dcl/asset-packs';
import type { Vector3 } from '@dcl/ecs-math';
import { recursiveCheck } from '../../../../lib/utils/deep-equal';
import { useAppSelector } from '../../../../redux/hooks';
import { selectCustomAssets } from '../../../../redux/app';
import { getDataLayerInterface } from '../../../../redux/data-layer';
import { Dropdown, TextField, InfoTooltip } from '../../../ui';
import type { Props } from './types';

import './SpawnItemAction.css';

const CUSTOM_ITEM_BUNDLE_DIR = 'assets/custom';

function isNumeric(value?: number) {
  return value !== undefined && !isNaN(value);
}

function isValid(
  payload: Partial<ActionPayload<ActionType.SPAWN_ITEM>>,
): payload is ActionPayload<ActionType.SPAWN_ITEM> {
  return (
    !!payload &&
    typeof payload.src === 'string' &&
    payload.src.length > 0 &&
    payload.position !== undefined &&
    isNumeric(payload.position.x) &&
    isNumeric(payload.position.y) &&
    isNumeric(payload.position.z)
  );
}

/**
 * Resolve the `{assetPath}` tokens in a composite JSON string, replacing them
 * with the relative path to the custom item's resource directory in the scene.
 */
function resolveAssetPathTokens(compositeJson: string, slug: string): string {
  return compositeJson.replace(/\{assetPath\}/g, `custom/${slug}`);
}

/**
 * Derive a filesystem-safe slug from a custom item directory resource path.
 * Resources are stored under `custom/{slug}/…` so the second path segment is the slug.
 */
function getSlugFromResources(resources: string[]): string | null {
  if (resources.length === 0) return null;
  const parts = resources[0].split('/');
  return parts.length >= 2 ? parts[1] : null;
}

const SpawnItemAction: React.FC<Props> = ({ value, onUpdate }: Props) => {
  const customAssets = useAppSelector(selectCustomAssets);
  const [payload, setPayload] = useState<Partial<ActionPayload<ActionType.SPAWN_ITEM>>>({
    ...value,
  });
  const [bundling, setBundling] = useState(false);

  const handleUpdate = useCallback(
    (_payload: Partial<ActionPayload<ActionType.SPAWN_ITEM>>) => {
      setPayload(_payload);
      if (!recursiveCheck(_payload, value, 2) || !isValid(_payload)) return;
      onUpdate(_payload);
    },
    [setPayload, value, onUpdate],
  );

  const customItemOptions = useMemo(
    () => [
      { label: 'Select a Custom Item…', value: '' },
      ...customAssets.map(asset => ({ label: asset.name, value: asset.id })),
    ],
    [customAssets],
  );

  const selectedAssetId = useMemo(() => {
    if (!payload.src) return '';
    // Reverse-lookup the asset whose bundled composite matches the stored src
    for (const asset of customAssets) {
      const slug = getSlugFromResources(asset.resources);
      if (slug && payload.src === `${CUSTOM_ITEM_BUNDLE_DIR}/${slug}.composite`) {
        return asset.id;
      }
    }
    return '';
  }, [payload.src, customAssets]);

  const handleSelectCustomItem = useCallback(
    async ({ target: { value: assetId } }: React.ChangeEvent<HTMLSelectElement>) => {
      if (!assetId) return;

      const asset = customAssets.find(a => a.id === assetId);
      if (!asset) return;

      const slug = getSlugFromResources(asset.resources);
      if (!slug) {
        console.warn('[SpawnItemAction] Cannot determine slug for custom item', asset.id);
        return;
      }

      const targetSrc = `${CUSTOM_ITEM_BUNDLE_DIR}/${slug}.composite`;

      // Bundle the composite into scene assets via saveFile
      const dataLayer = getDataLayerInterface();
      if (dataLayer) {
        setBundling(true);
        try {
          const compositeJson = JSON.stringify(asset.composite, null, 2);
          const resolved = resolveAssetPathTokens(compositeJson, slug);
          const content = new TextEncoder().encode(resolved);
          await dataLayer.saveFile({ path: targetSrc, content });
        } catch (err) {
          console.error('[SpawnItemAction] Failed to bundle composite:', err);
        } finally {
          setBundling(false);
        }
      }

      handleUpdate({ ...payload, src: targetSrc });
    },
    [customAssets, payload, handleUpdate],
  );

  const handleChangePositionX = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
      if (!value) return;
      handleUpdate({
        ...payload,
        position: { ...(payload.position as Vector3), x: parseFloat(value) },
      });
    },
    [payload, handleUpdate],
  );

  const handleChangePositionY = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
      if (!value) return;
      handleUpdate({
        ...payload,
        position: { ...(payload.position as Vector3), y: parseFloat(value) },
      });
    },
    [payload, handleUpdate],
  );

  const handleChangePositionZ = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
      if (!value) return;
      handleUpdate({
        ...payload,
        position: { ...(payload.position as Vector3), z: parseFloat(value) },
      });
    },
    [payload, handleUpdate],
  );

  const renderPositionInfo = useMemo(
    () => (
      <InfoTooltip
        text="Position where the Custom Item will be spawned, relative to the scene origin. X: left/right, Y: up/down, Z: forward/backward."
        position="top center"
      />
    ),
    [],
  );

  return (
    <div className="SpawnItemActionContainer">
      <div className="row">
        <Dropdown
          label="Custom Item"
          value={selectedAssetId}
          options={customItemOptions}
          onChange={handleSelectCustomItem}
          disabled={bundling}
        />
      </div>
      {customAssets.length === 0 && (
        <div className="row">
          <p className="SpawnItemActionContainer__hint">
            No Custom Items found in this scene. Save entities as Custom Items first.
          </p>
        </div>
      )}
      <div className="row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
          <div style={{ flex: 1, display: 'flex', gap: '8px' }}>
            <TextField
              leftLabel="X"
              type="number"
              value={payload.position?.x}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChangePositionX(e)}
              autoSelect
            />
            <TextField
              leftLabel="Y"
              type="number"
              value={payload.position?.y}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChangePositionY(e)}
              autoSelect
            />
            <TextField
              leftLabel="Z"
              type="number"
              value={payload.position?.z}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChangePositionZ(e)}
              autoSelect
            />
          </div>
          {renderPositionInfo}
        </div>
      </div>
    </div>
  );
};

export default React.memo(SpawnItemAction);
