import type { PBAvatarAttach } from '@dcl/ecs';

export type AvatarAttachInput = {
  anchorPointId: string;
};

export const fromAvatarAttach = (value: PBAvatarAttach): AvatarAttachInput => ({
  anchorPointId: (value.anchorPointId ?? 0).toString(),
});

export const toAvatarAttach = (input: AvatarAttachInput): PBAvatarAttach => ({
  anchorPointId: parseInt(input.anchorPointId, 10),
});

export const isValidInput = (): boolean => true;
