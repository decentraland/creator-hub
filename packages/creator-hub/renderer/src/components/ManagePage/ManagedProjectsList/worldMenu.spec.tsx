import { flatten } from 'flat';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { misc } from '#preload';
import { config } from '/@/config';
import { WorldRoleType } from '/@/lib/worlds';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';
import { getJumpInUrl } from '/@/modules/utils';
import { ManagedProjectType, type ManagedProject } from '/shared/types/manage';

import { getStorageUrl } from './utils';
import { getWorldMenuOptions } from './worldMenu';

const deployment = {
  title: 'Plaza',
  description: '',
  thumbnail: '',
  lastPublishedAt: 0,
  scenesCount: 2,
};

const world = (
  role: WorldRoleType,
  overrides: Partial<Pick<ManagedProject, 'id' | 'deployment'>> = {},
): ManagedProject => ({
  id: 'plaza.dcl.eth',
  displayName: 'plaza.dcl.eth',
  type: ManagedProjectType.WORLD,
  role,
  deployment,
  ...overrides,
});

const menu = (project: ManagedProject) => {
  const actions = { onUnpublishWorld: vi.fn(), onUrlCopied: vi.fn() };
  return { options: getWorldMenuOptions(project, actions), actions };
};

const rows = (options: ReturnType<typeof getWorldMenuOptions>) =>
  options.map(option => [option.text, !!option.divider, option.tone ?? 'default']);

const pick = (options: ReturnType<typeof getWorldMenuOptions>, text: string) =>
  options.find(option => option.text === text)!;

describe('getWorldMenuOptions', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  beforeEach(() => {
    vi.mocked(misc.openExternal).mockReset();
    vi.mocked(misc.copyToClipboard).mockReset();
  });

  describe('when the owner opens a published World with scenes', () => {
    it("should list Figma's items in order, the divider after Create Event and Unpublish in the danger tone", () => {
      const { options } = menu(world(WorldRoleType.OWNER));

      expect(rows(options)).toEqual([
        ['Jump In', false, 'default'],
        ['Copy URL', false, 'default'],
        ['Create Event', true, 'default'],
        ['View Storage', false, 'default'],
        ['Unpublish', false, 'danger'],
      ]);
    });

    it('should hand Unpublish to the caller', () => {
      const { options, actions } = menu(world(WorldRoleType.OWNER));

      pick(options, 'Unpublish').handler();

      expect(actions.onUnpublishWorld).toHaveBeenCalled();
    });
  });

  describe('when creating an event', () => {
    it("should open What's On's new-hangout page from the env config", () => {
      const { options } = menu(world(WorldRoleType.COLLABORATOR));

      pick(options, 'Create Event').handler();

      expect(config.get('CREATE_EVENT_URL')).toMatch(
        /^https:\/\/decentraland\.(org|zone)\/whats-on\/new-hangout$/,
      );
      expect(misc.openExternal).toHaveBeenCalledWith(config.get('CREATE_EVENT_URL'));
    });
  });

  describe('when the World URL is used', () => {
    it("should jump in and copy the World's own URL, and store it under the World", () => {
      const { options, actions } = menu(world(WorldRoleType.OWNER));

      pick(options, 'Jump In').handler();
      pick(options, 'Copy URL').handler();
      pick(options, 'View Storage').handler();

      expect(misc.openExternal).toHaveBeenCalledWith(getJumpInUrl('plaza.dcl.eth'));
      expect(misc.copyToClipboard).toHaveBeenCalledWith(getJumpInUrl('plaza.dcl.eth'));
      expect(actions.onUrlCopied).toHaveBeenCalled();
      expect(misc.openExternal).toHaveBeenCalledWith(
        getStorageUrl(ManagedProjectType.WORLD, 'plaza.dcl.eth'),
      );
    });
  });

  describe('when a collaborator opens a published World', () => {
    it('should offer only the World links, with the divider before View Storage', () => {
      const { options } = menu(world(WorldRoleType.COLLABORATOR));

      expect(rows(options)).toEqual([
        ['Jump In', false, 'default'],
        ['Copy URL', false, 'default'],
        ['Create Event', true, 'default'],
        ['View Storage', false, 'default'],
      ]);
    });
  });

  describe.each([
    ['the owner', WorldRoleType.OWNER],
    ['a collaborator', WorldRoleType.COLLABORATOR],
  ])('when %s opens a World with nothing published', (_who, role) => {
    it('should offer Create Event alone, with no divider left hanging', () => {
      const { options } = menu(world(role, { deployment: undefined }));

      expect(rows(options)).toEqual([['Create Event', false, 'default']]);
    });
  });

  describe('when the account can only stream to a published World', () => {
    it('should offer the World links and Create Event, but not View Storage', () => {
      const { options } = menu({ ...world(WorldRoleType.COLLABORATOR), access: 'stream' });

      expect(rows(options)).toEqual([
        ['Jump In', false, 'default'],
        ['Copy URL', false, 'default'],
        ['Create Event', false, 'default'],
      ]);
    });
  });

  describe('when the account can only stream to an unpublished World', () => {
    it('should offer Create Event alone', () => {
      const { options } = menu({
        ...world(WorldRoleType.COLLABORATOR, { deployment: undefined }),
        access: 'stream',
      });

      expect(rows(options)).toEqual([['Create Event', false, 'default']]);
    });
  });
});
