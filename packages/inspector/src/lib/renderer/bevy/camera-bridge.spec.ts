import { createCameraBridge } from './camera-bridge';

/**
 * The camera bridge posts camera intent (mode/focus/reset) to the agent and, when
 * an `onPose` handler is given, receives the agent's live `camera-pose` stream
 * (scene-local) for the minimap. Driven with a fake channel.
 */
describe('createCameraBridge', () => {
  let posted: any[];
  let onmessage: ((ev: { data: unknown }) => void) | null;

  const channel = {
    postMessage: (m: unknown) => posted.push(m),
    set onmessage(fn: ((ev: { data: unknown }) => void) | null) {
      onmessage = fn;
    },
    get onmessage() {
      return onmessage;
    },
    close() {},
  };

  const deliver = (msg: unknown) => onmessage?.({ data: { to: 'page', msg } });

  beforeEach(() => {
    posted = [];
    onmessage = null;
  });

  describe('posting intent', () => {
    it('should post set-camera / focus-camera / reset-camera to the scene', () => {
      const bridge = createCameraBridge({ channel });
      bridge.setMode('free');
      bridge.focus({ x: 1, y: 2, z: 3 });
      bridge.reset({ x: 8, y: 0, z: 8 });
      expect(posted).toEqual([
        { to: 'scene', msg: { kind: 'set-camera', mode: 'free' } },
        { to: 'scene', msg: { kind: 'focus-camera', position: { x: 1, y: 2, z: 3 } } },
        { to: 'scene', msg: { kind: 'reset-camera', position: { x: 8, y: 0, z: 8 } } },
      ]);
      bridge.disconnect();
    });
  });

  describe('the camera-pose stream', () => {
    it('should deliver agent camera-pose messages to onPose', () => {
      const poses: any[] = [];
      const bridge = createCameraBridge({ channel, onPose: p => poses.push(p) });

      deliver({
        kind: 'camera-pose',
        position: { x: 5, y: 3, z: 5 },
        target: { x: 6, y: 3, z: 5 },
      });
      expect(poses).toEqual([{ position: { x: 5, y: 3, z: 5 }, target: { x: 6, y: 3, z: 5 } }]);
      bridge.disconnect();
    });

    it('should not listen when no onPose handler is given', () => {
      const bridge = createCameraBridge({ channel });
      expect(onmessage).toBeNull();
      bridge.disconnect();
    });

    it('should ignore non-pose page messages', () => {
      const poses: any[] = [];
      const bridge = createCameraBridge({ channel, onPose: p => poses.push(p) });
      deliver({ kind: 'drop-point', id: 1, position: null });
      expect(poses).toEqual([]);
      bridge.disconnect();
    });

    it('should stop listening after disconnect', () => {
      const bridge = createCameraBridge({ channel, onPose: () => {} });
      bridge.disconnect();
      expect(onmessage).toBeNull();
    });
  });

  describe('the editor-ready signal', () => {
    it('should invoke onReady when the agent signals editor-ready', () => {
      let ready = 0;
      const bridge = createCameraBridge({ channel, onReady: () => (ready += 1) });
      deliver({ kind: 'editor-ready' });
      expect(ready).toBe(1);
      bridge.disconnect();
    });

    it('should listen for editor-ready even without an onPose handler', () => {
      const bridge = createCameraBridge({ channel, onReady: () => {} });
      expect(onmessage).not.toBeNull();
      bridge.disconnect();
    });
  });
});
