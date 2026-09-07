import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_OPTIMIZE_OPTIONS, type OptimizeOptions } from '/shared/types/optimizer';

import {
  OPTIMIZE_DIR,
  readManifest,
  revertFromManifest,
  type OptimizeManifest,
} from '../src/modules/optimizer/backup';
import { runPipeline } from '../src/modules/optimizer/pipeline';
import { TEXTURES_DIR } from '../src/modules/optimizer/scan';
import {
  buildQuad,
  countTriangles,
  createReaderIO,
  glbJson,
  gradientPng,
  imageRefs,
  listFiles,
  nodeNames,
  solidPng,
  writeEmbeddedGlb,
  writeExternalGlb,
} from './helpers/optimizer-fixtures';

// End-to-end over the real toolchain (devDependencies), on a synthetic scene that carries every
// case the Genesis Plaza run taught us: embedded textures, a texture already external and shared
// by two models, a flat normal map, an empty marker node, a texture the scene code names, and a
// second run over the first run's output. Slow-ish (WASM init + oxipng), so generous timeouts.

const GLBS = ['embedded', 'shared-a', 'shared-b', 'flat', 'marker', 'logo'].map(
  n => `models/${n}.glb`,
);
const MARKER_NODE = 'bellMOVE';

async function makeScene(dir: string): Promise<void> {
  const models = path.join(dir, 'models');
  const shared = await gradientPng(2);
  await writeEmbeddedGlb(
    buildQuad({ nodeName: 'Embedded', baseColor: { name: 'Embedded', png: await gradientPng(1) } }),
    path.join(models, 'embedded.glb'),
  );
  await writeExternalGlb(
    buildQuad({ nodeName: 'SharedA', baseColor: { name: 'Shared', png: shared } }),
    path.join(models, 'shared-a.glb'),
    [{ uri: 'shared.png', png: shared }],
  );
  await writeExternalGlb(
    buildQuad({ nodeName: 'SharedB', baseColor: { name: 'Shared', png: shared } }),
    path.join(models, 'shared-b.glb'),
    [{ uri: 'shared.png', png: shared }],
  );
  const flatBase = await gradientPng(3);
  const flatNormal = await solidPng([128, 128, 255, 255]);
  await writeExternalGlb(
    buildQuad({
      nodeName: 'Flat',
      baseColor: { name: 'FlatBase', png: flatBase },
      normal: { name: 'FlatNormal', png: flatNormal },
    }),
    path.join(models, 'flat.glb'),
    [
      { uri: 'flat_base.png', png: flatBase },
      { uri: 'flat_normal.png', png: flatNormal },
    ],
  );
  await writeEmbeddedGlb(
    buildQuad({
      nodeName: 'Marker',
      baseColor: { name: 'Marker', png: await gradientPng(4) },
      emptyNode: MARKER_NODE,
    }),
    path.join(models, 'marker.glb'),
  );
  const logo = await gradientPng(5);
  await writeExternalGlb(
    buildQuad({ nodeName: 'Logo', baseColor: { name: 'Logo', png: logo } }),
    path.join(models, 'logo.glb'),
    [{ uri: 'ui_logo.png', png: logo }],
  );
  await fs.mkdir(path.join(dir, 'src'), { recursive: true });
  await fs.writeFile(path.join(dir, 'src/ui.ts'), "export const LOGO = 'models/ui_logo.png';\n");
}

