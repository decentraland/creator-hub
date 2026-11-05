import { AvatarModifierType } from '@dcl/ecs';

import { MODIFIER_OPTIONS, fromModifiers, toModifiers } from './utils';

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
});
