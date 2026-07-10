import { createDropPointBridge } from './drop-point-bridge';

/**
 * The drop-point bridge turns the one-way bus into a request/response: it posts
 * `query-drop-point` and resolves with the agent's `drop-point` reply (correlated
 * by id), or null on a miss / timeout. Driven with a fake channel that records
 * posts and lets the test play the agent's reply back through `onmessage`.
 */
describe('createDropPointBridge', () => {
  let posted: any[];
  let onmessage: ((ev: { data: unknown }) => void) | null;
  let bridge: ReturnType<typeof createDropPointBridge>;

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

  // Play a reply from the agent back onto the channel.
  const reply = (msg: unknown) => onmessage?.({ data: { to: 'page', msg } });

  beforeEach(() => {
    posted = [];
    onmessage = null;
    bridge = createDropPointBridge({ channel, timeoutMs: 50 });
  });

  afterEach(() => {
    bridge.disconnect();
  });

  describe('when the agent replies with a point', () => {
    it('should post query-drop-point and resolve the matching reply', async () => {
      const promise = bridge.query();

      expect(posted).toHaveLength(1);
      const env = posted[0];
      expect(env.to).toBe('scene');
      expect(env.msg.kind).toBe('query-drop-point');
      const { id } = env.msg;

      reply({ kind: 'drop-point', id, position: { x: 5, y: 0, z: 7 } });

      const point = await promise;
      expect(point).toEqual({ x: 5, y: 0, z: 7 });
    });
  });

  describe('when the agent reports a miss (null position)', () => {
    it('should resolve null', async () => {
      const promise = bridge.query();
      const { id } = posted[0].msg;
      reply({ kind: 'drop-point', id, position: null });
      expect(await promise).toBeNull();
    });
  });

  describe('when a reply carries a different id', () => {
    it('should be ignored and the query should time out to null', async () => {
      const promise = bridge.query();
      const { id } = posted[0].msg;
      reply({ kind: 'drop-point', id: id + 999, position: { x: 1, y: 0, z: 1 } });
      // The mismatched reply must not settle the pending query; the timeout does.
      expect(await promise).toBeNull();
    });
  });

  describe('when no agent answers', () => {
    it('should resolve null after the timeout', async () => {
      expect(await bridge.query()).toBeNull();
    });
  });

  describe('concurrent queries', () => {
    it('should route each reply to its own request by id', async () => {
      const p1 = bridge.query();
      const p2 = bridge.query();
      const id1 = posted[0].msg.id;
      const id2 = posted[1].msg.id;
      expect(id1).not.toBe(id2);

      // Reply out of order.
      reply({ kind: 'drop-point', id: id2, position: { x: 2, y: 0, z: 2 } });
      reply({ kind: 'drop-point', id: id1, position: { x: 1, y: 0, z: 1 } });

      expect(await p1).toEqual({ x: 1, y: 0, z: 1 });
      expect(await p2).toEqual({ x: 2, y: 0, z: 2 });
    });
  });

  describe('after disconnect', () => {
    it('should settle a pending query with null', async () => {
      const promise = bridge.query();
      bridge.disconnect();
      expect(await promise).toBeNull();
    });
  });
});
