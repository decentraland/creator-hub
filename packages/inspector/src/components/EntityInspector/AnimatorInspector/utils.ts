import type { Entity, PBAnimationState, PBAnimator } from '@dcl/ecs';
import { Animator } from '@dcl/ecs';

import type { SdkContextValue } from '../../../lib/sdk/context';

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

// Build animation states from clip names. A freshly-loaded clip uses the
// default playback values (weight 1, not playing, speed 1, no loop) — the same
// values the renderer's animation groups report at load time.
export function mapAnimationNamesToStates(clipNames: string[]): PBAnimationState[] {
  return clipNames.map(clip => ({
    weight: 1,
    clip,
    playing: false,
    speed: 1,
    loop: false,
    shouldReset: false,
  }));
}

export async function initializeAnimatorComponent(
  sdk: SdkContextValue,
  entity: Entity,
  clipNames: string[],
): Promise<PBAnimator> {
  const states = mapAnimationNamesToStates(clipNames);
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
