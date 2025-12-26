import React, { useCallback, useMemo } from 'react';
import cx from 'classnames';

import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { getComponentValue, useComponentValue } from '../../../hooks/sdk/useComponentValue';
import { analytics, Event } from '../../../lib/logic/analytics';
import { getAssetByModel } from '../../../lib/logic/catalog';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { Dropdown, TextField } from '../../ui';
import { InfoTooltip } from '../../ui/InfoTooltip';
import { engine as CoreEngine } from '@dcl/ecs';
import type { Entity } from '@dcl/ecs';

type Props = {
  entity: Entity;
  initialOpen?: boolean;
};

const MODE_OPTIONS = [
  { label: 'Time', value: 'time' },
  { label: 'Speed', value: 'speed' },
] as const;

type ModeOptionValue = (typeof MODE_OPTIONS)[number]['value'];

export default withSdk<Props>(({ sdk, entity, initialOpen = true }) => {
  const { VirtualCamera, GltfContainer } = sdk.components;
  const hasVirtualCamera = useHasComponent(entity, VirtualCamera);

  const dropdownOptions = useMemo(
    () => MODE_OPTIONS.map(opt => ({ label: opt.label, value: opt.value })),
    [],
  );

  const [vcValue] = useComponentValue(entity, VirtualCamera);
  const currentValue = vcValue ?? null;

  const mode: ModeOptionValue = useMemo(() => {
    const dt = (currentValue as any)?.defaultTransition;
    if (dt && typeof dt === 'object') {
      if (typeof dt.speed === 'number') return 'speed';
      if (typeof dt.time === 'number') return 'time';
    }
    return 'time';
  }, [currentValue]);

  const numericValue: number | '' = useMemo(() => {
    const dt = (currentValue as any)?.defaultTransition;
    if (mode === 'speed') {
      return typeof dt?.speed === 'number' ? dt.speed : 1;
    }
    return typeof dt?.time === 'number' ? dt.time : 1;
  }, [currentValue, mode]);

  const allEntityOptions = useMemo(() => {
    const { Name, Nodes } = sdk.components;
    const result: { label: string; value: string }[] = [
      { label: 'None', value: '' },
      { label: 'Player', value: String(CoreEngine.PlayerEntity) },
    ];
    const nodes = Nodes.getOrNull(sdk.engine.RootEntity)?.value || [];
    const seen = new Set<Entity>();
    for (const { entity: ent } of nodes) {
      if (ent === CoreEngine.RootEntity || ent === CoreEngine.CameraEntity) continue;
      if (seen.has(ent)) continue;
      seen.add(ent);
      const label = Name.getOrNull(ent)?.value ?? ent.toString();
      result.push({ label, value: String(ent) });
    }
    return result;
  }, [sdk]);

  const lookAtValue: string = useMemo(() => {
    const v = (currentValue as any)?.lookAtEntity as Entity | undefined;
    return v !== undefined ? String(v) : '';
  }, [currentValue]);

  const handleRemove = useCallback(async () => {
    sdk.operations.removeComponent(entity, VirtualCamera);
    await sdk.operations.dispatch();
    const gltfContainer = getComponentValue(entity, GltfContainer);
    const asset = getAssetByModel(gltfContainer?.src);
    analytics.track(Event.REMOVE_COMPONENT, {
      componentName: 'core::VirtualCamera',
      itemId: asset?.id,
      itemPath: gltfContainer?.src,
    });
  }, [sdk, entity, VirtualCamera, GltfContainer]);

  const handleChangeMode = useCallback(
    async (e: any) => {
      const nextMode = e.target.value as ModeOptionValue;
      const prev = VirtualCamera.getOrNull(entity) ?? {};
      const prevDt = (prev as any).defaultTransition ?? {};
      const nextDt =
        nextMode === 'speed'
          ? { speed: typeof prevDt.speed === 'number' ? prevDt.speed : 1 }
          : { time: typeof prevDt.time === 'number' ? prevDt.time : 1 };
      sdk.operations.updateValue(VirtualCamera, entity, {
        ...(prev as any),
        defaultTransition: nextDt,
      });
      await sdk.operations.dispatch();
    },
    [sdk, entity, VirtualCamera],
  );

  const handleChangeNumber = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const nextNumber = parseFloat(raw);
      if (Number.isNaN(nextNumber)) return;
      const prev = VirtualCamera.getOrNull(entity) ?? {};
      const nextDt = mode === 'speed' ? { speed: nextNumber } : { time: nextNumber };
      sdk.operations.updateValue(VirtualCamera, entity, {
        ...(prev as any),
        defaultTransition: nextDt,
      });
      await sdk.operations.dispatch();
    },
    [sdk, entity, VirtualCamera, mode],
  );

  const handleChangeLookAt = useCallback(
    async (e: any) => {
      const raw = e.target.value as string;
      const nextEntity: Entity | undefined =
        raw === '' ? undefined : (parseInt(raw, 10) as unknown as Entity);
      const prev = VirtualCamera.getOrNull(entity) ?? {};
      sdk.operations.updateValue(VirtualCamera, entity, {
        ...(prev as any),
        lookAtEntity: nextEntity,
      });
      await sdk.operations.dispatch();
    },
    [sdk, entity, VirtualCamera],
  );

  if (!hasVirtualCamera) return null;

  return (
    <Container
      label="Virtual Camera"
      className={cx('VirtualCamera')}
      initialOpen={initialOpen}
      rightContent={
        <InfoTooltip
          text="You can switch to this camera via code or via the Change Camera Action. See docs for details."
          link="https://docs.decentraland.org/creator/scenes-sdk7/3d-content-essentials/camera"
          type="help"
        />
      }
      onRemoveContainer={handleRemove}
    >
      <Block label="Default Transition Mode">
        <Dropdown
          options={dropdownOptions}
          value={mode}
          onChange={handleChangeMode as any}
        />
      </Block>
      <Block>
        <TextField
          type="number"
          label={mode === 'speed' ? 'Speed' : 'Time'}
          value={numericValue}
          onChange={handleChangeNumber}
          autoSelect
        />
      </Block>
      <Block label="Look At Entity">
        <Dropdown
          options={allEntityOptions}
          value={lookAtValue}
          onChange={handleChangeLookAt as any}
          searchable
        />
      </Block>
    </Container>
  );
});