async function snapshot(dir: string, files: string[]): Promise<Map<string, Buffer>> {
  const out = new Map<string, Buffer>();
  for (const rel of files) out.set(rel, await fs.readFile(path.join(dir, rel)));
  return out;
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function defaults(): OptimizeOptions {
  return structuredClone(DEFAULT_OPTIMIZE_OPTIONS);
}

describe('optimizer pipeline', () => {
  let scene: string;
  let originals: Map<string, Buffer>;

  beforeEach(async () => {
    scene = await fs.mkdtemp(path.join(os.tmpdir(), 'optimizer-pipeline-'));
    await makeScene(scene);
    originals = await snapshot(scene, [
      ...GLBS,
      'models/shared.png',
      'models/flat_base.png',
      'models/flat_normal.png',
      'models/ui_logo.png',
    ]);
  });
  afterEach(async () => {
    await fs.rm(scene, { recursive: true, force: true });
  });

  describe('when run with the default options', () => {
    it('should shrink every model without changing what renders, and clean up reversibly', async () => {
      const phases: string[] = [];
      const result = await runPipeline(scene, defaults(), p => phases.push(p.phase));

      expect(result.glbsProcessed).toBe(6);
      expect(result.glbsChanged).toBe(6);
      expect(result.files.map(f => f.status)).toEqual(Array(6).fill('optimized'));
      expect(phases[0]).toBe('prepare');
      expect(phases.at(-1)).toBe('done');

      const io = await createReaderIO();
      for (const rel of GLBS) {
        const file = path.join(scene, rel);
        await expect(io.read(file)).resolves.toBeDefined();
        expect(await countTriangles(file)).toBe(2);
        const refs = await imageRefs(file);
        expect(refs.missing).toEqual([]);
        expect(
          refs.resolved.every(abs => abs.includes(`${path.sep}${TEXTURES_DIR}${path.sep}`)),
        ).toBe(true);
      }

      // The marker node survives prune; the flat normal map does not (replaced by its factor).
      expect(await nodeNames(path.join(scene, 'models/marker.glb'))).toContain(MARKER_NODE);
      const flat = await glbJson(path.join(scene, 'models/flat.glb'));
      expect(flat.materials[0].normalTexture).toBeUndefined();

      // One sidecar per distinct texture: the two shared models collapse onto one file.
      expect(result.texturesDeduped).toBe(1);
      expect(await listFiles(path.join(scene, TEXTURES_DIR))).toHaveLength(5);
      expect(result.texturesExtracted).toBe(5);

      // Superseded originals leave, unless the scene's code names them.
      const manifest = (await readManifest(scene)) as OptimizeManifest;
      expect([...manifest.removedFiles].sort()).toEqual([
        'models/flat_base.png',
        'models/flat_normal.png',
        'models/shared.png',
      ]);
      expect(result.texturesRemoved).toBe(3);
      expect(await exists(path.join(scene, 'models/shared.png'))).toBe(false);
      expect(await exists(path.join(scene, 'models/ui_logo.png'))).toBe(true);
      for (const rel of manifest.removedFiles) {
        expect(
          Buffer.compare(
            await fs.readFile(path.join(scene, OPTIMIZE_DIR, 'backup', rel)),
            originals.get(rel)!,
          ),
        ).toBe(0);
      }

      // Honest accounting: before includes what was removed, after includes what was written.
      const removedBytes = manifest.removedFiles.reduce(
        (sum, rel) => sum + originals.get(rel)!.length,
        0,
      );
      expect(result.removedBytes).toBe(removedBytes);
      expect(result.bytesBefore).toBe(
        GLBS.reduce((sum, rel) => sum + originals.get(rel)!.length, 0) + removedBytes,
      );
      expect(result.bytesAfter).toBeLessThan(result.bytesBefore);
      expect(result.sidecarBytes).toBeGreaterThan(0);

      expect([...manifest.modifiedGlbs].sort()).toEqual([...GLBS].sort());
      expect(await fs.readFile(path.join(scene, '.dclignore'), 'utf8')).toContain(OPTIMIZE_DIR);
    });
  });

  describe('when run a second time over its own output', () => {
    it('should merge into the manifest and write nothing new', async () => {
      await runPipeline(scene, defaults(), () => {});
      const first = (await readManifest(scene)) as OptimizeManifest;
      const sidecarsAfterFirst = await listFiles(path.join(scene, TEXTURES_DIR));

      const second = await runPipeline(scene, defaults(), () => {});
      const merged = (await readManifest(scene)) as OptimizeManifest;

      expect(second.texturesRemoved).toBe(0);
      expect(second.texturesExtracted).toBe(0);
      expect([...merged.modifiedGlbs].sort()).toEqual([...first.modifiedGlbs].sort());
      expect([...merged.createdFiles].sort()).toEqual([...first.createdFiles].sort());
      expect([...merged.removedFiles].sort()).toEqual([...first.removedFiles].sort());
      expect(await listFiles(path.join(scene, TEXTURES_DIR))).toEqual(sidecarsAfterFirst);

      // The backup still holds the pristine originals, not the first run's output.
      for (const rel of GLBS) {
        expect(
          Buffer.compare(
            await fs.readFile(path.join(scene, OPTIMIZE_DIR, 'backup', rel)),
            originals.get(rel)!,
          ),
        ).toBe(0);
      }
    });
  });

  describe('when reverted', () => {
    it('should restore every file byte for byte and leave no trace', async () => {
      await runPipeline(scene, defaults(), () => {});
      await runPipeline(scene, defaults(), () => {});

      const manifest = (await readManifest(scene)) as OptimizeManifest;
      const restored = await revertFromManifest(scene, manifest);

      expect(restored).toBe(6);
      for (const [rel, bytes] of originals) {
        expect(Buffer.compare(await fs.readFile(path.join(scene, rel)), bytes)).toBe(0);
      }
      expect(await listFiles(path.join(scene, TEXTURES_DIR))).toEqual([]);
      expect(await exists(path.join(scene, OPTIMIZE_DIR))).toBe(false);
      expect(await exists(path.join(scene, '.dclignore'))).toBe(false);
    });
  });

  describe('when meshopt compression is on', () => {
    it('should emit EXT_meshopt_compression that decodes to the same triangles', async () => {
      const options = defaults();
      options.mesh.compression = 'meshopt';

      await runPipeline(scene, options, () => {});

      const io = await createReaderIO();
      for (const rel of GLBS) {
        const file = path.join(scene, rel);
        const json = await glbJson(file);
        expect(json.extensionsRequired).toContain('EXT_meshopt_compression');
        const doc = await io.read(file);
        const indices = doc.getRoot().listMeshes()[0].listPrimitives()[0].getIndices();
        expect(indices?.getCount()).toBe(6);
      }
    });
  });

  describe('when every option is off', () => {
    it('should touch nothing and report every model unchanged', async () => {
      const options = defaults();
      options.mesh.enabled = false;
      options.textures = { ...options.textures, compress: false, dedup: false, externalize: false };

      const result = await runPipeline(scene, options, () => {});

      expect(result.files.map(f => f.status)).toEqual(Array(6).fill('unchanged'));
      for (const [rel, bytes] of originals) {
        expect(Buffer.compare(await fs.readFile(path.join(scene, rel)), bytes)).toBe(0);
      }
      expect(await exists(path.join(scene, TEXTURES_DIR))).toBe(false);
    });
  });
}, 120_000);
