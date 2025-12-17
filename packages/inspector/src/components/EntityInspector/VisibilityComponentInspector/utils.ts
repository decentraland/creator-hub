import type { PBVisibilityComponent } from '@dcl/ecs';

export type VisibilityInput = {
  visible: string;
};

export const fromVisibility = (value: PBVisibilityComponent): VisibilityInput => ({
  visible: (value.visible ?? true).toString(),
});

export const toVisibility = (input: VisibilityInput): PBVisibilityComponent => ({
  visible: input.visible === 'true',
});

export const isValidInput = (): boolean => true;
