import type { RendererActivity } from '../types';
import {
  colorName,
  createSceneObserver,
  describeComponents,
  parseComponentNames,
  parseEntityList,
} from './scene-observer';

type Entities = Record<number, Record<string, unknown>>;

// A fake engine console over a table of live entities and their components.
function fakeConsole(entities: Entities) {
  const calls: string[] = [];
  const command = vi.fn(async (cmd: string, args: string[]) => {
    calls.push([cmd, ...args].join(' '));
    if (cmd === 'scene_entities') {
      return [...Object.keys(entities), 'camera(2)', 'player(1)', 'root(0)'].join('\n');
    }
    const components = entities[Number(args[0])];
    if (!components) throw new Error(`entity ${args[0]} has no component`);
    if (cmd === 'entity_components') {
      return Object.keys(components)
        .map((name, i) => `${name} (${1000 + i}) [LWW]`)
        .join('\n');
    }
    if (cmd === 'inspect_component') {
      const value = components[args[1]];
      if (!value) throw new Error(`entity ${args[0]} has no component '${args[1]}'`);
      return JSON.stringify(value);
    }
    throw new Error(`unknown command ${cmd}`);
  });
  return { command, calls };
}

const box = (color: { r: number; g: number; b: number }, scale = 1, parent = 0) => ({
  Transform: {
    position: { x: 8, y: 1, z: 8 },
    scale: { x: scale, y: scale, z: scale },
    parent,
  },
  MeshRenderer: { mesh: { box: { uvs: [] } } },
  Material: { material: { pbr: { albedoColor: { ...color, a: 1 } } } },
});
const RED = { r: 0.9, g: 0.12, b: 0.12 };

describe('colorName', () => {
  it('should name the colours a player would', () => {
    expect(colorName(RED)).toBe('red');
    expect(colorName({ r: 0.15, g: 0.35, b: 1 })).toBe('blue');
    expect(colorName({ r: 1, g: 0.85, b: 0.1 })).toBe('yellow');
    expect(colorName({ r: 0.15, g: 0.8, b: 0.3 })).toBe('green');
    expect(colorName({ r: 0.95, g: 0.96, b: 1 })).toBe('white');
    expect(colorName({ r: 0.08, g: 0.08, b: 0.08 })).toBe('black');
    expect(colorName({ r: 0.14, g: 0.08, b: 0.32 })).toBe('dark purple');
  });
});

describe('describeComponents', () => {
  it('should describe a primitive by size, colour and shape, with its click label', () => {
    const facts = describeComponents({
      ...box(RED, 3),
      PointerEvents: { pointerEvents: [{ eventInfo: { hoverText: 'Grab' } }] },
    });
    expect(facts.description).toBe('a large red box (clickable: "Grab")');
  });

  it('should tell cones from cylinders and name models by file', () => {
    expect(
      describeComponents({
        MeshRenderer: { mesh: { cylinder: { radiusTop: 0, radiusBottom: 0.5 } } },
      }).description,
    ).toBe('a cone');
    expect(
      describeComponents({ GltfContainer: { src: 'assets/models/coin.glb' } }).description,
    ).toBe('a model "coin.glb"');
  });

  it('should skip the size of an entity that is still growing in from zero', () => {
    expect(describeComponents(box(RED, 0)).description).toBe('a red box');
  });

  it('should report nothing visible for an empty entity and keep on-screen text apart', () => {
    const facts = describeComponents({ UiText: { value: 'STAGE 2\nMOVERS' } });
    expect(facts.description).toBeNull();
    expect(facts.uiText).toBe('STAGE 2 MOVERS');
  });
});

describe('parsers', () => {
  it('should read entity ids and component names from console replies', () => {
    expect(parseEntityList('512\n131615\ncamera(2)\nplayer(1)\nroot(0)')).toEqual([512, 131615]);
    expect(parseComponentNames('Material (1017) [LWW]\nTransform (1) [LWW]')).toEqual([
      'Material',
      'Transform',
    ]);
  });
});

