import type { Document, Transform } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, quantize, reorder, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

import type { MeshOptions } from '/shared/types/optimizer';

// DCL-runtime safety. These mirror the fixed gltfpack flag set that SceneOptimizer PR #6
// validated against Genesis Plaza (see that PR's meshoptimizer+atlas/README.md). gltf-transform
// is a different engine than gltfpack, but each of the gotchas below reproduces here, so we
// reproduce the mitigation. (gltfpack's -kn, keep named nodes, has no counterpart: nothing here
// merges nodes — mesh joining was deliberately left out, as it breaks `_collider` name lookup.)
//   -kv (keep unused vertex attributes) -> prune({ keepAttributes: true }). DCL textures
//       material-less "image plane" meshes at runtime; their UVs look unused to prune and would
//       otherwise be stripped, breaking runtime texturing. This one bites even at default settings.
//   -vpf (float positions) + -vtf (float UVs) -> keep POSITION and TEXCOORD out of the quantize
//       `pattern`. Quantized int positions make the encoder emit a node scale/offset transform
//       (quantize's nodeTransform path only runs when POSITION matches the pattern), which for
//       gltfpack manifested as unnamed scale nodes breaking collider-by-name; quantized int UVs
//       hit glTFast bugs #75/#814 (garbled runtime textures). Normals/colors still quantize.
const QUANTIZE_KEEP_POSITION_AND_UV_FLOAT = /^(?!POSITION$|TEXCOORD_).+$/;

// Mesh optimization pass. The base transforms (`weld`/`reorder`/`dedup`/`prune`) are lossless and
// produce plain glTF that every DCL runtime loads. The optional `meshopt` step adds
// EXT_meshopt_compression, which shrinks geometry further but REQUIRES the target runtime to
// support the extension; the actual encoding happens at write time through the encoder
// registered on the IO (see createIO in pipeline.ts).
export async function runMeshPass(document: Document, options: MeshOptions): Promise<void> {
  await MeshoptEncoder.ready;

  const transforms: Transform[] = [weld()];

  // keepLeaves: empty marker nodes (an "Empty"/"bellMOVE" with no mesh) are exactly what a
  // scene targets by name through GltfNodeModifiers; prune's default drops them.
  transforms.push(
    reorder({ encoder: MeshoptEncoder }),
    dedup(),
    prune({ keepAttributes: true, keepLeaves: true }),
  );

  if (options.meshopt) {
    // We do NOT use gltf-transform's meshopt(): at level 'high' it hard-codes its quantize
    // pattern to include POSITION and TEXCOORD, which reintroduces the -vpf/-vtf gotchas and
    // ignores any pattern we pass. Reproduce its pipeline by hand with the DCL-safe pattern —
    // size-oriented reorder + quantize everything except position/UV — and attach the
    // EXT_meshopt_compression extension after the transforms run (below).
    transforms.push(
      reorder({ encoder: MeshoptEncoder, target: 'size' }),
      quantize({ pattern: QUANTIZE_KEEP_POSITION_AND_UV_FLOAT }),
    );
  }

  await document.transform(...transforms);

  if (options.meshopt) {
    document
      .createExtension(EXTMeshoptCompression)
      .setRequired(true)
      .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  }
}
