import { describe, expect, it } from 'vitest';

import { isCatalogAsset } from './project-watcher';

const ROOT = '/scenes/demo';
const under = (rel: string) => `${ROOT}/${rel}`;

describe('project-watcher isCatalogAsset', () => {
  it('accepts a model dropped anywhere under assets/', () => {
    expect(isCatalogAsset(ROOT, under('assets/tree.glb'))).toBe(true);
    expect(isCatalogAsset(ROOT, under('assets/models/nested/tree.glb'))).toBe(true);
  });

  it('accepts the other catalog extensions under assets/', () => {
    for (const rel of [
      'assets/a.gltf',
      'assets/b.png',
      'assets/c.jpg',
      'assets/d.jpeg',
      'assets/e.mp3',
      'assets/f.ogg',
      'assets/g.wav',
      'assets/h.mp4',
      'assets/i.json',
    ]) {
      expect(isCatalogAsset(ROOT, under(rel))).toBe(true);
    }
  });

  it('ignores files outside the assets/ tree', () => {
    expect(isCatalogAsset(ROOT, under('src/index.ts'))).toBe(false);
    expect(isCatalogAsset(ROOT, under('scene.json'))).toBe(false);
    expect(isCatalogAsset(ROOT, under('package.json'))).toBe(false);
  });

  it('ignores the scene-graph autosave the editor writes itself', () => {
    // These are the feedback-loop guards: without them the inspector's own ~100ms
    // main.composite autosave (a `.composite`, a catalog extension) would loop the refresh.
    expect(isCatalogAsset(ROOT, under('assets/scene/main.composite'))).toBe(false);
    expect(isCatalogAsset(ROOT, under('assets/scene/main.crdt'))).toBe(false);
    expect(isCatalogAsset(ROOT, under('assets/scene/entity-names.ts'))).toBe(false);
  });

  it('ignores a non-catalog extension even under assets/', () => {
    expect(isCatalogAsset(ROOT, under('assets/notes.txt'))).toBe(false);
    expect(isCatalogAsset(ROOT, under('assets/model.blend'))).toBe(false);
  });

  it('ignores a path outside the project root', () => {
    expect(isCatalogAsset(ROOT, '/elsewhere/assets/tree.glb')).toBe(false);
  });

  it('ignores the project root itself', () => {
    expect(isCatalogAsset(ROOT, ROOT)).toBe(false);
  });
});
