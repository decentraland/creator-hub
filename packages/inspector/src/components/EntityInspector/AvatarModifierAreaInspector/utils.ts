import { AvatarModifierType } from '@dcl/ecs';

export const MODIFIER_OPTIONS = [
  { label: 'Hide Avatars', value: String(AvatarModifierType.AMT_HIDE_AVATARS) },
  { label: 'Disable Passports', value: String(AvatarModifierType.AMT_DISABLE_PASSPORTS) },
];

export function fromModifiers(modifiers: readonly AvatarModifierType[] = []): string[] {
  return modifiers.map(modifier => String(modifier));
}

export function toModifiers(values: readonly string[]): AvatarModifierType[] {
  return values.map(value => Number(value) as AvatarModifierType);
}
