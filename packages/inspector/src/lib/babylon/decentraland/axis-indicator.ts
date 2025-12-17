import type { Mesh, Scene, TransformNode } from '@babylonjs/core';
import { Color3, MeshBuilder, StandardMaterial, Vector3 } from '@babylonjs/core';

const AXIS_CONFIG = {
  length: 1,
  thickness: 0.05,
  arrow: {
    height: 0.375,
    diameter: 0.18,
  },
};

const AXIS_COLORS = {
  x: { diffuse: new Color3(0.9, 0.2, 0.2), emissive: new Color3(0.6, 0, 0) },
  y: { diffuse: new Color3(0.2, 0.9, 0.2), emissive: new Color3(0, 0.6, 0) },
  z: { diffuse: new Color3(0.2, 0.2, 0.9), emissive: new Color3(0, 0, 0.6) },
};

function createAxisMaterial(
  name: string,
  diffuseColor: Color3,
  emissiveColor: Color3,
  scene: Scene,
): StandardMaterial {
  const material = new StandardMaterial(`axis_${name}_material`, scene);
  material.diffuseColor = diffuseColor;
  material.emissiveColor = emissiveColor;
  material.specularColor = Color3.Black();
  return material;
}

function createAxisLine(
  name: string,
  colors: { diffuse: Color3; emissive: Color3 },
  direction: Vector3,
  scene: Scene,
  parent: TransformNode,
  doubleSided: boolean = false,
): Mesh {
  const material = createAxisMaterial(name, colors.diffuse, colors.emissive, scene);
  const length = doubleSided ? AXIS_CONFIG.length * 2 : AXIS_CONFIG.length;
  const axis = MeshBuilder.CreateCylinder(
    `axis_${name}_line`,
    { height: length, diameter: AXIS_CONFIG.thickness },
    scene,
  );

  if (!doubleSided) {
    axis.position = direction.scale(AXIS_CONFIG.length / 2);
  }

  // Rotate cylinder to align with direction
  if (direction.x !== 0) {
    axis.rotation.z = -Math.PI / 2;
  } else if (direction.z !== 0) {
    axis.rotation.x = Math.PI / 2;
  }

  axis.material = material;
  axis.isPickable = false;
  axis.parent = parent;

  return axis;
}

function createNorthArrow(scene: Scene, parent: TransformNode): Mesh[] {
  const meshes: Mesh[] = [];
  const axisLine = createAxisLine('z', AXIS_COLORS.z, new Vector3(0, 0, 1), scene, parent, true);
  meshes.push(axisLine);

  const material = createAxisMaterial(
    'z_cone_material',
    AXIS_COLORS.z.diffuse,
    AXIS_COLORS.z.emissive,
    scene,
  );
  const cone = MeshBuilder.CreateCylinder(
    'z_cone_axis',
    {
      height: AXIS_CONFIG.arrow.height,
      diameterTop: 0,
      diameterBottom: AXIS_CONFIG.arrow.diameter,
    },
    scene,
  );
  cone.position = new Vector3(0, 0, AXIS_CONFIG.length - AXIS_CONFIG.arrow.height / 8);
  cone.rotation.x = Math.PI / 2;
  cone.material = material;
  cone.isPickable = false;
  cone.parent = parent;
  meshes.push(cone);

  return meshes;
}

export function createAxisIndicator(scene: Scene, parent: TransformNode): Mesh[] {
  const meshes: Mesh[] = [];

  // X-axis: Red line (East/West) - double-sided, no arrow tip
  const xAxis = createAxisLine('x', AXIS_COLORS.x, new Vector3(1, 0, 0), scene, parent, true);

  // Y-axis: Green line (Up) - single-sided, no arrow tip
  const yAxis = createAxisLine('y', AXIS_COLORS.y, new Vector3(0, 1, 0), scene, parent, false);

  // Z-axis: Blue arrow (North/South) - double-sided line WITH arrow tip on North
  const zAxisMeshes = createNorthArrow(scene, parent);

  meshes.push(xAxis, yAxis, ...zAxisMeshes);

  return meshes;
}
