import type { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';

// Same rule the scene renderer uses to tell collision proxies from visible geometry.
export const isColliderMesh = (mesh: AbstractMesh) => mesh.name.toLowerCase().includes('collider');

/** A transparent scene with a camera and the two lights every model preview shares. */
export function createPreviewScene(engine: Engine) {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 0);
  const camera = new ArcRotateCamera('preview', Math.PI / 4, Math.PI / 3, 5, Vector3.Zero(), scene);
  camera.panningSensibility = 0;
  new HemisphericLight('ambient', new Vector3(0, 1, 0), scene).intensity = 0.9;
  const key = new DirectionalLight('key', new Vector3(-1, -2, -1), scene);
  key.intensity = 0.8;
  return { scene, camera };
}

/** Points the camera at whatever visible geometry is in the scene and sets sane zoom limits. */
export function frameCamera(scene: Scene, camera: ArcRotateCamera) {
  const { min, max } = scene.getWorldExtends(mesh => mesh.isVisible && mesh.isEnabled());
  const center = min.add(max).scale(0.5);
  const size = max.subtract(min);
  const radius = Math.max(size.length(), 0.1);
  camera.setTarget(center);
  camera.radius = radius * 1.4;
  camera.lowerRadiusLimit = radius * 0.2;
  camera.upperRadiusLimit = radius * 6;
  camera.minZ = radius / 100;
  camera.maxZ = radius * 100;
  camera.wheelPrecision = 50 / radius;
}
