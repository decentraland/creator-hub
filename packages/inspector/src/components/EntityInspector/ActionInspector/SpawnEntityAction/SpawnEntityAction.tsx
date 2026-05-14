import React, { useCallback, useMemo, useState } from 'react';
import { type ActionPayload, type ActionType } from '@dcl/asset-packs';
import { type Vector3 } from '@dcl/ecs-math';
import { recursiveCheck } from '../../../../lib/utils/deep-equal';
import { useAppSelector } from '../../../../redux/hooks';
import { selectAssetCatalog } from '../../../../redux/app';
import { TextField, InfoTooltip, Dropdown } from '../../../ui';
import type { Props } from './types';
import './SpawnEntityAction.css';

const COMPOSITE_SUFFIXES = ['.json', '.composite', '.composite.bin'];
const EXCLUDED_PATH_PREFIX = 'assets/scene/';

function isSpawnableComposite(assetPath: string): boolean {
  const lower = assetPath.toLowerCase();
  if (lower.startsWith(EXCLUDED_PATH_PREFIX)) return false;
  return COMPOSITE_SUFFIXES.some(suffix => lower.endsWith(suffix));
}

function isNumeric(value?: number) {
  return value !== undefined && !isNaN(value);
}

function isValid(
  payload: Partial<ActionPayload<ActionType.SPAWN_ENTITY>>,
): payload is ActionPayload<ActionType.SPAWN_ENTITY> {
  return (
    typeof payload.src === 'string' &&
    payload.src.length > 0 &&
    payload.position !== undefined &&
    isNumeric(payload.position.x) &&
    isNumeric(payload.position.y) &&
    isNumeric(payload.position.z)
  );
}

const SpawnEntityAction: React.FC<Props> = ({ value, onUpdate }: Props) => {
  const catalog = useAppSelector(selectAssetCatalog);

  const compositeOptions = useMemo(() => {
    if (!catalog?.assets) return [];
    return catalog.assets
      .filter(({ path }) => isSpawnableComposite(path))
      .map(({ path }) => ({ label: path, value: path }));
  }, [catalog]);

  const [payload, setPayload] = useState<Partial<ActionPayload<ActionType.SPAWN_ENTITY>>>({
    ...value,
  });

  const handleUpdate = useCallback(
    (_payload: Partial<ActionPayload<ActionType.SPAWN_ENTITY>>) => {
      setPayload(_payload);
      if (!recursiveCheck(_payload, value, 2) || !isValid(_payload)) return;
      onUpdate(_payload);
    },
    [setPayload, value, onUpdate],
  );

  const handleChangeSrc = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLSelectElement>) => {
      handleUpdate({ ...payload, src: value });
    },
    [payload, handleUpdate],
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

  const renderSrcInfo = useMemo(
    () => (
      <InfoTooltip
        text="Pick a composite file already in the scene. The composite is fetched on demand the first time it spawns and cached for subsequent spawns."
        position="right center"
      />
    ),
    [],
  );

  const renderPositionInfo = useMemo(
    () => (
      <InfoTooltip
        text="Position where the spawned entity will be placed, relative to the entity owning this action. X: left/right, Y: up/down, Z: forward/backward."
        position="top center"
      />
    ),
    [],
  );

  return (
    <div className="SpawnEntityActionContainer">
      <div className="row">
        <div className="field">
          <Dropdown
            label={<>Source {renderSrcInfo}</>}
            value={payload.src ?? ''}
            options={[{ label: 'Select a composite', value: '' }, ...compositeOptions]}
            onChange={handleChangeSrc}
            disabled={compositeOptions.length === 0}
          />
        </div>
      </div>
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

export default React.memo(SpawnEntityAction);
