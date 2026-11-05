import { flatten } from 'flat';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { misc } from '#preload';
import { config } from '/@/config';
import { RoleType } from '/@/lib/land';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';
import { ManagedProjectType, type ManagedProject } from '/shared/types/manage';

import { getLandMenuOptions } from './landMenu';

const land = (role: RoleType, place: ManagedProject['place']): ManagedProject => ({
  id: 'any',
  displayName: '',
  type: ManagedProjectType.LAND,
  role,
  place,
});

const parcel = (role: RoleType) => land(role, { kind: 'parcel', x: 96, y: 15 });

const menu = (project: ManagedProject) => {
  const actions = { onTransfer: vi.fn(), onUrlCopied: vi.fn() };
  return { options: getLandMenuOptions(project, actions), actions };
};

const pick = (options: ReturnType<typeof getLandMenuOptions>, text: string) =>
  options.find(option => option.text === text)!;

describe('getLandMenuOptions', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  describe('when the account owns the LAND', () => {
    it('should offer Transfer after a divider', () => {
      const { options } = menu(parcel(RoleType.OWNER));

      expect(options.map(option => [option.text, !!option.divider])).toEqual([
        ['Jump In', false],
        ['Copy URL', false],
        ['Create Event', true],
        ['Transfer', false],
      ]);
    });

    it('should hand Transfer to the caller', () => {
      const { options, actions } = menu(parcel(RoleType.OWNER));

      pick(options, 'Transfer').handler();

      expect(actions.onTransfer).toHaveBeenCalled();
    });
  });

  describe.each([
    ['rents it out', RoleType.LESSOR],
    ['rents it', RoleType.TENANT],
    ['is its collaborator', RoleType.OPERATOR],
    ['manages it', RoleType.MANAGER],
  ])('when the account %s', (_, role) => {
    it('should offer neither Transfer nor its divider', () => {
      const { options } = menu(parcel(role));

      expect(options.map(option => [option.text, !!option.divider])).toEqual([
        ['Jump In', false],
        ['Copy URL', false],
        ['Create Event', false],
      ]);
    });
  });

  describe('when jumping into a parcel', () => {
    it('should open its coordinates, not a World realm', () => {
      const { options } = menu(parcel(RoleType.OWNER));

      pick(options, 'Jump In').handler();

      expect(misc.openExternal).toHaveBeenCalledWith(expect.stringMatching(/position=96,15$/));
    });
  });

  describe('when copying the URL of an estate', () => {
    it('should copy the URL of its base parcel and confirm it', () => {
      const { options, actions } = menu(
        land(RoleType.OPERATOR, { kind: 'estate', size: 6, base: { x: -3, y: 7 } }),
      );

      pick(options, 'Copy URL').handler();

      expect(misc.copyToClipboard).toHaveBeenCalledWith(expect.stringMatching(/position=-3,7$/));
      expect(actions.onUrlCopied).toHaveBeenCalled();
    });
  });

  describe('when creating an event', () => {
    it("should open What's On's new-hangout page from the env config, with nothing prefilled", () => {
      const { options } = menu(parcel(RoleType.TENANT));

      pick(options, 'Create Event').handler();

      expect(config.get('CREATE_EVENT_URL')).toMatch(
        /^https:\/\/decentraland\.(org|zone)\/whats-on\/new-hangout$/,
      );
      expect(misc.openExternal).toHaveBeenCalledWith(config.get('CREATE_EVENT_URL'));
    });
  });
});
