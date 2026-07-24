import { createAnimationsBridge } from './animations-bridge';

/**
 * The animations bridge turns the one-way bus into a request/response: it posts
 * `query-animations` and resolves with the agent's `animations` reply (correlated
 * by id), or [] on timeout. Driven with a fake channel that records posts and
 * lets the test play the agent's reply back through `onmessage`.
 */
describe('createAnimationsBridge', () => {
  let posted: any[];
  let onmessage: ((ev: { data: unknown }) => void) | null;
  let bridge: ReturnType<typeof createAnimationsBridge>;

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

  const reply = (msg: unknown) => onmessage?.({ data: { to: 'page', msg } });

  beforeEach(() => {
    posted = [];
    onmessage = null;
    bridge = createAnimationsBridge({ channel, timeoutMs: 50 });
  });

  afterEach(() => bridge.disconnect());

  describe('when the agent replies with names', () => {
    it('should post query-animations for the entity and resolve the matching reply', async () => {
      const promise = bridge.query(512);

      expect(posted).toHaveLength(1);
      const env = posted[0];
      expect(env.to).toBe('scene');
      expect(env.msg.kind).toBe('query-animations');
      expect(env.msg.entity).toBe(512);
      const { id } = env.msg;

      reply({ kind: 'animations', id, names: ['Idle', 'Walk', 'Run'] });
      expect(await promise).toEqual(['Idle', 'Walk', 'Run']);
    });
  });

  describe('when the agent reports no animations', () => {
    it('should resolve an empty array', async () => {
      const promise = bridge.query(700);
      reply({ kind: 'animations', id: posted[0].msg.id, names: [] });
      expect(await promise).toEqual([]);
    });
  });

  describe('when a reply carries a different id', () => {
    it('should ignore it and time out to []', async () => {
      const promise = bridge.query(1);
      reply({ kind: 'animations', id: posted[0].msg.id + 999, names: ['Nope'] });
      expect(await promise).toEqual([]);
    });
  });

  describe('when no agent answers', () => {
    it('should resolve [] after the timeout', async () => {
      expect(await bridge.query(1)).toEqual([]);
    });
  });

  describe('when correlating concurrent queries', () => {
    it('should route each reply to its own request by id', async () => {
      const a = bridge.query(1);
      const b = bridge.query(2);
      const idA = posted[0].msg.id;
      const idB = posted[1].msg.id;
      reply({ kind: 'animations', id: idB, names: ['B'] });
      reply({ kind: 'animations', id: idA, names: ['A'] });
      expect(await a).toEqual(['A']);
      expect(await b).toEqual(['B']);
    });
  });

  describe('after disconnect', () => {
    it('should settle a pending query with [] and stop listening', async () => {
      const promise = bridge.query(1);
      bridge.disconnect();
      expect(await promise).toEqual([]);
    });
  });
});
