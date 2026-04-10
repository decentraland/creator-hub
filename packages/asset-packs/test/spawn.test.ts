import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Entity, IEngine } from '@dcl/ecs';
import { spawnCustomItem } from '../src/spawn';
import type { AssetComposite } from '../src/types';

// ─── Mock engine factory ──────────────────────────────────────────────────────

type ComponentStore = Map<Entity, any>;

function createMockComponent(name: string) {
  const store: ComponentStore = new Map();
  return {
    componentName: name,
    componentId: Math.floor(Math.random() * 10000),
    createOrReplace: vi.fn((entity: Entity, value: any) => {
      store.set(entity, { ...value });
    }),
    create: vi.fn((entity: Entity, value: any) => {
      store.set(entity, { ...value });
    }),
    get: (entity: Entity) => store.get(entity),
    getMutableOrNull: (entity: Entity) => store.get(entity) ?? null,
    has: (entity: Entity) => store.has(entity),
    _store: store,
  };
}

function createMockEngine() {
  let nextEntityId = 100 as Entity;
  const components = new Map<string, ReturnType<typeof createMockComponent>>();
  const createdEntities: Entity[] = [];

  // Pre-register the components spawn.ts will look up.
  const componentNames = [
    'core::Transform',
    'core::Name',
    'core::Tags',
    'core-schema::Network-Entity',
    'core-schema::Sync-Components',
    'core::GltfContainer',
    'core::AudioSource',
    'core::VideoPlayer',
    'core::Material',
  ];
  for (const name of componentNames) {
    components.set(name, createMockComponent(name));
  }

  // Mock Counter component used by getNextId (ACTIONS component tracking)
  const counterComp = createMockComponent('asset-packs::Counter');
  counterComp._store.set(512 as Entity, { value: 0 }); // RootEntity = 512
  components.set('asset-packs::Counter', counterComp);

  const engine: Partial<IEngine> & {
    _components: typeof components;
    _entities: Entity[];
    _root: Entity;
  } = {
    RootEntity: 512 as Entity,
    _components: components,
    _entities: createdEntities,
    _root: 512 as Entity,

    addEntity: () => {
      const id = nextEntityId++;
      createdEntities.push(id);
      return id as Entity;
    },
    getComponent: (nameOrId: string | number) => {
      // Look up by string name (what spawn.ts uses)
      if (typeof nameOrId === 'string') {
        if (!components.has(nameOrId)) {
          // Register on-demand for unknown components (actions, triggers, etc.)
          components.set(nameOrId, createMockComponent(nameOrId));
        }
        return components.get(nameOrId) as any;
      }
      // Look up by numeric ID
      for (const comp of components.values()) {
        if (comp.componentId === nameOrId) return comp as any;
      }
      throw new Error(`Component ${nameOrId} not found`);
    },
  };

  return engine as unknown as IEngine & {
    _components: typeof components;
    _entities: Entity[];
    _root: Entity;
  };
}

// ─── Composite fixtures ───────────────────────────────────────────────────────

function makeSingleEntityComposite(): AssetComposite {
  return {
    version: 1,
    components: [
      {
        name: 'core::Transform',
        data: {
          '0': {
            json: { position: { x: 1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
          },
        },
      },
      {
        name: 'core::Name',
        data: { '0': { json: { value: 'MonsterA' } } },
      },
      {
        name: 'core::GltfContainer',
        data: {
          '0': {
            json: { src: '{assetPath}/monster.glb', visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 3 },
          },
        },
      },
    ],
  };
}

function makeMultiEntityComposite(): AssetComposite {
  return {
    version: 1,
    components: [
      {
        name: 'core::Transform',
        data: {
          '512': { json: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } } },
          '513': { json: { position: { x: 0, y: 1, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 }, parent: 512 } },
        },
      },
      {
        name: 'core::Name',
        data: {
          '512': { json: { value: 'Root' } },
          '513': { json: { value: 'Child' } },
        },
      },
      {
        name: 'core::GltfContainer',
        data: {
          '513': { json: { src: '{assetPath}/body.glb' } },
        },
      },
    ],
  };
}

// ─── Registry fixture ─────────────────────────────────────────────────────────

