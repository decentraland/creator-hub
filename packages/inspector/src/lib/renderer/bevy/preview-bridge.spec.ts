import mitt from 'mitt';
import type { Emitter } from 'mitt';

import type { RendererEvents } from '../types';
import type { EngineWindow } from './console';
import { createPreviewBridge } from './preview-bridge';

/**
 * The preview bridge pushes live (mid-drag) `previewTransforms` straight to the
 * engine as `set_component Transform` — so the entity tracks the gizmo without a
 * CRDT write per frame. Driven with a fake `send` recorder.
 */
describe('createPreviewBridge', () => {
  let events: Emitter<RendererEvents>;
  let sent: Array<{ cmd: string; args: string[] }>;
  let disconnect: () => void;

  beforeEach(() => {
    events = mitt<RendererEvents>();
    sent = [];
    disconnect = createPreviewBridge({
      events,
      engineWindow: {} as EngineWindow,
      send: (cmd, args) => {
        sent.push({ cmd, args });
        return Promise.resolve('');
      },
    });
  });

  afterEach(() => disconnect());

  it('should push each previewed transform as set_component Transform', () => {
    events.emit('previewTransforms', {
      transforms: [
        {
          entity: 512 as never,
          position: { x: 1, y: 2, z: 3 } as never,
          rotation: { x: 0, y: 0, z: 0, w: 1 } as never,
          scale: { x: 1, y: 1, z: 1 } as never,
        },
      ],
    });

    expect(sent).toHaveLength(1);
    expect(sent[0].cmd).toBe('set_component');
    expect(sent[0].args[0]).toBe('512');
    expect(sent[0].args[1]).toBe('Transform');
    const value = JSON.parse(sent[0].args[2]);
    expect(value.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(value.rotation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    expect(value.scale).toEqual({ x: 1, y: 1, z: 1 });
  });

  it('should push one command per entity in a multi-entity preview', () => {
    events.emit('previewTransforms', {
      transforms: [
        {
          entity: 1 as never,
          position: { x: 0, y: 0, z: 0 } as never,
          rotation: { x: 0, y: 0, z: 0, w: 1 } as never,
          scale: { x: 1, y: 1, z: 1 } as never,
        },
        {
          entity: 2 as never,
          position: { x: 4, y: 0, z: 0 } as never,
          rotation: { x: 0, y: 0, z: 0, w: 1 } as never,
          scale: { x: 1, y: 1, z: 1 } as never,
        },
      ],
    });
    expect(sent.map(s => s.args[0])).toEqual(['1', '2']);
  });

  it('should stop pushing after disconnect', () => {
    disconnect();
    events.emit('previewTransforms', {
      transforms: [
        {
          entity: 512 as never,
          position: { x: 1, y: 2, z: 3 } as never,
          rotation: { x: 0, y: 0, z: 0, w: 1 } as never,
          scale: { x: 1, y: 1, z: 1 } as never,
        },
      ],
    });
    expect(sent).toEqual([]);
  });
});
