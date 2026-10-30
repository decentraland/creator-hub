import mitt from 'mitt';
import { CrdtMessageType } from '@dcl/ecs';
import type { ComponentDefinition, Entity } from '@dcl/ecs';

import type { SdkContextEvents } from '../../sdk/context';
import { createSceneMetadataNotifier } from './scene-metadata-notifier';

const ROOT = 0 as Entity;
const sceneComponent = {
  componentName: 'inspector::SceneMetadata-v5',
} as ComponentDefinition<unknown>;
const olderSceneComponent = {
  componentName: 'inspector::SceneMetadata-v3',
} as ComponentDefinition<unknown>;
const otherComponent = { componentName: 'core::Transform' } as ComponentDefinition<unknown>;

const singleParcel = { base: { x: 0, y: 0 }, parcels: [{ x: 0, y: 0 }] };
const twoByTwo = {
  base: { x: 0, y: 0 },
  parcels: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],
};

describe('createSceneMetadataNotifier', () => {
  let events: ReturnType<typeof mitt<SdkContextEvents>>;
  let notify: ReturnType<typeof vi.fn>;

  const change = (component: ComponentDefinition<unknown>, value: unknown, entity = ROOT) =>
    events.emit('change', { entity, operation: CrdtMessageType.PUT_COMPONENT, component, value });

  beforeEach(() => {
    events = mitt<SdkContextEvents>();
    notify = vi.fn().mockResolvedValue(undefined);
    createSceneMetadataNotifier(events, ROOT, notify);
  });

  describe('when the root entity scene metadata name changes', () => {
    it('should report each new title once, whichever schema version streams it', () => {
      change(sceneComponent, { name: 'My s', layout: singleParcel });
      change(sceneComponent, { name: 'My s', layout: singleParcel });
      change(olderSceneComponent, { name: 'My sc', layout: singleParcel });

      expect(notify.mock.calls.map(([metadata]) => metadata.title)).toEqual(['My s', 'My sc']);
    });
  });

  describe('when the root entity scene metadata layout changes', () => {
    it('should report the parcels and base in scene.json form', () => {
      change(sceneComponent, { name: 'Scene', layout: singleParcel });
      change(sceneComponent, { name: 'Scene', layout: twoByTwo });

      expect(notify.mock.calls).toEqual([
        [{ title: 'Scene', scene: { base: '0,0', parcels: ['0,0'] } }],
        [{ title: 'Scene', scene: { base: '0,0', parcels: ['0,0', '1,0', '0,1', '1,1'] } }],
      ]);
    });
  });

  describe('when something else changes', () => {
    it('should stay quiet for other components, other entities and nameless values', () => {
      change(otherComponent, { name: 'nope', layout: singleParcel });
      change(sceneComponent, { name: 'nope', layout: singleParcel }, 512 as Entity);
      change(sceneComponent, { description: 'no name here' });

      expect(notify).not.toHaveBeenCalled();
    });
  });

  describe('when the host rejects the report', () => {
    it('should swallow the rejection', async () => {
      notify.mockRejectedValueOnce(new Error('no such method'));

      expect(() =>
        change(sceneComponent, { name: 'Old host', layout: singleParcel }),
      ).not.toThrow();
      await Promise.resolve();
    });
  });

  describe('when unsubscribed', () => {
    it('should stop reporting', () => {
      const fresh = mitt<SdkContextEvents>();
      const spy = vi.fn().mockResolvedValue(undefined);
      const unsubscribe = createSceneMetadataNotifier(fresh, ROOT, spy);
      unsubscribe();

      fresh.emit('change', {
        entity: ROOT,
        operation: CrdtMessageType.PUT_COMPONENT,
        component: sceneComponent,
        value: { name: 'after', layout: singleParcel },
      });

      expect(spy).not.toHaveBeenCalled();
    });
  });
});
