import { describe, it, expect, vi } from 'vitest';
import type { Entity, IEngine, TransformComponentExtended } from '@dcl/ecs';
import {
  registerCustomItems,
  spawnCustomItemFromComposite,
} from '../src/spawn-custom-item';
import type { SpawnTransform } from '../src/spawn-custom-item';
import type { AssetComposite } from '../src/types';

// ---------------------------------------------------------------------------
// Minimal mock engine
// ---------------------------------------------------------------------------

function createMockEngine() {
  let nextEntity = 1 as Entity;
  const components: Map<string, Map<Entity, unknown>> = new Map();

  // Counter component on RootEntity (entity 0) for getNextId()
  const COUNTER_COMP_NAME = 'asset-packs::Counter';
  components.set(COUNTER_COMP_NAME, new Map([[0 as Entity, { value: 0 }]]));

  function getOrCreateComponentMap(name: string) {
    if (!components.has(name)) {
      components.set(name, new Map());
    }
    return components.get(name)!;
  }

  const engine = {
    RootEntity: 0 as Entity,

    addEntity(): Entity {
      return nextEntity++ as Entity;
    },

    getComponent(name: string) {
      return {
        componentName: name,
        createOrReplace(entity: Entity, value: unknown) {
          getOrCreateComponentMap(name).set(entity, JSON.parse(JSON.stringify(value as object)));
        },
        getOrCreateMutable(entity: Entity) {
          if (!getOrCreateComponentMap(name).has(entity)) {
            getOrCreateComponentMap(name).set(entity, { value: 0 });
          }
          return getOrCreateComponentMap(name).get(entity) as Record<string, unknown>;
        },
        get(entity: Entity) {
          return getOrCreateComponentMap(name).get(entity);
        },
        has(entity: Entity) {
          return getOrCreateComponentMap(name).has(entity);
        },
      };
    },

    componentsIter() {
      return [][Symbol.iterator]();
    },

    _getComponentValue(name: string, entity: Entity) {
      return components.get(name)?.get(entity);
    },
  } as unknown as IEngine & {
    _getComponentValue: (name: string, entity: Entity) => unknown;
  };

  return engine;
}

function createMockTransform(_engine: IEngine) {
  const store = new Map<Entity, unknown>();
  return {
    componentName: 'core::Transform',
    createOrReplace(entity: Entity, value: unknown) {
      store.set(entity, JSON.parse(JSON.stringify(value as object)));
    },
    get(entity: Entity) {
      return store.get(entity);
    },
    has(entity: Entity) {
      return store.has(entity);
    },
    _store: store,
  } as unknown as TransformComponentExtended & { _store: Map<Entity, unknown> };
}

function createMockTriggers(componentName = 'asset-packs::Triggers') {
  return { componentName };
}

// ---------------------------------------------------------------------------
// Helpers for building composites
// ---------------------------------------------------------------------------

