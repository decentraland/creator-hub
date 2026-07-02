import type { Emitter } from 'mitt';
import type { Entity } from '@dcl/ecs';

import type { RendererEvents } from '../types';

/**
 * Reverse-channel pick bridge: the super-user editor-agent scene (loaded into
 * the engine as a portable experience) does viewport picking and posts the
 * result over a same-origin BroadcastChannel; this turns each message into a
 * `pick` event on the renderer's emitter. The inspector's reverse-channel
 * handler (connectReverseChannel) then applies it to ECS selection.
 *
 * The stock engine has no console command for "what's under the click", so this
 * BroadcastChannel is the only path — it's allowlisted for super-user scenes on
 * stock bevy-explorer and spans the iframe/worker boundary same-origin.
 *
 * Envelope matches the agent scene: `{ to: 'page', msg: { kind:'pick', … } }`.
 * `to:'page'` is agent→inspector; we ignore anything else (incl. our own posts).
 */

const EDITOR_BUS_CHANNEL = 'dcl-editor-bus';

/** The pick payload the agent scene posts. entity 0 = clean miss (deselect). */
interface AgentPickMsg {
  kind: 'pick';
  entity: number;
  shift: boolean;
  ctrl: boolean;
}

interface BusEnvelope {
  to: 'page' | 'scene';
  msg: unknown;
}

function isPickEnvelope(data: unknown): data is BusEnvelope & { msg: AgentPickMsg } {
  if (!data || typeof data !== 'object') return false;
  const env = data as BusEnvelope;
  if (env.to !== 'page' || !env.msg || typeof env.msg !== 'object') return false;
  const msg = env.msg as AgentPickMsg;
  return msg.kind === 'pick' && typeof msg.entity === 'number';
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
 * Start translating agent pick messages into `events.emit('pick', …)`.
 * Returns a disconnect fn that detaches the listener and closes the channel.
 */
export function createPickBridge(options: PickBridgeOptions): () => void {
  const { events } = options;
  const channel =
    options.channel ??
    (new BroadcastChannel(EDITOR_BUS_CHANNEL) as unknown as NonNullable<
      PickBridgeOptions['channel']
    >);

  channel.onmessage = ({ data }: { data: unknown }) => {
    if (!isPickEnvelope(data)) return;
    const { entity, shift, ctrl } = data.msg;
    events.emit('pick', {
      // entity 0 → clean miss: the reverse channel treats 'empty' as deselect.
      // Otherwise select the entity the ray hit. The hit is a real tree entity;
      // if the scene splits a model's visible mesh and collider into separate
      // entities, the collider is what carries the physics hit — selecting it is
      // correct (it's a distinct, selectable node), not a bug.
      target: entity === 0 ? { kind: 'empty' } : { kind: 'entity', entity: entity as Entity },
      modifiers: { multi: shift || ctrl },
    });
  };

  return () => {
    channel.onmessage = null;
    channel.close();
  };
}
