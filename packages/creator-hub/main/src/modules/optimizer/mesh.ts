import type { Document, Transform } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import {
  dedup,
  draco,
  join,
  prune,
  quantize,
  reorder,
  simplify,
  weld,
} from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

import type { MeshOptions } from '/shared/types/optimizer';

// DCL-runtime safety. These mirror the fixed gltfpack flag set that SceneOptimizer PR #6
// validated against Genesis Plaza (see that PR's meshoptimizer+atlas/README.md). gltf-transform
// is a different engine than gltfpack, but each of the four gotchas below reproduces here, so we
// reproduce the mitigation:
//   -kv (keep unused vertex attributes) -> prune({ keepAttributes: true }). DCL textures
//       material-less "image plane" meshes at runtime; their UVs look unused to prune and would
//       otherwise be stripped, breaking runtime texturing. This one bites even at default settings.
//   -kn (keep named nodes/meshes) -> join({ keepNamed: true }). DCL identifies colliders by the
//       `_collider` node-name convention; a merge that drops names silently breaks collider lookup.
//   -vpf (float positions) + -vtf (float UVs) -> keep POSITION and TEXCOORD out of the quantize
//       `pattern`. Quantized int positions make the encoder emit a node scale/offset transform
//       (quantize's nodeTransform path only runs when POSITION matches the pattern), which for
//       gltfpack manifested as unnamed scale nodes breaking collider-by-name; quantized int UVs
//       hit glTFast bugs #75/#814 (garbled runtime textures). Normals/colors still quantize.
const QUANTIZE_KEEP_POSITION_AND_UV_FLOAT = /^(?!POSITION$|TEXCOORD_).+$/;

// Mesh optimization pass. The base transforms (`weld`/`reorder`/`dedup`/`prune`, plus
// optional `simplify`/`join`) produce plain glTF that every DCL runtime loads. The optional
// `compression` step appends an extension-based encoder — quantize / meshopt / draco — which
// shrinks geometry further but REQUIRES the target runtime to support the extension. The
// actual encoding for meshopt/draco happens at write time, using the encoders registered on
// the IO (see createIO / run in index.ts).
export async function runMeshPass(document: Document, options: MeshOptions): Promise<void> {
  await MeshoptEncoder.ready;

  const transforms: Transform[] = [weld()];

  if (options.simplify) {
    await MeshoptSimplifier.ready;
    transforms.push(
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: options.simplifyRatio,
        error: options.simplifyError,
      }),
    );
  }

  if (options.join) transforms.push(join({ keepNamed: true }));

  transforms.push(reorder({ encoder: MeshoptEncoder }), dedup(), prune({ keepAttributes: true }));

  // Extension-based geometry compression (opt-in). draco is left at its defaults for now — it
  // decodes to float in-runtime and is already gated behind a runtime-support warning.
  if (options.compression === 'quantize') {
    transforms.push(quantize({ pattern: QUANTIZE_KEEP_POSITION_AND_UV_FLOAT }));
  } else if (options.compression === 'meshopt') {
    // We do NOT use gltf-transform's meshopt(): at level 'high' it hard-codes its quantize
    // pattern to include POSITION and TEXCOORD, which reintroduces the -vpf/-vtf gotchas and
    // ignores any pattern we pass. Reproduce its pipeline by hand with the DCL-safe pattern —
    // size-oriented reorder + quantize everything except position/UV — and attach the
    // EXT_meshopt_compression extension after the transforms run (below).
    transforms.push(
      reorder({ encoder: MeshoptEncoder, target: 'size' }),
      quantize({ pattern: QUANTIZE_KEEP_POSITION_AND_UV_FLOAT }),
    );
  } else if (options.compression === 'draco') {
    transforms.push(draco());
  }

  await document.transform(...transforms);

  if (options.compression === 'meshopt') {
    document
      .createExtension(EXTMeshoptCompression)
      .setRequired(true)
      .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  }
}
