import mitt from 'mitt';
import type { Emitter } from 'mitt';

import type { RendererEvents } from '../types';
import { createPickBridge } from './pick-bridge';

/**
 * The pick bridge turns agent-scene BroadcastChannel messages into `pick` events
 * on the renderer's emitter. Driven with a fake channel (no real
 * BroadcastChannel / engine), asserting the envelope filtering + event shape.
 */
describe('createPickBridge', () => {
  let events: Emitter<RendererEvents>;
  let picks: RendererEvents['pick'][];
  let commits: RendererEvents['gizmoCommit'][];
  let commitEnds: number;
  let fakeChannel: {
    onmessage: ((ev: { data: unknown }) => void) | null;
    close(): void;
    closed: boolean;
  };
  let disconnect: () => void;

  const emit = (data: unknown) => fakeChannel.onmessage?.({ data });

  beforeEach(() => {
    events = mitt<RendererEvents>();
    picks = [];
    commits = [];
    commitEnds = 0;
    events.on('pick', e => picks.push(e));
    events.on('gizmoCommit', e => commits.push(e));
    events.on('gizmoCommitEnd', () => {
      commitEnds++;
    });
    fakeChannel = {
      onmessage: null,
      closed: false,
      close() {
        this.closed = true;
      },
    };
    disconnect = createPickBridge({ events, channel: fakeChannel });
  });

  afterEach(() => disconnect());

  describe('when the agent posts an entity pick', () => {
    it('should emit a pick for that entity', () => {
      emit({ to: 'page', msg: { kind: 'pick', entity: 512, shift: false, ctrl: false } });
      expect(picks).toHaveLength(1);
      expect(picks[0].target).toEqual({ kind: 'entity', entity: 512 });
      expect(picks[0].modifiers).toEqual({ multi: false });
    });

    it('should mark multi when shift or ctrl is held', () => {
      emit({ to: 'page', msg: { kind: 'pick', entity: 700, shift: true, ctrl: false } });
      expect(picks[0].modifiers.multi).toBe(true);
    });
  });

  describe('when the agent posts a clean miss (entity 0)', () => {
    it('should emit an empty pick (deselect)', () => {
      emit({ to: 'page', msg: { kind: 'pick', entity: 0, shift: false, ctrl: false } });
      expect(picks[0].target).toEqual({ kind: 'empty' });
    });
  });

  describe('when the agent posts a gizmo drag', () => {
    it('should emit gizmoCommit with the transforms', () => {
      emit({
        to: 'page',
        msg: { kind: 'gizmoCommit', transforms: [{ entity: 512, position: { x: 1, y: 2, z: 3 } }] },
      });
      expect(commits).toHaveLength(1);
      expect(commits[0].transforms[0]).toMatchObject({
        entity: 512,
        position: { x: 1, y: 2, z: 3 },
      });
    });

    it('should emit gizmoCommitEnd', () => {
      emit({ to: 'page', msg: { kind: 'gizmoCommitEnd' } });
      expect(commitEnds).toBe(1);
    });
  });

  describe('envelope filtering', () => {
    it('should ignore scene-directed envelopes (our own / page→scene posts)', () => {
      emit({ to: 'scene', msg: { kind: 'pick', entity: 512, shift: false, ctrl: false } });
      emit({ to: 'scene', msg: { kind: 'gizmoCommitEnd' } });
      expect(picks).toHaveLength(0);
      expect(commitEnds).toBe(0);
    });

    it('should ignore unknown and malformed messages', () => {
      emit({ to: 'page', msg: { kind: 'other' } });
      emit({ to: 'page', msg: { kind: 'gizmoCommit' } }); // no transforms array
      emit({ to: 'page', msg: null });
      emit('garbage');
      emit(undefined);
      expect(picks).toHaveLength(0);
      expect(commits).toHaveLength(0);
    });
  });

  describe('disconnect', () => {
    it('should detach the listener and close the channel', () => {
      disconnect();
      expect(fakeChannel.onmessage).toBe(null);
      expect(fakeChannel.closed).toBe(true);
    });
  });
});
