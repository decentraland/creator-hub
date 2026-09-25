import mitt from 'mitt';
import { CrdtMessageType } from '@dcl/ecs';
import type { ComponentDefinition, Entity } from '@dcl/ecs';

import type { SdkContextEvents } from '../../sdk/context';
import { createSceneTitleNotifier } from './scene-title-notifier';

const ROOT = 0 as Entity;
const sceneComponent = {
  componentName: 'inspector::SceneMetadata-v5',
} as ComponentDefinition<unknown>;
const olderSceneComponent = {
  componentName: 'inspector::SceneMetadata-v3',
} as ComponentDefinition<unknown>;
const otherComponent = { componentName: 'core::Transform' } as ComponentDefinition<unknown>;

describe('createSceneTitleNotifier', () => {
  let events: ReturnType<typeof mitt<SdkContextEvents>>;
  let notify: ReturnType<typeof vi.fn>;

  const change = (component: ComponentDefinition<unknown>, value: unknown, entity = ROOT) =>
    events.emit('change', { entity, operation: CrdtMessageType.PUT_COMPONENT, component, value });

  beforeEach(() => {
    events = mitt<SdkContextEvents>();
    notify = vi.fn().mockResolvedValue(undefined);
    createSceneTitleNotifier(events, ROOT, notify);
  });

  describe('when the root entity scene metadata name changes', () => {
    it('should report each new title once, whichever schema version streams it', () => {
      change(sceneComponent, { name: 'My s' });
      change(sceneComponent, { name: 'My s' });
      change(olderSceneComponent, { name: 'My sc' });

      expect(notify.mock.calls).toEqual([['My s'], ['My sc']]);
    });
  });

  describe('when something else changes', () => {
    it('should stay quiet for other components, other entities and nameless values', () => {
      change(otherComponent, { name: 'nope' });
      change(sceneComponent, { name: 'nope' }, 512 as Entity);
      change(sceneComponent, { description: 'no name here' });

      expect(notify).not.toHaveBeenCalled();
    });
  });

  describe('when the host rejects the report', () => {
    it('should swallow the rejection', async () => {
      notify.mockRejectedValueOnce(new Error('no such method'));

      expect(() => change(sceneComponent, { name: 'Old host' })).not.toThrow();
      await Promise.resolve();
    });
  });

  describe('when unsubscribed', () => {
    it('should stop reporting', () => {
      const fresh = mitt<SdkContextEvents>();
      const spy = vi.fn().mockResolvedValue(undefined);
      const unsubscribe = createSceneTitleNotifier(fresh, ROOT, spy);
      unsubscribe();

      fresh.emit('change', {
        entity: ROOT,
        operation: CrdtMessageType.PUT_COMPONENT,
        component: sceneComponent,
        value: { name: 'after' },
      });

      expect(spy).not.toHaveBeenCalled();
    });
  });
});
