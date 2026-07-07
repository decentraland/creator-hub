import type { Emitter } from 'mitt';
import type { Entity } from '@dcl/ecs';
import type { Vector3 } from '@dcl/ecs-math';

import type { RendererEvents } from '../types';

/**
 * Reverse-channel bridge: the super-user editor-agent scene (loaded into the
 * engine as a portable experience) does viewport picking + gizmo dragging and
 * posts the results over a same-origin BroadcastChannel; this turns each message
 * into the matching event on the renderer's emitter (`pick`, `gizmoCommit`,
 * `gizmoCommitEnd`). The inspector's reverse-channel handler
 * (connectReverseChannel) then applies them to ECS selection / Transform writes.
 *
 * The stock engine has no console command for viewport interaction, so this
 * BroadcastChannel is the only path — it's allowlisted for super-user scenes on
 * stock bevy-explorer and spans the iframe/worker boundary same-origin.
 *
 * Envelope matches the agent scene: `{ to: 'page', msg: { kind, … } }`.
 * `to:'page'` is agent→inspector; we ignore anything else (incl. our own posts).
 */

const EDITOR_BUS_CHANNEL = 'dcl-editor-bus';

// entity 0 = clean miss (deselect).
type PickMsg = { kind: 'pick'; entity: number; shift: boolean; ctrl: boolean };
type GizmoCommitMsg = {
  kind: 'gizmoCommit';
  transforms: { entity: number; position?: Vector3; rotation?: unknown; scale?: Vector3 }[];
};
type GizmoCommitEndMsg = { kind: 'gizmoCommitEnd' };
type AgentMsg = PickMsg | GizmoCommitMsg | GizmoCommitEndMsg;

interface BusEnvelope {
  to: 'page' | 'scene';
  msg: unknown;
}

/** A well-formed agent→inspector envelope carrying one of our message kinds. */
function toAgentMsg(data: unknown): AgentMsg | null {
  if (!data || typeof data !== 'object') return null;
  const env = data as BusEnvelope;
  if (env.to !== 'page' || !env.msg || typeof env.msg !== 'object') return null;
  const msg = env.msg as { kind?: unknown };
  if (msg.kind === 'pick' && typeof (msg as PickMsg).entity === 'number') return msg as PickMsg;
  if (msg.kind === 'gizmoCommit' && Array.isArray((msg as GizmoCommitMsg).transforms)) {
    return msg as GizmoCommitMsg;
  }
  if (msg.kind === 'gizmoCommitEnd') return msg as GizmoCommitEndMsg;
  return null;
}

export interface PickBridgeOptions {
  events: Emitter<RendererEvents>;
  /**
   * Test seam: the BroadcastChannel-like object to listen on. Defaults to a real
   * `BroadcastChannel('dcl-editor-bus')`. Tests inject a fake.
   */
  channel?: { onmessage: ((ev: { data: unknown }) => void) | null; close(): void };
}

/**
 * Translate agent reverse-channel messages into renderer events. Returns a
 * disconnect fn that detaches the listener and closes the channel.
 */
export function createPickBridge(options: PickBridgeOptions): () => void {
  const { events } = options;
  const channel =
    options.channel ??
    (new BroadcastChannel(EDITOR_BUS_CHANNEL) as unknown as NonNullable<
      PickBridgeOptions['channel']
    >);

  channel.onmessage = ({ data }: { data: unknown }) => {
    const msg = toAgentMsg(data);
    if (msg === null) return;

    switch (msg.kind) {
      case 'pick':
        events.emit('pick', {
          // entity 0 → clean miss: the reverse channel treats 'empty' as deselect.
          // Otherwise select the hit entity. The hit is a real tree entity; if the
          // scene splits a model's visible mesh and collider into separate
          // entities, the collider carries the physics hit — selecting it is
          // correct (a distinct, selectable node), not a bug.
          target:
            msg.entity === 0 ? { kind: 'empty' } : { kind: 'entity', entity: msg.entity as Entity },
          modifiers: { multi: msg.shift || msg.ctrl },
        });
        break;
      case 'gizmoCommit':
        events.emit('gizmoCommit', {
          transforms: msg.transforms.map(t => ({
            entity: t.entity as Entity,
            position: t.position,
            rotation: t.rotation as never,
            scale: t.scale,
          })),
        });
        break;
      case 'gizmoCommitEnd':
        events.emit('gizmoCommitEnd', undefined);
        break;
    }
  };

  return () => {
    channel.onmessage = null;
    channel.close();
  };
}