describe('createSceneObserver', () => {
  let entities: Entities;
  let running: boolean;
  let reported: RendererActivity[];
  let observer: ReturnType<typeof createSceneObserver>;
  let off: () => void;

  beforeEach(() => {
    entities = { 530: box({ r: 0.95, g: 0.96, b: 1 }) };
    running = true;
    reported = [];
    const { command } = fakeConsole(entities);
    observer = createSceneObserver({
      command,
      isRunning: () => running,
      setInterval: () => 1,
      clearInterval: () => undefined,
      now: () => 1_000,
    });
    off = observer.track(activity => reported.push(activity));
  });

  afterEach(() => off());

  describe('when play starts', () => {
    beforeEach(async () => {
      await observer.poll();
    });

    it('should take what is already there as the scene, not as news', () => {
      expect(reported).toEqual([]);
    });

    describe('and the scene code spawns an object', () => {
      beforeEach(async () => {
        entities[131615] = {
          ...box(RED),
          PointerEvents: { pointerEvents: [{ eventInfo: { hoverText: 'Grab' } }] },
        };
        await observer.poll();
      });

      it('should report it with what it looks like and where', () => {
        expect(reported).toEqual([
          expect.objectContaining({
            kind: 'sceneEntities',
            change: 'appeared',
            entity: 131615,
            count: 1,
            description: 'a red box (clickable: "Grab")',
            position: expect.objectContaining({ x: 8, y: 1, z: 8 }),
            at: 1_000,
          }),
        ]);
      });

      describe('and later removes it', () => {
        beforeEach(async () => {
          reported = [];
          delete entities[131615];
          await observer.poll();
        });

        it('should report that it disappeared', () => {
          expect(reported).toEqual([
            expect.objectContaining({
              change: 'removed',
              entity: 131615,
              description: 'a red box (clickable: "Grab")',
            }),
          ]);
        });
      });
    });

    describe('and the scene code builds a creature out of several parts', () => {
      beforeEach(async () => {
        entities[600] = { Transform: { position: { x: 16, y: 2, z: 25 }, parent: 0 } };
        entities[598] = box({ r: 1, g: 1, b: 1 }, 0.7, 600);
        entities[599] = box({ r: 1, g: 1, b: 1 }, 0.7, 600);
        entities[601] = box({ r: 0.14, g: 0.08, b: 0.32 }, 3.2, 600);
        await observer.poll();
      });

      it('should report one creature, named after its biggest part, at its root', () => {
        expect(reported).toEqual([
          expect.objectContaining({
            change: 'appeared',
            entity: 600,
            description: 'a large dark purple box with 2 attached parts',
            position: expect.objectContaining({ x: 16, y: 2, z: 25 }),
          }),
        ]);
      });
    });

    describe('and the scene code fires a burst of look-alikes', () => {
      beforeEach(async () => {
        for (let i = 0; i < 6; i++) entities[700 + i] = box(RED, 0.2);
        await observer.poll();
      });

      it('should report one change with a count', () => {
        expect(reported).toEqual([
          expect.objectContaining({
            change: 'appeared',
            entity: null,
            count: 6,
            description: 'a small red box',
          }),
        ]);
      });
    });

    describe('and an on-screen banner shows up', () => {
      beforeEach(async () => {
        entities[800] = { UiText: { value: 'STAGE 3' }, UiTransform: {} };
        await observer.poll();
      });

      it('should report the text', () => {
        expect(reported).toEqual([
          expect.objectContaining({ change: 'appeared', description: 'on-screen text "STAGE 3"' }),
        ]);
      });
    });
  });

  describe('when the scene is paused', () => {
    beforeEach(async () => {
      running = false;
      entities[900] = box(RED);
      await observer.poll();
    });

    it('should not read the engine (its answers are stale until the scene ticks)', () => {
      expect(reported).toEqual([]);
    });
  });

  describe('when asked what one entity looks like', () => {
    it('should describe it, or say it cannot', async () => {
      expect(await observer.describeEntity(530 as never)).toBe('a white box');
      expect(await observer.describeEntity(4242 as never)).toBeNull();
    });
  });
});
