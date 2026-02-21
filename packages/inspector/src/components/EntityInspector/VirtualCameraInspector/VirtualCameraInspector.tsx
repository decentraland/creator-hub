import React, { useCallback, useMemo } from 'react';
import cx from 'classnames';

import { engine as CoreEngine } from '@dcl/ecs';
import type { Entity } from '@dcl/ecs';
import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { getComponentValue } from '../../../hooks/sdk/useComponentValue';
import { useComponentInput } from '../../../hooks/sdk/useComponentInput';
import { analytics, Event } from '../../../lib/logic/analytics';
import { getAssetByModel } from '../../../lib/logic/catalog';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { Dropdown, TextField } from '../../ui';
import { InfoTooltip } from '../../ui/InfoTooltip';
import { fromVirtualCamera, toVirtualCamera } from './utils';

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

  const { getInputProps } = useComponentInput(entity, VirtualCamera, fromVirtualCamera, input =>
    toVirtualCamera(input, VirtualCamera),
  );

  const transitionModeProps = getInputProps('transitionMode');
  const transitionValueProps = getInputProps('transitionValue');

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

  const lookAtEntityProps = getInputProps('lookAtEntity', (e: any) => {
    const raw = e.target.value as string;
    return raw === '' ? undefined : raw;
  });

  const lookAtValue: string = useMemo(() => {
    return (lookAtEntityProps.value as string | undefined) || '';
  }, [lookAtEntityProps.value]);

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

  if (!hasVirtualCamera) return null;

  const currentMode = transitionModeProps.value as ModeOptionValue;

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
          {...transitionModeProps}
        />
      </Block>
      <Block>
        <TextField
          type="number"
          label={currentMode === 'speed' ? 'Speed' : 'Time'}
          {...transitionValueProps}
          autoSelect
        />
      </Block>
      <Block label="Look At Entity">
        <Dropdown
          options={allEntityOptions}
          value={lookAtValue}
          {...lookAtEntityProps}
          searchable
        />
      </Block>
    </Container>
  );
});
