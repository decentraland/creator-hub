import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Engine, type Entity, type IEngine } from '@dcl/ecs';
import { createComponents, getComponents, type RoomSDK } from '../src/definitions';
import { getExplorerComponents } from '../src/components';
import { ADMIN_MESSAGES } from '../src/admin-commands';
import { initAdminToolkitServer } from '../src/admin-toolkit-server';
import { getAdminMessageBus, initAdminMessageBus } from '../src/admin-toolkit-ui/admin-message-bus';

const gatekeeper = vi.hoisted(() => ({ preview: false, down: false, admins: [] as string[] }));

vi.mock('../src/admin-toolkit-ui/fetch-utils', () => ({ isPreview: () => gatekeeper.preview }));
vi.mock('../src/admin-toolkit-ui/ModerationControl/api', () => ({
  getSceneAdmins: async () =>
    gatekeeper.preview || gatekeeper.down
      ? ['Try again in Genesis/World. LocalPreview not supported.', null]
      : [null, gatekeeper.admins.map(admin => ({ admin, name: admin, canBeRemoved: true }))],
}));

const ADMIN = '0xAdmin';
const STRANGER = '0xStranger';
const DEFAULT_URL = 'https://default.m3u8';
const CAST_URL = 'https://cast.m3u8';

type Handler = (data: unknown, context?: { from: string }) => void;

function fakeRoom() {
  const handlers = new Map<string, Handler>();
  const room: RoomSDK = {
    send: vi.fn(async () => {}),
    onMessage: (type, cb) => {
      handlers.set(type, cb);
      return () => handlers.delete(type);
    },
  };
  const deliver = (type: string, data: unknown, from: string) =>
    handlers.get(type)?.(data, { from });
  return { room, deliver };
}

