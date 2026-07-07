import type { Emitter } from 'mitt';
import type { Entity } from '@dcl/ecs';

import type { RendererEvents } from '../types';
import { EDITOR_BUS_CHANNEL } from './bus-protocol';
import type { AgentToPage, BusEnvelope } from './bus-protocol';

/**
 * Reverse-channel bridge: the super-user editor-agent scene (a separate SDK7
 * project at `packages/inspector/agents/bevy`, loaded into the engine as a
 * portable experience) does viewport picking + gizmo dragging and posts the
 * results over a same-origin BroadcastChannel; this turns each message into the
 * matching event on the renderer's emitter (`pick`, `gizmoCommit`,
 * `gizmoCommitEnd`). The inspector's reverse-channel handler
 * (connectReverseChannel) then applies them to ECS selection / Transform writes.
 * The wire shapes are the shared {@link ./bus-protocol} both sides import.
 *
 * The stock engine has no console command for viewport interaction, so this
 * BroadcastChannel is the only path — it's allowlisted for super-user scenes on
 * stock bevy-explorer and spans the iframe/worker boundary same-origin.
 *
 * `to:'page'` is agent→inspector; we ignore anything else (incl. our own posts).
 */

/** Validate + narrow a raw bus message to a well-formed agent→inspector one. */
function toAgentMsg(data: unknown): AgentToPage | null {
  if (!data || typeof data !== 'object') return null;
  const env = data as Partial<BusEnvelope>;
  if (env.to !== 'page' || !env.msg || typeof env.msg !== 'object') return null;
  const msg = env.msg as { kind?: unknown };
  if (
    msg.kind === 'pick' &&
    typeof (msg as AgentToPage & { entity?: unknown }).entity === 'number'
  ) {
    return env.msg as AgentToPage;
  }
  if (
    msg.kind === 'gizmoCommit' &&
    Array.isArray((msg as Extract<AgentToPage, { kind: 'gizmoCommit' }>).transforms)
  ) {
    return env.msg as AgentToPage;
  }
  if (msg.kind === 'gizmoCommitEnd') return env.msg as AgentToPage;
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
        // The agent sends position only; the reverse-channel handler merges it
        // into the entity's existing Transform (preserving rotation/scale/parent).
        events.emit('gizmoCommit', {
          transforms: msg.transforms.map(t => ({
            entity: t.entity as Entity,
            position: t.position,
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
