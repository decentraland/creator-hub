import { useCallback, useEffect } from 'react';
import cx from 'classnames';
import { EasingFunction } from '@dcl/ecs';
import { TweenType } from '@dcl/asset-packs';

import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { useComponentInput } from '../../../hooks/sdk/useComponentInput';
import { getComponentValue } from '../../../hooks/sdk/useComponentValue';
import { analytics, Event } from '../../../lib/logic/analytics';
import { getAssetByModel } from '../../../lib/logic/catalog';
import { CoreComponents } from '../../../lib/sdk/components';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { TextField, CheckboxField, InfoTooltip, Dropdown, RangeField } from '../../ui';
import { fromTween, toTween, fromTweenSequence, toTweenSequence, withModeDefaults } from './utils';
import {
  ContinuousTweenType,
  UNSUPPORTED_TWEEN_TYPE,
  type Props,
  type TweenModeType,
} from './types';

const TweenTypeOptions = [
  { label: 'Move Item', value: TweenType.MOVE_ITEM },
  { label: 'Rotate Item', value: TweenType.ROTATE_ITEM },
  { label: 'Scale Item', value: TweenType.SCALE_ITEM },
  { label: 'Move Continuous', value: ContinuousTweenType.MOVE_CONTINUOUS },
  { label: 'Rotate Continuous', value: ContinuousTweenType.ROTATE_CONTINUOUS },
];

const UnsupportedModeLabels: Record<string, string> = {
  textureMove: 'Texture Move',
  textureMoveContinuous: 'Texture Move Continuous',
  moveRotateScale: 'Move, Rotate & Scale',
};

const EasingFunctionOptions = [
  EasingFunction.EF_LINEAR,
  EasingFunction.EF_EASEINQUAD,
  EasingFunction.EF_EASEOUTQUAD,
  EasingFunction.EF_EASEQUAD,
  EasingFunction.EF_EASEINSINE,
  EasingFunction.EF_EASEOUTSINE,
  EasingFunction.EF_EASESINE,
  EasingFunction.EF_EASEINEXPO,
  EasingFunction.EF_EASEOUTEXPO,
  EasingFunction.EF_EASEEXPO,
  EasingFunction.EF_EASEINELASTIC,
  EasingFunction.EF_EASEOUTELASTIC,
  EasingFunction.EF_EASEELASTIC,
  EasingFunction.EF_EASEINBOUNCE,
  EasingFunction.EF_EASEOUTBOUNCE,
  EasingFunction.EF_EASEBOUNCE,
];

const EasingFunctionMapOption: Record<string, string> = {
  [EasingFunction.EF_LINEAR]: 'Linear',
  [EasingFunction.EF_EASEINQUAD]: 'Ease in Quad',
  [EasingFunction.EF_EASEOUTQUAD]: 'Ease out Quad',
  [EasingFunction.EF_EASEQUAD]: 'Ease Quad',
  [EasingFunction.EF_EASEINSINE]: 'Ease in Sine',
  [EasingFunction.EF_EASEOUTSINE]: 'Ease out Sine',
  [EasingFunction.EF_EASESINE]: 'Ease in/out Sine',
  [EasingFunction.EF_EASEINEXPO]: 'Ease in Expo',
  [EasingFunction.EF_EASEOUTEXPO]: 'Ease out Expo',
  [EasingFunction.EF_EASEEXPO]: 'Ease in/out Expo',
  [EasingFunction.EF_EASEINELASTIC]: 'Ease in Elastic',
  [EasingFunction.EF_EASEOUTELASTIC]: 'Ease out Elastic',
  [EasingFunction.EF_EASEELASTIC]: 'Ease in/out Elastic',
  [EasingFunction.EF_EASEINBOUNCE]: 'Ease in Bounce',
  [EasingFunction.EF_EASEOUTBOUNCE]: 'Ease out Bounce',
  [EasingFunction.EF_EASEBOUNCE]: 'Ease in/out Bounce',
};

