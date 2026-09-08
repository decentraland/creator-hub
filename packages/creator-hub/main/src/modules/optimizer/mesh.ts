import type { Document, Transform } from '@gltf-transform/core';
import { dedup, prune, reorder, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

import type { MeshOptions } from '/shared/types/optimizer';

// DCL-runtime safety. This mirrors the fixed gltfpack flag set that SceneOptimizer PR #6
// validated against Genesis Plaza (see that PR's meshoptimizer+atlas/README.md). gltf-transform
// is a different engine than gltfpack, but the gotcha below reproduces here, so we reproduce the
// mitigation. (gltfpack's -kn, keep named nodes, has no counterpart: nothing here merges nodes —
// mesh joining was deliberately left out, as it breaks `_collider` name lookup. Its -vpf/-vtf,
// float positions and UVs, only matter once geometry is quantized, which this pass does not do.)
//   -kv (keep unused vertex attributes) -> prune({ keepAttributes: true }). DCL textures
//       material-less "image plane" meshes at runtime; their UVs look unused to prune and would
//       otherwise be stripped, breaking runtime texturing. This one bites even at default settings.

// Mesh optimization pass: `weld` / `reorder` / `dedup` / `prune`, all lossless, producing plain
// glTF that every DCL runtime loads. Extension-based geometry compression (quantize / meshopt /
// draco) is a separate PR — it needs runtime-support checks in-world first.
export async function runMeshPass(document: Document, _options: MeshOptions): Promise<void> {
  await MeshoptEncoder.ready;

  const transforms: Transform[] = [weld()];

  // keepLeaves: empty marker nodes (an "Empty"/"bellMOVE" with no mesh) are exactly what a
  // scene targets by name through GltfNodeModifiers; prune's default drops them.
  transforms.push(
    reorder({ encoder: MeshoptEncoder }),
    dedup(),
    prune({ keepAttributes: true, keepLeaves: true }),
  );

  await document.transform(...transforms);
}