function createScene() {
  const engine: IEngine = Engine();
  createComponents(engine);
  const { AdminTools, VideoScreen } = getComponents(engine);
  const { VideoPlayer } = getExplorerComponents(engine);

  const screen = engine.addEntity();
  VideoPlayer.create(screen, { src: 'https://composite.m3u8', playing: false });
  VideoScreen.create(screen, { thumbnail: '', defaultURL: DEFAULT_URL });

  const toolkit = engine.addEntity();
  AdminTools.create(toolkit);
  AdminTools.getMutable(toolkit).videoControl.videoPlayers = [
    { entity: screen as number, customName: 'Screen' },
  ];

  const video = () => VideoPlayer.get(screen);
  const announcement = () => getComponents(engine).TextAnnouncements.getOrNull(toolkit);
  return { engine, screen, toolkit, video, announcement };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('admin toolkit on the authoritative server', () => {
  let scene: ReturnType<typeof createScene>;
  let network: ReturnType<typeof fakeRoom>;

  beforeEach(async () => {
    gatekeeper.preview = false;
    gatekeeper.down = false;
    gatekeeper.admins = [ADMIN.toLowerCase()];
    scene = createScene();
    network = fakeRoom();
    initAdminToolkitServer(scene.engine, scene.toolkit, { registerMessages: () => network.room });
    await flush();
  });

  it('should start every screen on its default URL with an empty announcement', () => {
    expect(scene.video().src).toBe(DEFAULT_URL);
    expect(scene.announcement()).toEqual({ text: '', author: '', id: '' });
  });

  describe('when a scene admin sends commands', () => {
    beforeEach(() => {
      network.deliver(
        ADMIN_MESSAGES.SET_VIDEO,
        { entity: scene.screen, src: CAST_URL, playing: true },
        ADMIN,
      );
      network.deliver(
        ADMIN_MESSAGES.SET_ANNOUNCEMENT,
        { text: 'hello', author: 'Ann', id: '1-Ann' },
        ADMIN,
      );
    });

    it('should apply them to the synced components', () => {
      expect(scene.video().src).toBe(CAST_URL);
      expect(scene.video().playing).toBe(true);
      expect(scene.announcement()).toEqual({ text: 'hello', author: 'Ann', id: '1-Ann' });
    });

    it('should clear the announcement on request', () => {
      network.deliver(ADMIN_MESSAGES.CLEAR_ANNOUNCEMENT, {}, ADMIN);
      expect(scene.announcement()?.text).toBe('');
    });
  });

  describe('when someone outside the admin list sends commands', () => {
    beforeEach(() => {
      network.deliver(ADMIN_MESSAGES.SET_VIDEO, { entity: scene.screen, src: CAST_URL }, STRANGER);
      network.deliver(
        ADMIN_MESSAGES.SET_ANNOUNCEMENT,
        { text: 'spam', author: 'x', id: 'x' },
        STRANGER,
      );
    });

    it('should ignore them', () => {
      expect(scene.video().src).toBe(DEFAULT_URL);
      expect(scene.announcement()?.text).toBe('');
    });
  });

  describe('when an admin adds a new admin', () => {
    beforeEach(async () => {
      gatekeeper.admins.push(STRANGER.toLowerCase());
      network.deliver(ADMIN_MESSAGES.SYNC_ADMINS, {}, ADMIN);
      await flush();
    });

    it('should accept commands from the new admin and tell clients to refetch', () => {
      network.deliver(ADMIN_MESSAGES.SET_VIDEO, { entity: scene.screen, src: CAST_URL }, STRANGER);
      expect(scene.video().src).toBe(CAST_URL);
      expect(network.room.send).toHaveBeenCalledWith(ADMIN_MESSAGES.ADMINS_CHANGED, {});
    });
  });
});

describe('admin toolkit server when the first admin-list fetch fails', () => {
  it('should refetch on the next command so admins are not locked out', async () => {
    gatekeeper.preview = false;
    gatekeeper.down = true;
    gatekeeper.admins = [ADMIN.toLowerCase()];
    const scene = createScene();
    const network = fakeRoom();
    initAdminToolkitServer(scene.engine, scene.toolkit, { registerMessages: () => network.room });
    await flush();

    gatekeeper.down = false;
    network.deliver(ADMIN_MESSAGES.SET_VIDEO, { entity: scene.screen, src: CAST_URL }, ADMIN);
    await flush();
    network.deliver(ADMIN_MESSAGES.SET_VIDEO, { entity: scene.screen, src: CAST_URL }, ADMIN);

    expect(scene.video().src).toBe(CAST_URL);
  });
});

describe('admin toolkit server in a local preview', () => {
  it('should treat every sender as an admin', async () => {
    gatekeeper.preview = true;
    const scene = createScene();
    const network = fakeRoom();
    initAdminToolkitServer(scene.engine, scene.toolkit, { registerMessages: () => network.room });
    await flush();

    network.deliver(ADMIN_MESSAGES.SET_VIDEO, { entity: scene.screen, src: CAST_URL }, STRANGER);

    expect(scene.video().src).toBe(CAST_URL);
  });
});

describe('admin toolkit server write protection', () => {
  type Validator = (value: { senderAddress: string }) => boolean;

  it('should reject client writes to the admin-controlled components when the ECS supports validation', () => {
    const scene = createScene();
    const validators = new Map<number, Validator>();
    const { VideoPlayer } = getExplorerComponents(scene.engine);
    const { TextAnnouncements } = getComponents(scene.engine);
    for (const component of [VideoPlayer, TextAnnouncements]) {
      Object.assign(component, {
        validateBeforeChange: (entity: Entity, cb: Validator) =>
          validators.set(entity as number, cb),
      });
    }

    initAdminToolkitServer(scene.engine, scene.toolkit, {});

    for (const entity of [scene.screen, scene.toolkit]) {
      const validate = validators.get(entity as number);
      expect(validate?.({ senderAddress: ADMIN })).toBe(false);
      expect(validate?.({ senderAddress: 'authoritative-server' })).toBe(true);
    }
  });

  it('should still start when the ECS has no validateBeforeChange', () => {
    const scene = createScene();
    expect(() => initAdminToolkitServer(scene.engine, scene.toolkit, {})).not.toThrow();
  });
});

describe('admin toolkit client', () => {
  describe('without an authoritative server', () => {
    it('should apply admin commands locally', () => {
      const scene = createScene();
      initAdminMessageBus(scene.engine, scene.toolkit, {});

      getAdminMessageBus().emitSetVideo(scene.screen, { src: CAST_URL, playing: true });
      getAdminMessageBus().emitSetAnnouncement('hi', 'Ann', '1-Ann');

      expect(scene.video().src).toBe(CAST_URL);
      expect(scene.announcement()?.text).toBe('hi');
    });
  });

  describe('with an authoritative server', () => {
    it('should send commands to the server instead of writing the components', () => {
      const scene = createScene();
      const network = fakeRoom();
      initAdminMessageBus(scene.engine, scene.toolkit, { registerMessages: () => network.room });

      getAdminMessageBus().emitSetVideo(scene.screen, { src: CAST_URL, playing: true });

      expect(network.room.send).toHaveBeenCalledWith(
        ADMIN_MESSAGES.SET_VIDEO,
        expect.objectContaining({ entity: scene.screen, src: CAST_URL, playing: true }),
      );
      expect(scene.video().src).not.toBe(CAST_URL);
      expect(scene.announcement()).toBeNull();
    });
  });
});
