import type { RendererActivity } from '../types';
import { createActivityBridge, toRendererActivity } from './activity-bridge';
import type { ActivityBridge } from './activity-bridge';

describe('createActivityBridge', () => {
  let posted: unknown[];
  let closed: boolean;
  let channel: {
    postMessage: (m: unknown) => void;
    onmessage: ((ev: { data: unknown }) => void) | null;
    close: () => void;
  };
  let bridge: ActivityBridge;

  const reporting = (enabled: boolean) => ({
    to: 'scene',
    msg: { kind: 'set-activity-reporting', enabled },
  });
  const deliver = (msg: unknown, to = 'page') => channel.onmessage?.({ data: { to, msg } });
  const deliverActivity = (activity: unknown) => deliver({ kind: 'activity', activity });

  beforeEach(() => {
    posted = [];
    closed = false;
    channel = {
      postMessage: m => posted.push(m),
      onmessage: null,
      close: () => {
        closed = true;
      },
    };
    bridge = createActivityBridge({ channel });
  });

  afterEach(() => bridge.disconnect());

  describe('when nothing is tracking', () => {
    it('should not turn reporting on', () => {
      expect(posted).toEqual([]);
    });

    it('should drop agent activity', () => {
      const cb = vi.fn();
      const off = bridge.track(cb);
      off();
      deliverActivity({ kind: 'pointerTarget', entity: 512 });
      expect(cb).not.toHaveBeenCalled();
    });

    it('should not re-assert reporting when the agent reboots', () => {
      deliver({ kind: 'editor-ready' });
      expect(posted).toEqual([]);
    });
  });

  describe('when a tracker subscribes', () => {
    let received: RendererActivity[];
    let off: () => void;

    beforeEach(() => {
      received = [];
      off = bridge.track(a => received.push(a));
    });

    it('should turn reporting on', () => {
      expect(posted).toEqual([reporting(true)]);
    });

    it('should deliver a pointer target with its point and mesh name', () => {
      deliverActivity({
        kind: 'pointerTarget',
        entity: 512,
        point: { x: 1, y: 2, z: 3 },
        meshName: 'Door_01',
      });
      expect(received).toEqual([
        { kind: 'pointerTarget', entity: 512, point: { x: 1, y: 2, z: 3 }, meshName: 'Door_01' },
      ]);
    });

    it('should map entity 0 to a null entity', () => {
      deliverActivity({ kind: 'pointerTarget', entity: 0 });
      expect(received).toEqual([{ kind: 'pointerTarget', entity: null }]);
    });

    it('should deliver a scene click', () => {
      deliverActivity({ kind: 'sceneClick', entity: 600, point: { x: 4, y: 0, z: 5 } });
      expect(received).toEqual([{ kind: 'sceneClick', entity: 600, point: { x: 4, y: 0, z: 5 } }]);
    });

    it('should deliver a player move', () => {
      deliverActivity({ kind: 'playerMove', position: { x: 8, y: 0, z: 8 } });
      expect(received).toEqual([{ kind: 'playerMove', position: { x: 8, y: 0, z: 8 } }]);
    });

    it('should ignore messages addressed to the scene', () => {
      deliver({ kind: 'activity', activity: { kind: 'pointerTarget', entity: 512 } }, 'scene');
      expect(received).toEqual([]);
    });

    it('should ignore other agent messages', () => {
      deliver({ kind: 'hover', entity: 512 });
      expect(received).toEqual([]);
    });

    it('should re-assert reporting when the agent reboots', () => {
      deliver({ kind: 'editor-ready' });
      expect(posted).toEqual([reporting(true), reporting(true)]);
    });

    it('should turn reporting off when the tracker unsubscribes', () => {
      off();
      expect(posted).toEqual([reporting(true), reporting(false)]);
    });

    it('should turn reporting off only once for a repeated unsubscribe', () => {
      off();
      off();
      expect(posted).toEqual([reporting(true), reporting(false)]);
    });

    describe('and a second tracker subscribes', () => {
      let secondOff: () => void;

      beforeEach(() => {
        secondOff = bridge.track(() => {});
      });

      it('should not turn reporting on again', () => {
        expect(posted).toEqual([reporting(true)]);
      });

      it('should keep reporting on until the last tracker leaves', () => {
        off();
        expect(posted).toEqual([reporting(true)]);
        secondOff();
        expect(posted).toEqual([reporting(true), reporting(false)]);
      });
    });

    describe('and the bridge disconnects', () => {
      beforeEach(() => bridge.disconnect());

      it('should turn reporting off and close the channel', () => {
        expect(posted).toEqual([reporting(true), reporting(false)]);
        expect(closed).toBe(true);
        expect(channel.onmessage).toBeNull();
      });
    });
  });
});

describe('toRendererActivity', () => {
  describe('when the activity is malformed', () => {
    it('should reject a non-object', () => {
      expect(toRendererActivity(null)).toBeNull();
      expect(toRendererActivity('pointerTarget')).toBeNull();
    });

    it('should reject an unknown kind', () => {
      expect(toRendererActivity({ kind: 'teleport', entity: 512 })).toBeNull();
    });

    it('should reject a pointer target without a numeric entity', () => {
      expect(toRendererActivity({ kind: 'pointerTarget', entity: '512' })).toBeNull();
    });

    it('should reject a player move without a position', () => {
      expect(toRendererActivity({ kind: 'playerMove', position: { x: 1, y: 2 } })).toBeNull();
    });
  });

  describe('when optional fields are malformed', () => {
    it('should drop them and keep the entity', () => {
      expect(
        toRendererActivity({ kind: 'pointerTarget', entity: 512, point: 'here', meshName: '' }),
      ).toEqual({ kind: 'pointerTarget', entity: 512 });
    });
  });
});
