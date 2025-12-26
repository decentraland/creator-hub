import React, { useCallback, useMemo } from 'react';
import cx from 'classnames';

import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { getComponentValue } from '../../../hooks/sdk/useComponentValue';
import { CoreComponents } from '../../../lib/sdk/components';
import { analytics, Event } from '../../../lib/logic/analytics';
import { getAssetByModel } from '../../../lib/logic/catalog';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { Dropdown, TextField } from '../../ui';
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

  const currentValue = useMemo(() => {
    return VirtualCamera.getOrNull(entity) ?? null;
  }, [VirtualCamera, entity, hasVirtualCamera]);

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

  const handleRemove = useCallback(async () => {
    sdk.operations.removeComponent(entity, VirtualCamera);
    await sdk.operations.dispatch();
    const gltfContainer = getComponentValue(entity, GltfContainer);
    const asset = getAssetByModel(gltfContainer?.src);
    analytics.track(Event.REMOVE_COMPONENT, {
      componentName: CoreComponents.VIRTUAL_CAMERA,
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

  if (!hasVirtualCamera) return null;

  return (
    <Container
      label="Virtual Camera"
      className={cx('VirtualCamera')}
      initialOpen={initialOpen}
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
    </Container>
  );
});
