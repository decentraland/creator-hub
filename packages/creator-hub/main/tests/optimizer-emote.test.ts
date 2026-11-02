import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_OPTIMIZE_OPTIONS } from '/shared/types/optimizer';

import { isEmoteGlb } from '../src/modules/optimizer/emote';
import { runPipeline } from '../src/modules/optimizer/pipeline';
import { createInlinePool, type CompressPool } from '../src/modules/optimizer/compress-pool';
import {
  buildEmote,
  buildPlainMesh,
  glbJson,
  writeEmbeddedGlb,
} from './helpers/optimizer-fixtures';

// The mesh pass would tree-shake an emote's skin — the rig is declared by a `skin` that no mesh
// references, since the avatar supplies the mesh at runtime — so emotes are skipped outright.

describe('isEmoteGlb', () => {
  const rig = {
    nodes: [{ name: 'Armature', children: [1] }, { name: 'Avatar_Hips' }],
    animations: [{ name: 'Clip' }],
  };

  it('recognises an animation authored against the avatar armature', () => {
    expect(isEmoteGlb('models/dance.glb', rig)).toBe(true);
  });

  it('recognises an armature carrying a prop instead of avatar bones', () => {
    expect(
      isEmoteGlb('models/attack.glb', {
        nodes: [{ name: 'Armature', children: [1] }, { name: 'Armature_Prop_Sword' }],
        animations: [{ name: 'Clip' }],
      }),
    ).toBe(true);
  });

  it('recognises the `_emote` suffix the importer adds, whatever the file holds', () => {
    expect(isEmoteGlb('models/dance_emote.glb', { nodes: [{ name: 'Door' }] })).toBe(true);
  });

  it('is not fooled by an ordinary animated model', () => {
    expect(
      isEmoteGlb('models/windmill.glb', {
        nodes: [{ name: 'Armature', children: [1] }, { name: 'Blade' }],
        animations: [{ name: 'Spin' }],
      }),
    ).toBe(false);
  });

  it('needs a clip, not just the rig', () => {
    expect(isEmoteGlb('models/rig.glb', { ...rig, animations: [] })).toBe(false);
  });

  it('tolerates a GLB whose JSON could not be read', () => {
    expect(isEmoteGlb('models/broken.glb', null)).toBe(false);
  });
});

describe('when a scene holds an emote', () => {
  let dir: string;
  let pool: CompressPool;

  // Untextured on purpose: the point here is which files the mesh pass touches, and keeping
  // sharp out of it makes the case run on the toolchain alone.
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'optimizer-emote-'));
    pool = createInlinePool();
    await writeEmbeddedGlb(buildEmote('Sword_Attack'), path.join(dir, 'models/attack.glb'));
    await writeEmbeddedGlb(buildPlainMesh('Prop'), path.join(dir, 'models/prop.glb'));
  });

  afterEach(async () => {
    await pool.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('leaves the emote byte-for-byte alone and still processes the rest', async () => {
    const emote = path.join(dir, 'models/attack.glb');
    const before = await fs.readFile(emote);

    const result = await runPipeline(dir, DEFAULT_OPTIMIZE_OPTIONS, () => {}, { pool });

    expect(result.files.find(f => f.file === 'models/attack.glb')?.status).toBe('skipped');
    expect(result.files.find(f => f.file === 'models/prop.glb')?.status).toBe('optimized');
    expect(await fs.readFile(emote)).toEqual(before);
  }, 120_000);

  it('keeps the skin that declares the rig', async () => {
    await runPipeline(dir, DEFAULT_OPTIMIZE_OPTIONS, () => {}, { pool });

    const json = await glbJson(path.join(dir, 'models/attack.glb'));
    expect(json.skins).toHaveLength(1);
    expect(json.skins[0].inverseBindMatrices).toBeDefined();
    expect(json.animations).toHaveLength(1);
  }, 120_000);
});
