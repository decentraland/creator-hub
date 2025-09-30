import { AsyncQueue } from '@well-known-components/pushable-channel';
import type { Transport } from '@dcl/ecs';

import { consumeAllMessagesInto } from '../../logic/consume-stream';
import type { DataLayerContext } from '../types';
import { serializeEngine } from './utils/engine';

export function createStream(
  stream: AsyncIterable<{ data: Uint8Array }>,
  ctx: Omit<DataLayerContext, 'fs'>,
): AsyncGenerator<{ data: Uint8Array }> {
  const queue = new AsyncQueue<{ data: Uint8Array }>(_ => {});
  const engineSerialized = serializeEngine(ctx.engine);

  queue.enqueue({ data: engineSerialized });

  const transport: Transport = {
    filter() {
      return !queue.closed;
    },
    async send(message: Uint8Array) {
      if (queue.closed) return;
      queue.enqueue({ data: message });
    },
  };
  Object.assign(transport, { name: 'DataLayerHost' });
  ctx.engine.addTransport(transport);

  function processMessage(message: Uint8Array) {
    transport.onmessage!(message);
    void ctx.engine.update(1);
  }

  consumeAllMessagesInto(stream, processMessage).catch(err => {
    if (err instanceof Error && !err.message.includes('RPC Transport closed')) {
      console.error('Failed to consume stream from data layer ', err);
    }
    queue.close();
  });

  void ctx.engine.update(1);

  return queue;
}
