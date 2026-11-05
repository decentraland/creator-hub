import { describe, expect, it } from 'vitest';

import { WorldRoleType } from '/@/lib/worlds';
import { ManagedProjectType, type ManagedProject } from '/shared/types/manage';

import { toWorldCard } from './worldCard';

const deployment = {
  title: 'Scene X',
  description: '',
  thumbnail: 'thumb.png',
  lastPublishedAt: 0,
  scenesCount: 2,
};

const world = (overrides: Partial<ManagedProject> = {}): ManagedProject => ({
  id: 'plaza.dcl.eth',
  displayName: 'plaza.dcl.eth',
  type: ManagedProjectType.WORLD,
  role: WorldRoleType.OWNER,
  title: 'Plaza',
  deployment,
  ...overrides,
});

describe('toWorldCard', () => {
  describe('when the World is published with a World Name', () => {
    it('should name the card by the World Name and show its scenes and thumbnail', () => {
      expect(toWorldCard(world())).toEqual({
        name: 'Plaza',
        place: { kind: 'world', domain: 'plaza.dcl.eth' },
        role: undefined,
        status: 'published',
        thumbnail: 'thumb.png',
        scenesCount: 2,
        to: '/manage/world/plaza.dcl.eth/details',
      });
    });
  });

  describe('when the World has no World Name', () => {
    it("should fall back to the published scene's title", () => {
      expect(toWorldCard(world({ title: undefined })).name).toBe('Scene X');
    });
  });

  describe('when nothing is published on the World', () => {
    it('should be unpublished, named by its domain, with no scenes', () => {
      const card = toWorldCard(world({ title: undefined, deployment: undefined }));

      expect(card).toMatchObject({ name: 'plaza.dcl.eth', status: 'unpublished', scenesCount: 0 });
    });
  });

  describe('when the account collaborates on the World', () => {
    it('should carry the Collaborator tag', () => {
      expect(toWorldCard(world({ role: WorldRoleType.COLLABORATOR })).role).toBe('collaborator');
    });
  });

  describe('when the domain needs escaping', () => {
    it('should encode it in the link', () => {
      expect(toWorldCard(world({ id: 'a b.eth', displayName: 'a b.eth' })).to).toBe(
        '/manage/world/a%20b.eth/details',
      );
    });
  });

  describe('when the account can only stream to the World', () => {
    it('should tag it Collaborator and not link it, since it has no detail page', () => {
      const card = toWorldCard(world({ role: WorldRoleType.COLLABORATOR, access: 'stream' }));

      expect(card.role).toBe('collaborator');
      expect(card.to).toBeUndefined();
    });
  });
});
