import { createSceneRunBridge } from './scene-run-bridge';

/**
 * The scene-run bridge posts `set-scene-frozen` to the agent: running=true →
 * frozen:false (run live), running=false → frozen:true (static). No reverse
 * channel — the inspector owns the intent. Driven with a fake channel recorder.
 */
describe('createSceneRunBridge', () => {
  let posted: unknown[];
  let closed: boolean;
  let bridge: ReturnType<typeof createSceneRunBridge>;

  beforeEach(() => {
    posted = [];
    closed = false;
    bridge = createSceneRunBridge({
      channel: {
        postMessage: m => posted.push(m),
        close: () => {
          closed = true;
        },
      },
    });
  });

  afterEach(() => bridge.disconnect());

  it('should post frozen:false when running the scene live', () => {
    bridge.setRunning(true);
    expect(posted).toEqual([{ to: 'scene', msg: { kind: 'set-scene-frozen', frozen: false } }]);
  });

  it('should post frozen:true when freezing the scene', () => {
    bridge.setRunning(false);
    expect(posted).toEqual([{ to: 'scene', msg: { kind: 'set-scene-frozen', frozen: true } }]);
  });

  it('should close the channel on disconnect', () => {
    bridge.disconnect();
    expect(closed).toBe(true);
  });
});