const MOCK_REGISTRY = {
  'uuid-monster-1': { path: 'custom/monster', name: 'Monster' },
  'uuid-chest-1': { path: 'custom/chest', name: 'Treasure Chest' },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('spawnCustomItem', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Reset module-level state by re-importing (vitest isolates modules per test file,
    // so we manipulate fetch to control the lazy registry load).
    vi.resetAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(registry: any, composites: Record<string, AssetComposite>) {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url === 'custom/registry.json') {
        return { ok: true, json: async () => registry } as Response;
      }
      for (const [path, composite] of Object.entries(composites)) {
        if (url === `${path}/composite.json`) {
          return { ok: true, json: async () => composite } as Response;
        }
      }
      return { ok: false, status: 404 } as Response;
    }) as unknown as typeof fetch;
  }

  describe('when the registry fetch fails', () => {
    it('should return undefined and log an error', async () => {
      globalThis.fetch = vi.fn(async () => ({ ok: false, status: 500 } as Response)) as unknown as typeof fetch;
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const engine = createMockEngine();

      const result = await spawnCustomItem(engine, 'any-id', engine.RootEntity, { x: 0, y: 0, z: 0 });

      expect(result).toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('not found'), expect.anything());
      errorSpy.mockRestore();
    });
  });

  describe('when the asset ID does not exist in the registry', () => {
    it('should return undefined and log an error', async () => {
      // Reset internal registry cache by providing a fresh fetch mock.
      // NOTE: Because the module caches the registry, we test this with a
      // registry that does NOT contain the requested ID.
      mockFetch({ 'other-id': { path: 'custom/other', name: 'Other' } }, {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const engine = createMockEngine();

      const result = await spawnCustomItem(engine, 'missing-id', engine.RootEntity, { x: 0, y: 0, z: 0 });

      expect(result).toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('"missing-id"'));
      errorSpy.mockRestore();
    });
  });

  describe('when the composite fetch fails', () => {
    it('should return undefined and log an error', async () => {
      globalThis.fetch = vi.fn(async (url: string) => {
        if (url === 'custom/registry.json') {
          return { ok: true, json: async () => MOCK_REGISTRY } as Response;
        }
        return { ok: false, status: 404 } as Response;
      }) as unknown as typeof fetch;

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const engine = createMockEngine();

      const result = await spawnCustomItem(engine, 'uuid-monster-1', engine.RootEntity, { x: 0, y: 0, z: 0 });

      expect(result).toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load composite'),
        expect.anything(),
      );
      errorSpy.mockRestore();
    });
  });

  describe('single-entity composite', () => {
    it('should return a root entity', async () => {
      mockFetch(MOCK_REGISTRY, { 'custom/monster': makeSingleEntityComposite() });
      const engine = createMockEngine();

      const entity = await spawnCustomItem(engine, 'uuid-monster-1', engine.RootEntity, { x: 5, y: 0, z: 3 });

      expect(entity).toBeDefined();
      expect(typeof entity).toBe('number');
    });

    it('should substitute {assetPath} in GltfContainer.src', async () => {
      mockFetch(MOCK_REGISTRY, { 'custom/monster': makeSingleEntityComposite() });
      const engine = createMockEngine();

      const entity = await spawnCustomItem(engine, 'uuid-monster-1', engine.RootEntity, { x: 0, y: 0, z: 0 });

      const GltfContainer = (engine as any)._components.get('core::GltfContainer');
      const stored = GltfContainer._store.get(entity);
      expect(stored?.src).toBe('custom/monster/monster.glb');
    });

    it('should set the root entity position from the argument', async () => {
      mockFetch(MOCK_REGISTRY, { 'custom/monster': makeSingleEntityComposite() });
      const engine = createMockEngine();
      const position = { x: 10, y: 2, z: 5 };

      const entity = await spawnCustomItem(engine, 'uuid-monster-1', engine.RootEntity, position);

      const Transform = (engine as any)._components.get('core::Transform');
      const stored = Transform._store.get(entity);
      expect(stored?.position).toEqual(position);
    });

    it('should set the parent to the provided entity', async () => {
      mockFetch(MOCK_REGISTRY, { 'custom/monster': makeSingleEntityComposite() });
      const engine = createMockEngine();

      const customParent = 200 as Entity;
      const entity = await spawnCustomItem(engine, 'uuid-monster-1', customParent, { x: 0, y: 0, z: 0 });

      const Transform = (engine as any)._components.get('core::Transform');
      const stored = Transform._store.get(entity);
      expect(stored?.parent).toBe(customParent);
    });
  });

  describe('multi-entity composite', () => {
    it('should create multiple entities', async () => {
      mockFetch(MOCK_REGISTRY, { 'custom/monster': makeMultiEntityComposite() });
      const engine = createMockEngine();
      const initialEntityCount = (engine as any)._entities.length;

      const entity = await spawnCustomItem(engine, 'uuid-monster-1', engine.RootEntity, { x: 0, y: 0, z: 0 });

      expect(entity).toBeDefined();
      // Should have created at least 2 entities (root + child)
      expect((engine as any)._entities.length - initialEntityCount).toBeGreaterThanOrEqual(2);
    });

    it('should apply {assetPath} substitution to child entities', async () => {
      mockFetch(MOCK_REGISTRY, { 'custom/monster': makeMultiEntityComposite() });
      const engine = createMockEngine();

      await spawnCustomItem(engine, 'uuid-monster-1', engine.RootEntity, { x: 0, y: 0, z: 0 });

      const GltfContainer = (engine as any)._components.get('core::GltfContainer');
      // Find the entity that has GltfContainer applied
      let foundResolvedPath = false;
      for (const [, value] of GltfContainer._store.entries()) {
        if (value?.src === 'custom/monster/body.glb') {
          foundResolvedPath = true;
          break;
        }
      }
      expect(foundResolvedPath).toBe(true);
    });
  });

  describe('name-based lookup', () => {
    it('should find a custom item by display name as fallback', async () => {
      mockFetch(MOCK_REGISTRY, { 'custom/chest': makeSingleEntityComposite() });
      const engine = createMockEngine();

      // 'Treasure Chest' is the name, not the UUID
      const entity = await spawnCustomItem(engine, 'Treasure Chest', engine.RootEntity, { x: 0, y: 0, z: 0 });

      expect(entity).toBeDefined();
    });
  });

  describe('optional transform overrides', () => {
    it('should apply rotation override to the root entity', async () => {
      mockFetch(MOCK_REGISTRY, { 'custom/monster': makeSingleEntityComposite() });
      const engine = createMockEngine();
      const rotation = { x: 0, y: 0.707, z: 0, w: 0.707 };

      const entity = await spawnCustomItem(
        engine,
        'uuid-monster-1',
        engine.RootEntity,
        { x: 0, y: 0, z: 0 },
        { rotation },
      );

      const Transform = (engine as any)._components.get('core::Transform');
      const stored = Transform._store.get(entity);
      expect(stored?.rotation).toEqual(rotation);
    });
  });
});
