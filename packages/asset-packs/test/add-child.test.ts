import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Engine, type Composite, type Entity, type IEngine } from '@dcl/ecs';
import {
  deepReplaceAssetPath,
  substituteAssetPathInComposite,
  allocateIdsForSpawnedComponents,
  remapTriggerReferences,
  initializeComponentIdsFromComposite,
} from '../src/add-child';
import { ComponentName, createComponents, getComponents } from '../src/definitions';
import { createEntityMap } from '../src/mapping';

function makeComponent(
  name: string,
  entries: Array<[number, unknown]>,
): Composite.Definition['components'][number] {
  const data = new Map();
  for (const [entityId, json] of entries) {
    data.set(entityId, { data: { $case: 'json', json } });
  }
  return { name, jsonSchema: undefined, data } as Composite.Definition['components'][number];
}

function makeComposite(components: Composite.Definition['components']): Composite.Definition {
  return { version: 1, components } as Composite.Definition;
}

describe('deepReplaceAssetPath', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('should replace the token in nested object and array string fields', () => {
    const target: any = {
      src: '{assetPath}/scene.glb',
      nested: {
        texture: '{assetPath}/tex/diffuse.png',
        list: ['{assetPath}/a.json', 'literal', { deep: '{assetPath}/b' }],
      },
    };
    deepReplaceAssetPath(target, 'scene/assets/pack');
    expect(target.src).toBe('scene/assets/pack/scene.glb');
    expect(target.nested.texture).toBe('scene/assets/pack/tex/diffuse.png');
    expect(target.nested.list[0]).toBe('scene/assets/pack/a.json');
    expect(target.nested.list[1]).toBe('literal');
    expect(target.nested.list[2].deep).toBe('scene/assets/pack/b');
  });

  it('should be idempotent (running twice yields the same result)', () => {
    const target: any = { src: '{assetPath}/file.glb' };
    deepReplaceAssetPath(target, 'pack');
    const after = target.src;
    deepReplaceAssetPath(target, 'pack');
    expect(target.src).toBe(after);
    expect(target.src).toBe('pack/file.glb');
  });

  it('should be a no-op when the token is absent', () => {
    const target: any = { src: 'already/resolved/file.glb' };
    deepReplaceAssetPath(target, 'pack');
    expect(target.src).toBe('already/resolved/file.glb');
  });

  it('should skip the containment check for strings without path separators', () => {
    // Label-style placeholder. No `/` or `\` after substitution → fast path.
    const target: any = { label: '{assetPath}', value: 'X' };
    deepReplaceAssetPath(target, 'pack');
    expect(target.label).toBe('pack');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should fall back to the bare replacement on `..` traversal payloads', () => {
    const target: any = { src: '{assetPath}/../../etc/passwd' };
    deepReplaceAssetPath(target, 'scene/assets/pack');
    expect(target.src).toBe('scene/assets/pack');
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0][0]).toMatch(/rejected \{assetPath\} substitution/);
  });

  it('should reject `..` traversal to a sibling pack', () => {
    const target: any = { src: '{assetPath}/../sibling/file.glb' };
    deepReplaceAssetPath(target, 'scene/assets/pack');
    expect(target.src).toBe('scene/assets/pack');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('should normalize `./` and consecutive `..` segments within the asset dir', () => {
    // `pack/sub/./../sub/model.glb` normalizes to `pack/sub/model.glb` — still inside `pack`.
    const target: any = { src: '{assetPath}/sub/./../sub/model.glb' };
    deepReplaceAssetPath(target, 'pack');
    expect(target.src).toBe('pack/sub/model.glb');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should handle a trailing slash on the replacement without breaking exact-match', () => {
    // Trailing-slash on replacement should not cause the substituted string to mismatch.
    const target: any = { src: '{assetPath}/file.glb' };
    deepReplaceAssetPath(target, 'pack/');
    expect(target.src).toBe('pack/file.glb');
  });

  it('should reject traversal when replacement is empty (composite at repo root)', () => {
    const target: any = { src: '{assetPath}/../escape.glb' };
    deepReplaceAssetPath(target, '');
    // Empty replacement → containment base is `.`; `../escape.glb` escapes → fallback to ''.
    expect(target.src).toBe('');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('should substitute inside stringified-JSON wrappers under the `jsonPayload` key', () => {
    // Asset-packs Actions carry their per-action data as a JSON-encoded
    // string on the `jsonPayload` field. The walker parses, recurses, and
    // re-serializes so the path inside the wrapper survives substitution
    // while the containment check still applies to the inner path.
    const target: any = {
      jsonPayload: '{"src":"{assetPath}/scene.glb","extra":42}',
    };
    deepReplaceAssetPath(target, 'pack');
    expect(JSON.parse(target.jsonPayload)).toEqual({ src: 'pack/scene.glb', extra: 42 });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should still reject `..` traversal inside a stringified-JSON wrapper', () => {
    // The recursion into the parsed payload re-enters the same containment
    // chokepoint for the inner path string. The inner `src` falls back to
    // the bare replacement; the rest of the payload is preserved.
    const target: any = {
      jsonPayload: '{"src":"{assetPath}/../../etc/passwd","extra":42}',
    };
    deepReplaceAssetPath(target, 'scene/assets/pack');
    expect(JSON.parse(target.jsonPayload)).toEqual({
      src: 'scene/assets/pack',
      extra: 42,
    });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('should leave non-JSON `jsonPayload` strings to the plain substitution path', () => {
    // If a `jsonPayload` field ever holds a plain path (malformed author),
    // fall through to the regular path-substitution branch so behavior is
    // unchanged. The leading character `/` skips the JSON-wrapper attempt.
    const target: any = { jsonPayload: '{assetPath}/loose.glb' };
    deepReplaceAssetPath(target, 'pack');
    expect(target.jsonPayload).toBe('pack/loose.glb');
  });

  it('should leave `jsonPayload` strings without the token untouched', () => {
    const target: any = { jsonPayload: '{"src":"already/resolved.glb"}' };
    deepReplaceAssetPath(target, 'pack');
    expect(target.jsonPayload).toBe('{"src":"already/resolved.glb"}');
  });

  it('should return silently for non-object values at the top level', () => {
    // The recursion entry point bails on null/primitives.
    expect(() => deepReplaceAssetPath(null, 'pack')).not.toThrow();
    expect(() => deepReplaceAssetPath('{assetPath}/x', 'pack')).not.toThrow();
    expect(() => deepReplaceAssetPath(42, 'pack')).not.toThrow();
  });
});

describe('substituteAssetPathInComposite', () => {
  it('should substitute {assetPath} across every component JSON payload', () => {
    const composite = makeComposite([
      makeComponent('core::Transform', [[512, { src: '{assetPath}/model.glb' }]]),
      makeComponent('core::GltfContainer', [[513, { src: '{assetPath}/anim.glb' }]]),
    ]);
    substituteAssetPathInComposite(composite, 'scene/assets/pack/composite.json');
    const t = composite.components[0].data.get(512 as Entity);
    const g = composite.components[1].data.get(513 as Entity);
    expect((t!.data as any).json.src).toBe('scene/assets/pack/model.glb');
    expect((g!.data as any).json.src).toBe('scene/assets/pack/anim.glb');
  });

  it('should substitute paths nested inside Action jsonPayload wrappers', () => {
    // Mirrors the on-disk shape produced by `create-custom-asset`: each
    // resource-bearing action stores its data as a JSON-encoded string on the
    // `jsonPayload` field. The walker must descend into each `jsonPayload`,
    // substitute the `{assetPath}` token in its inner `src`, and re-serialize.
    const composite = makeComposite([
      makeComponent('core::AudioSource', [[513, { audioClipUrl: '{assetPath}/sounds/loop.mp3' }]]),
      makeComponent('asset-packs::Actions', [
        [
          513,
          {
            value: [
              {
                type: 'play_sound',
                jsonPayload: '{"src":"{assetPath}/sounds/click.mp3","volume":1}',
              },
              {
                type: 'show_image',
                jsonPayload: '{"src":"{assetPath}/textures/banner.png","width":2,"height":1}',
              },
              {
                type: 'play_custom_emote',
                jsonPayload: '{"src":"{assetPath}/emotes/wave.glb","loop":false}',
              },
              // Non-resource action (no `src`) — should be unaffected.
              { type: 'set_visibility', jsonPayload: '{"visible":true}' },
            ],
          },
        ],
      ]),
    ]);

    substituteAssetPathInComposite(composite, 'assets/custom/my_item/composite.json');

    const audio = composite.components[0].data.get(513 as Entity);
    expect((audio!.data as any).json.audioClipUrl).toBe('assets/custom/my_item/sounds/loop.mp3');

    const actions = composite.components[1].data.get(513 as Entity);
    const [playSound, showImage, playEmote, setVisibility] = (actions!.data as any).json.value;
    expect(JSON.parse(playSound.jsonPayload)).toEqual({
      src: 'assets/custom/my_item/sounds/click.mp3',
      volume: 1,
    });
    expect(JSON.parse(showImage.jsonPayload)).toEqual({
      src: 'assets/custom/my_item/textures/banner.png',
      width: 2,
      height: 1,
    });
    expect(JSON.parse(playEmote.jsonPayload)).toEqual({
      src: 'assets/custom/my_item/emotes/wave.glb',
      loop: false,
    });
    expect(JSON.parse(setVisibility.jsonPayload)).toEqual({ visible: true });
  });

  it('should substitute {assetPath} on every entity of a multi-entity composite', () => {
    // Reproduces a multi-entity custom asset: two smart items packed together
    // (entity IDs 512 and 513), each carrying its own GltfContainer + a
    // PLAY_SOUND Action whose `jsonPayload` references a `{assetPath}` path.
    // Failure mode this guards against: a per-entity bug in the walker that
    // would substitute the first entry but skip the second.
    const composite = makeComposite([
      makeComponent('core::GltfContainer', [
        [512, { src: '{assetPath}/A.glb', visibleMeshesCollisionMask: 1 }],
        [513, { src: '{assetPath}/B.glb', visibleMeshesCollisionMask: 1 }],
      ]),
      makeComponent('asset-packs::Actions', [
        [
          512,
          {
            id: '{self}',
            value: [
              {
                type: 'play_sound',
                jsonPayload: '{"src":"{assetPath}/sounds/a.mp3","loop":true}',
              },
            ],
          },
        ],
        [
          513,
          {
            id: '{self}',
            value: [
              {
                type: 'play_sound',
                jsonPayload: '{"src":"{assetPath}/sounds/b.mp3","loop":true}',
              },
            ],
          },
        ],
      ]),
    ]);

    substituteAssetPathInComposite(composite, 'assets/custom/pair/composite.json');

    const gltfA = composite.components[0].data.get(512 as Entity);
    const gltfB = composite.components[0].data.get(513 as Entity);
    expect((gltfA!.data as any).json.src).toBe('assets/custom/pair/A.glb');
    expect((gltfB!.data as any).json.src).toBe('assets/custom/pair/B.glb');

    const actionsA = composite.components[1].data.get(512 as Entity);
    const actionsB = composite.components[1].data.get(513 as Entity);
    expect(JSON.parse((actionsA!.data as any).json.value[0].jsonPayload)).toEqual({
      src: 'assets/custom/pair/sounds/a.mp3',
      loop: true,
    });
    expect(JSON.parse((actionsB!.data as any).json.value[0].jsonPayload)).toEqual({
      src: 'assets/custom/pair/sounds/b.mp3',
      loop: true,
    });
  });
});

describe('allocateIdsForSpawnedComponents', () => {
  let engine: IEngine;

  beforeEach(() => {
    engine = Engine();
    createComponents(engine);
  });

  it('should allocate fresh numeric IDs for Actions/States/Counter with `id: "{self}"`', () => {
    const { Actions, States, Counter } = getComponents(engine);
    // Spawn three live entities and seed the components with the placeholder shape.
    const e1 = engine.addEntity();
    const e2 = engine.addEntity();
    const e3 = engine.addEntity();
    Actions.createOrReplace(e1, { id: 0 as any, value: [] } as any);
    States.createOrReplace(e2, {
      id: 0 as any,
      value: [],
      defaultValue: '',
      currentValue: '',
    } as any);
    Counter.createOrReplace(e3, { id: 0 as any, value: 0 } as any);

    const composite = makeComposite([
      makeComponent(ComponentName.ACTIONS, [[100, { id: '{self}', value: [] }]]),
      makeComponent(ComponentName.STATES, [[101, { id: '{self}', value: [] }]]),
      makeComponent(ComponentName.COUNTER, [[102, { id: '{self}', value: 0 }]]),
    ]);
    const map = new Map<number, Entity>([
      [100, e1],
      [101, e2],
      [102, e3],
    ]);

    const ids = allocateIdsForSpawnedComponents(engine, composite, map);

    const id1 = ids.get(`${ComponentName.ACTIONS}:100`);
    const id2 = ids.get(`${ComponentName.STATES}:101`);
    const id3 = ids.get(`${ComponentName.COUNTER}:102`);
    expect(id1).toBeTypeOf('number');
    expect(id2).toBeTypeOf('number');
    expect(id3).toBeTypeOf('number');
    expect(new Set([id1, id2, id3]).size).toBe(3);

    // The live components carry the allocated IDs.
    expect(Actions.get(e1).id).toBe(id1);
    expect(States.get(e2).id).toBe(id2);
    expect(Counter.get(e3).id).toBe(id3);
  });

  it('should ignore composite components not in COMPONENTS_WITH_ID', () => {
    const composite = makeComposite([makeComponent('core::Transform', [[100, { id: '{self}' }]])]);
    const map = new Map<number, Entity>([[100, engine.addEntity()]]);
    const ids = allocateIdsForSpawnedComponents(engine, composite, map);
    expect(ids.size).toBe(0);
  });

  it('should skip payloads whose `id` is not the literal `{self}`', () => {
    const { Actions } = getComponents(engine);
    const e = engine.addEntity();
    Actions.createOrReplace(e, { id: 42 as any, value: [] } as any);

    const composite = makeComposite([
      makeComponent(ComponentName.ACTIONS, [[100, { id: 42, value: [] }]]),
    ]);
    const ids = allocateIdsForSpawnedComponents(
      engine,
      composite,
      new Map<number, Entity>([[100, e]]),
    );
    expect(ids.size).toBe(0);
    expect(Actions.get(e).id).toBe(42);
  });

  it('should skip composite entries with no live destination entity', () => {
    const composite = makeComposite([
      makeComponent(ComponentName.ACTIONS, [[100, { id: '{self}', value: [] }]]),
    ]);
    const ids = allocateIdsForSpawnedComponents(engine, composite, new Map());
    expect(ids.size).toBe(0);
  });
});

describe('remapTriggerReferences', () => {
  let engine: IEngine;

  beforeEach(() => {
    engine = Engine();
    createComponents(engine);
  });

  it("should resolve `{self:Component}` against the trigger's own entity", () => {
    const { Triggers } = getComponents(engine);
    const dest = engine.addEntity();
    Triggers.createOrReplace(dest, {
      value: [
        {
          type: 't',
          conditions: [],
          actions: [{ id: '{self:asset-packs::Actions}', name: 'a' }],
        },
      ],
    } as any);

    const ids = new Map<string, number>([[`${ComponentName.ACTIONS}:100`, 999]]);
    remapTriggerReferences(engine, [[dest, 100]], ids);

    const triggers = Triggers.get(dest).value;
    expect(triggers[0].actions[0].id as any).toBe(999);
  });

  it('should resolve `{N:Component}` cross-entity references', () => {
    const { Triggers } = getComponents(engine);
    const dest = engine.addEntity();
    Triggers.createOrReplace(dest, {
      value: [
        {
          type: 't',
          conditions: [],
          actions: [{ id: `{100:${ComponentName.ACTIONS}}`, name: 'a' }],
        },
      ],
    } as any);

    const ids = new Map<string, number>([[`${ComponentName.ACTIONS}:100`, 555]]);
    remapTriggerReferences(engine, [[dest, 999]], ids);

    expect(Triggers.get(dest).value[0].actions[0].id as any).toBe(555);
  });

  it('should leave unresolved placeholders and non-string ids untouched', () => {
    const { Triggers } = getComponents(engine);
    const dest = engine.addEntity();
    Triggers.createOrReplace(dest, {
      value: [
        {
          type: 't',
          conditions: [{ id: 7, type: 'c' }],
          actions: [
            { id: '{self:UnknownComponent}', name: 'a' },
            { id: 42, name: 'b' },
          ],
        },
      ],
    } as any);

    remapTriggerReferences(engine, [[dest, 100]], new Map());

    const t = Triggers.get(dest).value[0];
    expect((t.actions[0] as any).id).toBe('{self:UnknownComponent}');
    expect((t.actions[1] as any).id).toBe(42);
    expect((t.conditions![0] as any).id).toBe(7);
  });

  it('should rewrite both `actions[].id` and `conditions[].id`', () => {
    const { Triggers } = getComponents(engine);
    const dest = engine.addEntity();
    Triggers.createOrReplace(dest, {
      value: [
        {
          type: 't',
          conditions: [{ id: `{self:${ComponentName.STATES}}`, type: 'c' }],
          actions: [{ id: `{self:${ComponentName.ACTIONS}}`, name: 'a' }],
        },
      ],
    } as any);

    const ids = new Map<string, number>([
      [`${ComponentName.ACTIONS}:1`, 10],
      [`${ComponentName.STATES}:1`, 20],
    ]);
    remapTriggerReferences(engine, [[dest, 1]], ids);

    const t = Triggers.get(dest).value[0];
    expect((t.actions[0] as any).id).toBe(10);
    expect((t.conditions![0] as any).id).toBe(20);
  });

  it('should tolerate triggers with no `conditions` array', () => {
    const { Triggers } = getComponents(engine);
    const dest = engine.addEntity();
    Triggers.createOrReplace(dest, {
      value: [
        {
          type: 't',
          actions: [{ id: `{self:${ComponentName.ACTIONS}}`, name: 'a' }],
        },
      ],
    } as any);

    const ids = new Map<string, number>([[`${ComponentName.ACTIONS}:1`, 77]]);
    expect(() => remapTriggerReferences(engine, [[dest, 1]], ids)).not.toThrow();
    expect((Triggers.get(dest).value[0].actions[0] as any).id).toBe(77);
  });
});

describe('initializeComponentIdsFromComposite (round trip)', () => {
  it('should allocate IDs and rewrite trigger references using the supplied EntityMap', () => {
    const engine = Engine();
    createComponents(engine);
    const { Actions, Triggers } = getComponents(engine);

    // Live spawned entity that maps to composite-entity-id 100.
    const dest = engine.addEntity();
    Actions.createOrReplace(dest, { id: 0 as any, value: [] } as any);
    Triggers.createOrReplace(dest, {
      value: [
        {
          type: 't',
          conditions: [],
          actions: [{ id: `{self:${ComponentName.ACTIONS}}`, name: 'a' }],
        },
      ],
    } as any);

    // Build the EntityMap the caller would normally populate via
    // EMM_DIRECT_MAPPING during Composite.instance.
    const entityMap = createEntityMap();
    entityMap.put(100 as Entity, dest);

    const composite = makeComposite([
      makeComponent(ComponentName.ACTIONS, [[100, { id: '{self}', value: [] }]]),
    ]);

    initializeComponentIdsFromComposite(engine, composite, entityMap);

    const allocatedId = Actions.get(dest).id;
    expect(allocatedId).toBeTypeOf('number');
    expect(allocatedId).not.toBe(0);
    expect((Triggers.get(dest).value[0].actions[0] as any).id).toBe(allocatedId);
  });
});
