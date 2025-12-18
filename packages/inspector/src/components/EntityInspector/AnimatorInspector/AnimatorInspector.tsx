import React, { useCallback, useEffect } from 'react';
import cx from 'classnames';
import type { PBAnimationState, PBAnimator } from '@dcl/ecs';

import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { getComponentValue, useComponentValue } from '../../../hooks/sdk/useComponentValue';
import { useGltfAnimations } from '../../../hooks/sdk/useGltfAnimations';
import { analytics, Event } from '../../../lib/logic/analytics';
import { getAssetByModel } from '../../../lib/logic/catalog';
import { CoreComponents } from '../../../lib/sdk/components';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { TextField, CheckboxField, RangeField, InfoTooltip } from '../../ui';
import { useArrayState } from '../../../hooks/useArrayState';
import {
  fromNumber,
  toNumber,
  isValidSpeed,
  isValidWeight,
  initializeAnimatorComponent,
  mapAnimationGroupsToStates,
} from './utils';
import type { Props } from './types';

type ChangeEvt = React.ChangeEvent<HTMLInputElement>;

export default withSdk<Props>(({ sdk, entity: entityId, initialOpen = true }) => {
  const { Animator, GltfContainer } = sdk.components;

  const hasAnimator = useHasComponent(entityId, Animator);
  const [componentValue, setComponentValue, isComponentEqual] = useComponentValue<PBAnimator>(
    entityId,
    Animator,
  );
  const animations = useGltfAnimations(entityId);

  const [states, _, updateStates, _2, setStates] = useArrayState<PBAnimationState>(
    componentValue === null ? [] : componentValue.states,
  );

  // Initialize Animator component if GLTF has animations but no Animator yet
  useEffect(() => {
    if (hasAnimator || animations.length === 0) return;

    void initializeAnimatorComponent(sdk, entityId, animations);
  }, [animations, hasAnimator, sdk, entityId]);

  // Sync animation states when animations change
  useEffect(() => {
    if (!hasAnimator || animations.length === 0) return;

    // Update states if they don't match the animations
    if (!states.length || states[0].clip !== animations[0].name) {
      const newStates = mapAnimationGroupsToStates(animations);
      setStates(newStates);
    }
  }, [animations, hasAnimator, states, setStates]);

  useEffect(() => {
    if (isComponentEqual({ states })) {
      return;
    }
    setComponentValue({ states });
  }, [states]);

  const handleRemove = useCallback(async () => {
    sdk.operations.removeComponent(entityId, Animator);
    await sdk.operations.dispatch();
    const gltfContainer = getComponentValue(entityId, GltfContainer);
    const asset = getAssetByModel(gltfContainer.src);
    analytics.track(Event.REMOVE_COMPONENT, {
      componentName: CoreComponents.ANIMATOR,
      itemId: asset?.id,
      itemPath: gltfContainer.src,
    });
  }, []);

  const handleStateChange = useCallback(
    (newValue: Partial<PBAnimationState>, idx: number) => {
      updateStates(idx, { ...states[idx], ...newValue });
    },
    [states, updateStates],
  );

  if (!hasAnimator || !states.length) return null;

  return (
    <Container
      label="Animator"
      className={cx('Animator')}
      initialOpen={initialOpen}
      rightContent={
        <InfoTooltip
          text="The weight value of all active animations in an entity should add up to 100 at all times. If it adds up to less than 100, the weighted average will be using the default position of the armature for the remaining part of the calculation"
          link="https://docs.decentraland.org/creator/development-guide/sdk7/3d-model-animations"
          type="help"
        />
      }
      onRemoveContainer={handleRemove}
    >
      {states.map(($, idx) => (
        <React.Fragment key={idx}>
          <Block label="Clip">
            <TextField
              autoSelect
              type="text"
              disabled
              value={$.clip}
            />
          </Block>
          <Block label="Playing">
            <CheckboxField
              label="Start playing"
              checked={!!$.playing}
              onChange={e => handleStateChange({ playing: !!e.target.checked }, idx)}
            />
            <CheckboxField
              label="Loop"
              checked={!!$.loop}
              onChange={e => handleStateChange({ loop: !!e.target.checked }, idx)}
            />
          </Block>
          <Block label="Weight">
            <RangeField
              onChange={(e: ChangeEvt) =>
                handleStateChange({ weight: Number(e.target.value) }, idx)
              }
              value={$.weight ?? 1}
              isValidValue={isValidWeight}
              step={0.01}
              min={0}
              max={1}
            />
          </Block>
          <Block label="Speed">
            <RangeField
              max={200}
              onChange={(e: ChangeEvt) =>
                handleStateChange({ speed: toNumber(e.target.value) }, idx)
              }
              value={fromNumber($.speed ?? 1)}
              isValidValue={isValidSpeed}
            />
          </Block>
          <Block label="Should reset">
            <CheckboxField
              checked={!!$.shouldReset}
              onChange={e => handleStateChange({ shouldReset: !!e.target.checked }, idx)}
            />
          </Block>
        </React.Fragment>
      ))}
    </Container>
  );
});
