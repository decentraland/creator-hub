import type { Emitter } from 'mitt';
import type { ComponentDefinition, Entity, IEngine } from '@dcl/ecs';

import { EditorComponentNames } from '../sdk/components';
import type { SdkContextEvents } from '../sdk/context';
import type { DescribeContext } from './describe-element';
import { trackDom } from './dom-tracker';
import { trackEcs } from './ecs-tracker';
import { entityRef } from './entity-names';
import { createEventSink } from './event-sink';
import { trackRedux, type ReduxTrackerOptions } from './redux-tracker';
import { trackRenderer, type RendererTrackerOptions } from './renderer-tracker';
import type { Emit, RecordedEvent, StopTracker } from './types';

export type RecordEventsClient = { recordEvents(events: RecordedEvent[]): Promise<void> };

export type SessionRecorderDeps = {
  engine: IEngine;
  events: Pick<Emitter<SdkContextEvents>, 'on' | 'off'>;
  renderer: RendererTrackerOptions['renderer'];
  store: ReduxTrackerOptions['store'];
  doc: Document;
  /** Undefined when the inspector runs standalone: recording is then a no-op. */
  getClient: () => RecordEventsClient | undefined;
  now?: () => number;
  flushIntervalMs?: number;
};

export type SessionRecorder = {
  /** Turning it off flushes everything captured so far to the host before resolving. */
  setEnabled(enabled: boolean): Promise<void>;
  isRecording(): boolean;
};

function inspectedEntity(engine: IEngine): DescribeContext['getInspectedEntity'] {
  return () => {
    const Selection = engine.getComponentOrNull(
      EditorComponentNames.Selection,
    ) as ComponentDefinition<unknown> | null;
    if (!Selection) return undefined;
    for (const [entity] of engine.getEntitiesWith(Selection)) {
      return entityRef(engine, entity as Entity);
    }
    return undefined;
  };
}

/**
 * Captures what the user does in the inspector — UI, scene edits, viewport, play mode — and
 * streams it to the host in batches, only between the host's `set_recording` on and off.
 */
export function createSessionRecorder(deps: SessionRecorderDeps): SessionRecorder {
  const { engine, events, renderer, store, doc, getClient, now = Date.now } = deps;
  let stopSession: (() => Promise<void>) | null = null;

  function start() {
    if (stopSession) return;
    const client = getClient();
    if (!client) return;

    const sink = createEventSink({
      send: batch => client.recordEvents(batch),
      now,
      flushIntervalMs: deps.flushIntervalMs,
    });
    const emit: Emit = event => sink.push(event);
    const ctx: DescribeContext = { getInspectedEntity: inspectedEntity(engine) };

    const trackers: Array<() => StopTracker> = [
      () => trackEcs({ engine, events, emit, now }),
      () => trackRedux({ store, emit }),
      () => trackRenderer({ engine, renderer, emit, now }),
      () => trackDom({ doc, emit, ctx, now }),
    ];
    const stops: StopTracker[] = [];
    for (const startTracker of trackers) {
      try {
        stops.push(startTracker());
      } catch (error) {
        // One capture source failing (e.g. a renderer without a capability it claims)
        // must not cost the host the rest of the recording.
        // eslint-disable-next-line no-console
        console.warn('[recorder] a capture source failed to start', error);
      }
    }

    stopSession = async () => {
      for (const stop of stops) {
        try {
          stop();
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('[recorder] a capture source failed to stop', error);
        }
      }
      await sink.stop();
    };
  }

  async function stop() {
    const stopCurrent = stopSession;
    stopSession = null;
    await stopCurrent?.();
  }

  events.on('dispose', () => void stop());

  return {
    async setEnabled(enabled) {
      if (enabled) start();
      else await stop();
    },
    isRecording: () => stopSession !== null,
  };
}