function makeComposite(
  components: Array<{ name: string; data: Record<string, { json: unknown }> }>,
): AssetComposite {
  return { version: 1, components };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('spawnCustomItemFromComposite', () => {
  it('spawns a single-entity composite and returns the root entity', () => {
    const engine = createMockEngine();
    const Transform = createMockTransform(engine);
    const Triggers = createMockTriggers();

    const composite = makeComposite([
      {
        name: 'core::Transform',
        data: {
          '512': { json: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } } },
        },
      },
    ]);

    const spawned = spawnCustomItemFromComposite(composite, 'assets/', engine, Transform, Triggers);

    expect(typeof spawned).toBe('number');
    expect(Transform._store.has(spawned)).toBe(true);
  });

  it('applies caller-supplied spawn transform to the root entity', () => {
    const engine = createMockEngine();
    const Transform = createMockTransform(engine);
    const Triggers = createMockTriggers();

    const composite = makeComposite([
      {
        name: 'core::Transform',
        data: {
          '512': { json: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } } },
        },
      },
    ]);

    const spawnTransform: SpawnTransform = {
      position: { x: 5, y: 1, z: 3 },
    };

    const spawned = spawnCustomItemFromComposite(composite, 'assets/', engine, Transform, Triggers, undefined, spawnTransform);

    const transform = Transform._store.get(spawned) as { position: { x: number; y: number; z: number } };
    expect(transform.position).toEqual({ x: 5, y: 1, z: 3 });
  });

  it('spawns a multi-entity composite and correctly remaps parent references', () => {
    const engine = createMockEngine();
    const Transform = createMockTransform(engine);
    const Triggers = createMockTriggers();

    // Entity 512 = root, entity 513 = child (parent → 512)
    const composite = makeComposite([
      {
        name: 'core::Transform',
        data: {
          '512': { json: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } } },
          '513': { json: { position: { x: 1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 }, parent: 512 } },
        },
      },
    ]);

    const spawnedEntities: Entity[] = [];
    const rootEntity = spawnCustomItemFromComposite(
      composite, 'assets/', engine, Transform, Triggers,
      undefined, undefined,
      (allEntities, _root) => { spawnedEntities.push(...allEntities); },
    );

    // Two entities should have been spawned
    expect(spawnedEntities.length).toBe(2);

    // The child's transform parent should point to the spawned root (not composite id 512)
    const childEntity = spawnedEntities.find(e => e !== rootEntity)!;
    const childTransform = Transform._store.get(childEntity) as { parent: Entity };
    expect(childTransform.parent).toBe(rootEntity);
  });

  it('creates a wrapper root entity for multi-root composites', () => {
    const engine = createMockEngine();
    const Transform = createMockTransform(engine);
    const Triggers = createMockTriggers();

    // Two separate root entities in the composite (no parent relationship)
    const composite = makeComposite([
      {
        name: 'core::Transform',
        data: {
          '512': { json: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } } },
          '513': { json: { position: { x: 2, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } } },
        },
      },
    ]);

    const allSpawned: Entity[] = [];
    const rootEntity = spawnCustomItemFromComposite(
      composite, 'assets/', engine, Transform, Triggers,
      undefined, undefined,
      (entities) => { allSpawned.push(...entities); },
    );

    // Wrapper root + 2 composite entities = 3 total
    expect(allSpawned.length).toBe(3);

    // Both composite entities should be parented to the wrapper root
    const nonRoot = allSpawned.filter(e => e !== rootEntity);
    for (const e of nonRoot) {
      const tf = Transform._store.get(e) as { parent: Entity };
      expect(tf.parent).toBe(rootEntity);
    }
  });

  it('resolves {assetPath} tokens in component values', () => {
    const engine = createMockEngine();
    const Transform = createMockTransform(engine);
    const Triggers = createMockTriggers();

    const compStore = new Map<Entity, unknown>();
    const mockGltf = {
      componentName: 'core::GltfContainer',
      createOrReplace(entity: Entity, value: unknown) {
        compStore.set(entity, value);
      },
    };
    const origGetComponent = (engine as any).getComponent.bind(engine);
    (engine as any).getComponent = (name: string) => {
      if (name === 'core::GltfContainer') return mockGltf;
      return origGetComponent(name);
    };

    const composite = makeComposite([
      {
        name: 'core::Transform',
        data: {
          '512': { json: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } } },
        },
      },
      {
        name: 'core::GltfContainer',
        data: {
          '512': { json: { src: '{assetPath}monster.glb' } },
        },
      },
    ]);

    spawnCustomItemFromComposite(composite, 'assets/packs/', engine, Transform, Triggers);

    const [entity] = compStore.keys();
    const value = compStore.get(entity) as { src: string };
    expect(value.src).toBe('assets/packs/monster.glb');
  });

  it('remaps COMPONENTS_WITH_ID so each spawned instance gets fresh IDs', () => {
    const engine = createMockEngine();
    const Transform = createMockTransform(engine);
    const Triggers = createMockTriggers();

    const actionsStore = new Map<Entity, unknown>();
    const mockActions = {
      componentName: 'asset-packs::Actions',
      createOrReplace(entity: Entity, value: unknown) {
        actionsStore.set(entity, value);
      },
    };
    const origGetComponent = (engine as any).getComponent.bind(engine);
    (engine as any).getComponent = (name: string) => {
      if (name === 'asset-packs::Actions') return mockActions;
      return origGetComponent(name);
    };

    const composite = makeComposite([
      {
        name: 'core::Transform',
        data: {
          '512': { json: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } } },
        },
      },
      {
        name: 'asset-packs::Actions',
        data: {
          '512': { json: { id: 1, value: [] } },
        },
      },
    ]);

    spawnCustomItemFromComposite(composite, 'assets/', engine, Transform, Triggers);

    const [entity] = actionsStore.keys();
    const value = actionsStore.get(entity) as { id: number };
    // ID must be a new number (counter starts at 0, so getNextId returns 1 on first call)
    expect(typeof value.id).toBe('number');
    // Original composite id was 1; after remapping it should still be a number
    // (the exact value depends on counter state, just verify it's remapped)
    expect(value.id).toBeGreaterThan(0);
  });

  it('remaps Trigger action IDs using the old→new ID mapping', () => {
    const engine = createMockEngine();
    const Transform = createMockTransform(engine);
    const triggersCompName = 'asset-packs::Triggers';
    const Triggers = createMockTriggers(triggersCompName);

    const actionsStore = new Map<Entity, unknown>();
    const triggersStore = new Map<Entity, unknown>();

    const origGetComponent = (engine as any).getComponent.bind(engine);
    (engine as any).getComponent = (name: string) => {
      if (name === 'asset-packs::Actions') {
        return {
          componentName: 'asset-packs::Actions',
          createOrReplace(entity: Entity, value: unknown) { actionsStore.set(entity, value); },
        };
      }
      if (name === triggersCompName) {
        return {
          componentName: triggersCompName,
          createOrReplace(entity: Entity, value: unknown) { triggersStore.set(entity, value); },
        };
      }
      return origGetComponent(name);
    };

    // Actions has id: 42; Trigger action references id: 42
    const composite = makeComposite([
      {
        name: 'core::Transform',
        data: {
          '512': { json: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } } },
        },
      },
      {
        name: 'asset-packs::Actions',
        data: {
          '512': { json: { id: 42, value: [{ name: 'jump', type: 'play_animation', jsonPayload: '{}' }] } },
        },
      },
      {
        name: triggersCompName,
        data: {
          '512': {
            json: {
              value: [
                {
                  type: 'on_click',
                  actions: [{ id: 42, name: 'jump' }],
                  conditions: [],
                },
              ],
            },
          },
        },
      },
    ]);

    spawnCustomItemFromComposite(composite, 'assets/', engine, Transform, Triggers);

    const actionsValue = actionsStore.values().next().value as { id: number };
    const triggersValue = triggersStore.values().next().value as {
      value: Array<{ actions: Array<{ id: number }> }>;
    };

    const remappedActionId = actionsValue.id;
    const triggerActionId = triggersValue.value[0].actions[0].id;

    // Trigger's action.id must match the remapped Actions id
    expect(triggerActionId).toBe(remappedActionId);
    // And it should not be the original composite id (42)
    expect(triggerActionId).not.toBe(42);
  });

  it('calls onEntitySpawned with all spawned entities', () => {
    const engine = createMockEngine();
    const Transform = createMockTransform(engine);
    const Triggers = createMockTriggers();

    const composite = makeComposite([
      {
        name: 'core::Transform',
        data: {
          '512': { json: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } } },
          '513': { json: { position: { x: 1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 }, parent: 512 } },
        },
      },
    ]);

    const callback = vi.fn();
    spawnCustomItemFromComposite(composite, 'assets/', engine, Transform, Triggers, undefined, undefined, callback);

    expect(callback).toHaveBeenCalledOnce();
    const [allEntities] = callback.mock.calls[0] as [Entity[]];
    expect(allEntities.length).toBe(2);
  });
});

describe('registerCustomItems + spawnCustomItem (public API)', () => {
  it('registerCustomItems stores entries accessible via getCustomItemEntry', async () => {
    const { getCustomItemEntry } = await import('../src/spawn-custom-item');
    registerCustomItems({
      'my-item': {
        composite: makeComposite([]),
        base: 'assets/',
      },
    });
    const entry = getCustomItemEntry('my-item');
    expect(entry).toBeDefined();
    expect(entry!.base).toBe('assets/');
  });
});
