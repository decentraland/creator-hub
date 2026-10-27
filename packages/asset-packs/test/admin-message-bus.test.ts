import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Engine, type Entity, type IEngine } from '@dcl/ecs';
import { createComponents, getComponents } from '../src/definitions';
import type { MessageBusSDK } from '../src/types';
import type { SceneAdmin } from '../src/admin-toolkit-ui/ModerationControl';
import { initAdminMessageBus } from '../src/admin-toolkit-ui/admin-message-bus';

const realm = vi.hoisted(() => ({ preview: false }));

vi.mock('../src/admin-toolkit-ui/fetch-utils', () => ({ isPreview: () => realm.preview }));
vi.mock('../src/admin-toolkit-ui/VideoControl/utils', () => ({ getVideoPlayers: () => [] }));

const ADMIN: SceneAdmin = { address: '0xadmin', canBeRemoved: true };
const STRANGER = '0xstranger';

type Listener = (payload: unknown, sender: string) => void;

// Mirrors the SDK MessageBus contract: emit also delivers to local listeners as 'self'.
function createFakeBus() {
  const listeners = new Map<string, Listener[]>();
  const sent: Array<{ message: string; payload: Record<string, unknown> }> = [];
  const bus: MessageBusSDK = {
    on(message, callback) {
      listeners.set(message, [...(listeners.get(message) ?? []), callback]);
    },
    emit(message, payload) {
      sent.push({ message, payload });
      for (const cb of listeners.get(message) ?? []) cb(payload, 'self');
    },
  };
  const receive = (message: string, payload: unknown, sender: string) => {
    for (const cb of listeners.get(message) ?? []) cb(payload, sender);
  };
  return { bus, sent, receive };
}

describe('initAdminMessageBus', () => {
  let engine: IEngine;
  let uiEntity: Entity;
  const announcements = () => getComponents(engine).TextAnnouncements;

  beforeEach(() => {
    realm.preview = false;
    engine = Engine();
    createComponents(engine);
    uiEntity = engine.addEntity();
    announcements().create(uiEntity, { text: '', author: '', id: '' });
  });

  describe('when a message bus is injected', () => {
    let fake: ReturnType<typeof createFakeBus>;

    beforeEach(() => {
      fake = createFakeBus();
    });

    it('should send an admin command through the bus and apply it exactly once', () => {
      const instance = initAdminMessageBus(engine, [], uiEntity, undefined, undefined, fake.bus);
      fake.sent.length = 0;
      const apply = vi.spyOn(announcements(), 'getMutableOrNull');

      instance.emitSetAnnouncement('hello', 'me', 'id-1');

      expect(fake.sent).toEqual([
        { message: 'admin:set-announcement', payload: { text: 'hello', author: 'me', id: 'id-1' } },
      ]);
      expect(apply).toHaveBeenCalledTimes(1);
      expect(announcements().get(uiEntity)).toMatchObject({
        text: 'hello',
        author: 'me',
        id: 'id-1',
      });
    });

    it('should apply a remote command when the sender is a scene admin', () => {
      initAdminMessageBus(engine, [ADMIN], uiEntity, undefined, undefined, fake.bus);

      fake.receive(
        'admin:set-announcement',
        { text: 'from admin', author: 'a', id: '1' },
        ADMIN.address,
      );

      expect(announcements().get(uiEntity).text).toBe('from admin');
    });

    it('should ignore a remote command when the sender is not a scene admin', () => {
      initAdminMessageBus(engine, [ADMIN], uiEntity, undefined, undefined, fake.bus);

      fake.receive('admin:set-announcement', { text: 'spoofed', author: 'x', id: '2' }, STRANGER);

      expect(announcements().get(uiEntity).text).toBe('');
    });
  });

  describe('when no message bus is injected', () => {
    it('should still apply admin commands locally', () => {
      const instance = initAdminMessageBus(engine, [], uiEntity);

      instance.emitSetAnnouncement('local only', 'me', 'id-3');

      expect(announcements().get(uiEntity).text).toBe('local only');
    });
  });
});
