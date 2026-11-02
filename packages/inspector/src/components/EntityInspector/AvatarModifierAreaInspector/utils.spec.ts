import { AvatarModifierType } from '@dcl/ecs';

import {
  MODIFIER_OPTIONS,
  addExcludeId,
  fromModifiers,
  removeExcludeId,
  toModifiers,
  updateExcludeId,
} from './utils';

describe('AvatarModifierAreaInspector utils', () => {
  describe('MODIFIER_OPTIONS', () => {
    it('should offer Hide Avatars and Disable Passports', () => {
      expect(MODIFIER_OPTIONS).toEqual([
        { label: 'Hide Avatars', value: String(AvatarModifierType.AMT_HIDE_AVATARS) },
        { label: 'Disable Passports', value: String(AvatarModifierType.AMT_DISABLE_PASSPORTS) },
      ]);
    });
  });

  describe('fromModifiers', () => {
    it('should convert modifier enum values to strings', () => {
      expect(
        fromModifiers([
          AvatarModifierType.AMT_HIDE_AVATARS,
          AvatarModifierType.AMT_DISABLE_PASSPORTS,
        ]),
      ).toEqual(['0', '1']);
    });

    describe('when the modifiers are undefined', () => {
      it('should return an empty array', () => {
        expect(fromModifiers(undefined)).toEqual([]);
      });
    });
  });

  describe('toModifiers', () => {
    it('should convert string values back to modifier enum values', () => {
      expect(toModifiers(['0', '1'])).toEqual([
        AvatarModifierType.AMT_HIDE_AVATARS,
        AvatarModifierType.AMT_DISABLE_PASSPORTS,
      ]);
    });
  });

  describe('addExcludeId', () => {
    it('should append an empty entry', () => {
      expect(addExcludeId(['0xa'])).toEqual(['0xa', '']);
    });

    describe('when the list is undefined', () => {
      it('should return a list with a single empty entry', () => {
        expect(addExcludeId(undefined)).toEqual(['']);
      });
    });
  });

  describe('updateExcludeId', () => {
    it('should replace the entry at the given index', () => {
      expect(updateExcludeId(['0xa', '0xb'], 1, '0xc')).toEqual(['0xa', '0xc']);
    });

    it('should not mutate the original list', () => {
      const ids = ['0xa'];
      updateExcludeId(ids, 0, '0xb');
      expect(ids).toEqual(['0xa']);
    });
  });

  describe('removeExcludeId', () => {
    it('should remove the entry at the given index', () => {
      expect(removeExcludeId(['0xa', '0xb'], 0)).toEqual(['0xb']);
    });
  });
});