export default withSdk<Props>(({ sdk, entity, initialOpen = true }) => {
  const { Tween, TweenSequence, GltfContainer } = sdk.components;
  const hasTween = useHasComponent(entity, Tween);
  const hasTweenSequence = useHasComponent(entity, TweenSequence);
  const { getInputProps: getTweenInputProps } = useComponentInput(
    entity,
    Tween,
    fromTween,
    toTween,
  );
  const { getInputProps: getTweenSequenceInputProps } = useComponentInput(
    entity,
    TweenSequence,
    fromTweenSequence,
    toTweenSequence,
  );

  const handleRemove = useCallback(async () => {
    sdk.operations.removeComponent(entity, Tween);
    await sdk.operations.dispatch();
    sdk.operations.removeComponent(entity, TweenSequence);
    await sdk.operations.dispatch();
    const gltfContainer = getComponentValue(entity, GltfContainer);
    const asset = getAssetByModel(gltfContainer.src);
    analytics.track(Event.REMOVE_COMPONENT, {
      componentName: CoreComponents.TWEEN,
      itemId: asset?.id,
      itemPath: gltfContainer.src,
    });
  }, []);

  useEffect(() => {
    if (!hasTween) return;
    if (!hasTweenSequence) {
      sdk.operations.addComponent(entity, TweenSequence.componentId);
      void sdk.operations.dispatch();
    }
  }, [hasTween, hasTweenSequence]);

  if (!hasTween || !hasTweenSequence) return null;

  const playing = getTweenInputProps('playing', e => e.target.checked);
  const loop = getTweenSequenceInputProps('loop', e => e.target.checked);
  const typeProps = getTweenInputProps('type');
  const tweenType = typeProps.value;

  // Bypasses the per-field input so the whole mode is replaced in one write; the input hook
  // re-derives its state from the engine value afterwards.
  const handleTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const current = getComponentValue(entity, Tween);
      const next = withModeDefaults(fromTween(current), e.target.value as TweenModeType);
      sdk.operations.updateValue(Tween, entity, toTween(next));
      void sdk.operations.dispatch();
    },
    [sdk, entity, Tween],
  );
  const isRotateContinuous = tweenType === ContinuousTweenType.ROTATE_CONTINUOUS;
  const isContinuous = tweenType === ContinuousTweenType.MOVE_CONTINUOUS || isRotateContinuous;
  const isUnsupported = tweenType === UNSUPPORTED_TWEEN_TYPE;
  const unsupportedMode = getTweenInputProps('unsupportedMode').value?.toString() ?? '';
  const tweenTypeOptions = isUnsupported
    ? [
        ...TweenTypeOptions,
        {
          label: `${UnsupportedModeLabels[unsupportedMode] ?? unsupportedMode} (not editable)`,
          value: UNSUPPORTED_TWEEN_TYPE,
          disabled: true,
        },
      ]
    : TweenTypeOptions;

  return (
    <Container
      label="Tween"
      className={cx('Tween')}
      initialOpen={initialOpen}
      rightContent={
        <InfoTooltip
          text="More information related the tweens in the following link."
          link="https://docs.decentraland.org/creator/scenes-sdk7/3d-content-essentials/move-entities"
          type="help"
        />
      }
      component={Tween}
      entity={entity}
      onRemoveContainer={handleRemove}
    >
      <Block
        label={
          <>
            Tween Type{' '}
            <InfoTooltip
              text="Move, Rotate and Scale Item animate from a start to an end value over the Duration. Move Continuous and Rotate Continuous keep the item moving or spinning at a constant speed, with no end value."
              type="help"
            />
          </>
        }
      >
        <Dropdown
          placeholder="Select a Tween Type"
          options={tweenTypeOptions}
          {...typeProps}
          onChange={handleTypeChange}
        />
      </Block>
      {!isContinuous && !isUnsupported && (
        <>
          <Block label="Start">
            <TextField
              autoSelect
              leftLabel="X"
              type="number"
              {...getTweenInputProps('start.x')}
            />
            <TextField
              autoSelect
              leftLabel="Y"
              type="number"
              {...getTweenInputProps('start.y')}
            />
            <TextField
              autoSelect
              leftLabel="Z"
              type="number"
              {...getTweenInputProps('start.z')}
            />
          </Block>
          <Block label="End">
            <TextField
              autoSelect
              leftLabel="X"
              type="number"
              {...getTweenInputProps('end.x')}
            />
            <TextField
              autoSelect
              leftLabel="Y"
              type="number"
              {...getTweenInputProps('end.y')}
            />
            <TextField
              autoSelect
              leftLabel="Z"
              type="number"
              {...getTweenInputProps('end.z')}
            />
          </Block>
          <Block>
            <RangeField
              step={0.1}
              label="Duration"
              {...getTweenInputProps('duration')}
            />
          </Block>
          <Block>
            <Dropdown
              label="Easing Function"
              options={[
                ...EasingFunctionOptions.map(easingFunctionType => ({
                  label: EasingFunctionMapOption[easingFunctionType],
                  value: easingFunctionType,
                })),
              ]}
              {...getTweenInputProps('easingFunction')}
            />
          </Block>
        </>
      )}
      {isContinuous && (
        <>
          <Block
            label={
              <>
                {isRotateContinuous ? 'Rotation Axis (degrees)' : 'Direction'}{' '}
                <InfoTooltip
                  text={
                    isRotateContinuous
                      ? 'Axis to spin around, entered as Euler degrees: for example 0, 90, 0 spins around Y. Only the axis matters, the angle size is ignored. The rate is set by Speed.'
                      : 'Direction of travel: for example 0, 0, 1 moves forward along Z. Use a unit-length vector so Speed is exactly meters per second.'
                  }
                  type="help"
                />
              </>
            }
          >
            <TextField
              autoSelect
              leftLabel="X"
              type="number"
              {...getTweenInputProps('direction.x')}
            />
            <TextField
              autoSelect
              leftLabel="Y"
              type="number"
              {...getTweenInputProps('direction.y')}
            />
            <TextField
              autoSelect
              leftLabel="Z"
              type="number"
              {...getTweenInputProps('direction.z')}
            />
          </Block>
          <Block
            label={
              <>
                {isRotateContinuous ? 'Speed (degrees/sec)' : 'Speed (meters/sec)'}{' '}
                <InfoTooltip
                  text={
                    isRotateContinuous
                      ? 'How fast the item spins around the axis, in degrees per second. A negative value spins the opposite way.'
                      : 'How fast the item moves along the Direction, in meters per second. A negative value moves the opposite way.'
                  }
                  type="help"
                />
              </>
            }
          >
            <TextField
              autoSelect
              type="number"
              {...getTweenInputProps('speed')}
            />
          </Block>
        </>
      )}
      <Block>
        <CheckboxField
          label={
            <>
              Playing{' '}
              <InfoTooltip
                text="When on, the tween runs as soon as the scene loads. When off, it is created paused at its Start value and only runs once a script sets playing to true; the Start Tween action creates a separate tween instead of resuming this one."
                type="help"
              />
            </>
          }
          checked={!!playing.value}
          {...playing}
        />
        {!isContinuous && (
          <CheckboxField
            label="Loop"
            checked={!!loop.value}
            {...loop}
          />
        )}
      </Block>
    </Container>
  );
});
