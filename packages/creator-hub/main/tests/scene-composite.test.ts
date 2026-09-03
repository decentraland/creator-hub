import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  buildRoster,
  entityDetail,
  projectInfo,
  readComposite,
} from '../src/modules/scene-composite';

// A composite in the real on-disk shape: every component keys its data by entity id.
const composite = {
  version: 1,
  components: [
    {
      name: 'core-schema::Name',
      data: {
        '512': { json: { value: 'Front Door' } },
        '513': { json: { value: 'Cube' } },
        '514': { json: { value: 'Zombie' } },
      },
    },
    {
      name: 'core::Transform',
      data: {
        '512': {
          json: {
            position: { x: 8, y: 1.5, z: 10 },
            scale: { x: 1, y: 1, z: 1 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            parent: 0,
          },
        },
        // A nameless entity: has a Transform but no Name — not addressable, excluded.
        '999': { json: { position: { x: 0, y: 0, z: 0 } } },
      },
    },
    { name: 'core::GltfContainer', data: { '512': { json: { src: 'assets/door.glb' } } } },
    { name: 'core::MeshRenderer', data: { '513': { json: {} } } },
    { name: 'asset-packs::Triggers', data: { '514': { json: { value: [] } } } },
    { name: 'inspector::Selection', data: { '512': { json: {} } } }, // hidden bookkeeping
  ],
};

describe('buildRoster', () => {
  it('includes only named entities, sorted by id, with the total', () => {
    const { entities, total } = buildRoster(composite);
    expect(total).toBe(3);
    expect(entities.map(e => e.id)).toEqual([512, 513, 514]);
    expect(entities.map(e => e.name)).toEqual(['Front Door', 'Cube', 'Zombie']);
  });

  it('classifies kind and captures transform + gltf', () => {
    const [door, cube, zombie] = buildRoster(composite).entities;
    expect(door.kind).toBe('model');
    expect(door.position).toEqual({ x: 8, y: 1.5, z: 10 });
    expect(door.parent).toBe(0);
    expect(door.gltf).toBe('assets/door.glb');
    expect(door.smartItem).toBe(false);
    expect(cube.kind).toBe('primitive');
    expect(zombie.kind).toBe('smart-item');
    expect(zombie.smartItem).toBe(true);
  });

  it('hides internal bookkeeping components and strips the namespace prefix', () => {
    const [door] = buildRoster(composite).entities;
    expect(door.components).toContain('Transform');
    expect(door.components).toContain('GltfContainer');
    expect(door.components).not.toContain('Selection'); // inspector::Selection is hidden
    expect(door.components.every(c => !c.includes('::'))).toBe(true);
  });
});

describe('entityDetail', () => {
  it('resolves by numeric id and returns every component (incl. hidden)', () => {
    const detail = entityDetail(composite, '512');
    expect(detail?.id).toBe(512);
    expect(detail?.name).toBe('Front Door');
    expect(Object.keys(detail?.components ?? {})).toContain('core::Transform');
    expect(Object.keys(detail?.components ?? {})).toContain('inspector::Selection');
  });

  it('resolves by Name, case-insensitively', () => {
    expect(entityDetail(composite, 'front door')?.id).toBe(512);
  });

  it('returns null when nothing matches', () => {
    expect(entityDetail(composite, 'nope')).toBeNull();
  });
});

describe('readComposite + projectInfo (fs)', () => {
  const dirs: string[] = [];
  const makeProject = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-scene-'));
    dirs.push(dir);
    fs.mkdirSync(path.join(dir, 'assets', 'scene'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'assets', 'scene', 'main.composite'),
      JSON.stringify(composite),
    );
    fs.writeFileSync(
      path.join(dir, 'scene.json'),
      JSON.stringify({
        display: { title: 'My Scene' },
        scene: { parcels: ['0,0', '0,1'], base: '0,0' },
        main: 'bin/index.js',
        runtimeVersion: '7',
      }),
    );
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'my-scene', dependencies: { '@dcl/sdk': '^7.5.0' } }),
    );
    return dir;
  };

  afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
  });

  it('reads and parses the composite from disk', async () => {
    const dir = makeProject();
    expect(buildRoster(await readComposite(dir)).total).toBe(3);
  });

  it('throws a readable error when the composite is missing', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-empty-'));
    dirs.push(dir);
    await expect(readComposite(dir)).rejects.toThrow(/No scene composite/);
  });

  it('reports scene name, parcels and SDK version', async () => {
    const dir = makeProject();
    const info = (await projectInfo(dir)) as {
      scene: { name: string; parcels: string[] };
      sdkVersion: string;
      projectName: string;
    };
    expect(info.scene.name).toBe('My Scene');
    expect(info.scene.parcels).toEqual(['0,0', '0,1']);
    expect(info.sdkVersion).toBe('^7.5.0');
    expect(info.projectName).toBe('my-scene');
  });
});
