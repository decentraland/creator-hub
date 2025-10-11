import React, { useCallback } from 'react';
import type { Entity } from '@dcl/ecs';

import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { useComponentInput } from '../../../hooks/sdk/useComponentInput';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { CheckboxField, Dropdown, RangeField, TextField, InfoTooltip } from '../../ui';

type Props = { entity: Entity; initialOpen?: boolean };

type TransitionMode = 'time' | 'speed';

type VirtualCameraInput = {
  lookAtEntity?: string; // store as string in input form for compatibility
  defaultTransition?: {
    mode: TransitionMode;
    value: string; // seconds or m/s
  };
};

const fromComponent = (value: any): VirtualCameraInput => {
  const mode: TransitionMode =
    value?.defaultTransition?.transitionMode?.$case === 'speed' ? 'speed' : 'time';
  const v = value?.defaultTransition?.transitionMode?.[mode]?.value ?? 0;
  return {
    lookAtEntity: value?.lookAtEntity !== undefined ? String(value.lookAtEntity) : '',
    defaultTransition: { mode, value: String(v) },
  };
};

const toComponent = (input: VirtualCameraInput): any => {
  const isSpeed = input.defaultTransition?.mode === 'speed';
  const transitionMode = isSpeed
    ? { $case: 'speed', speed: { value: Number(input.defaultTransition?.value || 0) } }
    : { $case: 'time', time: { value: Number(input.defaultTransition?.value || 0) } };
  return {
    lookAtEntity:
      input.lookAtEntity && input.lookAtEntity.length > 0 ? Number(input.lookAtEntity) : undefined,
    defaultTransition: { transitionMode },
  };
};

const TRANSITION_OPTIONS = [
  { label: 'Fixed Time', value: 'time' },
  { label: 'Fixed Speed', value: 'speed' },
];

export default withSdk<Props>(({ sdk, entity, initialOpen = true }) => {
  const { VirtualCamera } = sdk.components as any;
  const has = useHasComponent(entity, VirtualCamera);
  const { getInputProps } = useComponentInput(entity, VirtualCamera, fromComponent, toComponent);

  const handleRemove = useCallback(async () => {
    sdk.operations.removeComponent(entity, VirtualCamera);
    await sdk.operations.dispatch();
  }, []);

  if (!has) return null;

  const lookAt = getInputProps('lookAtEntity');
  const lookAtOptions = React.useMemo(() => {
    const options: Array<{ label: string; value: string | number }> = [
      { label: 'None', value: '' },
    ];
    const { Name, Nodes } = sdk.components;
    const nodes = Nodes.getOrNull(sdk.engine.RootEntity)?.value || [];
    const player = (sdk.engine as any).PlayerEntity;
    const camera = sdk.engine.CameraEntity;
    for (const { entity: e } of nodes) {
      if (e === 0 || e === entity || e === camera) continue;
      const label = e === player ? 'Player' : (Name.getOrNull(e)?.value ?? String(e));
      options.push({ label, value: e });
    }
    return options;
  }, [sdk, entity]);

  return (
    <Container
      label="Virtual Camera"
      className="VirtualCamera"
      initialOpen={initialOpen}
      rightContent={
        <InfoTooltip
          text="Configure a virtual camera for the scene."
          link="https://docs.decentraland.org/creator/development-guide/sdk7/camera/"
          type="help"
        />
      }
      onRemoveContainer={handleRemove}
    >
      <Block label="Look at entity (optional)">
        <Dropdown
          options={lookAtOptions}
          {...lookAt}
        />
      </Block>
      <Container
        label="Default Transition"
        border
        initialOpen={false}
      >
        <Dropdown
          label="Mode"
          options={TRANSITION_OPTIONS}
          {...(getInputProps as any)('defaultTransition.mode')}
        />
        <TextField
          label="Value"
          type="number"
          {...(getInputProps as any)('defaultTransition.value')}
        />
      </Container>
    </Container>
  );
});
