import type { Entity, PBAnimationState, PBAnimator } from '@dcl/ecs';
import { Animator } from '@dcl/ecs';

import type { SdkContextValue } from '../../../lib/sdk/context';
import type { RendererAnimation } from '../../../lib/renderer/types';

export function fromNumber(value: string | number, mul: number = 100) {
  return Number(value) * mul;
}

export function toNumber(value: string | number, div: number = 100) {
  return Number(value) / div;
}

export function isValidWeight(weight: string | undefined): boolean {
  const value = (weight ?? '').toString();
  return !isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 1;
}

export function isValidSpeed(speed: string | undefined): boolean {
  const value = (speed ?? '').toString();
  return !isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 200;
}

// Build animation states from the renderer's clips, honoring any GLTF-authored
// playback values the renderer reports and falling back to the inspector
// defaults (weight 1, not playing, speed 1, no loop) for anything omitted.
export function mapAnimationsToStates(animations: RendererAnimation[]): PBAnimationState[] {
  return animations.map(({ name, weight, speed, loop, playing }) => ({
    weight: weight ?? 1,
    clip: name,
    playing: playing ?? false,
    speed: speed ?? 1,
    loop: loop ?? false,
    shouldReset: false,
  }));
}

export async function initializeAnimatorComponent(
  sdk: SdkContextValue,
  entity: Entity,
  animations: RendererAnimation[],
): Promise<PBAnimator> {
  const states = mapAnimationsToStates(animations);
  const value: PBAnimator = { states };

  try {
    sdk.operations.addComponent(entity, Animator.componentId);
    sdk.operations.updateValue(Animator, entity, value);
    await sdk.operations.dispatch();
  } catch (error) {
    console.warn('Failed to initialize animator component:', error);
    throw error;
  }

  return value;
}
