import * as BABYLON from '@babylonjs/core';

interface AxisHelperSetup {
  dispose: () => void;
}

interface AxisDefinition {
  name: string;
  diffuseColor: BABYLON.Color3;
  emissiveColor: BABYLON.Color3;
  labelColor: BABYLON.Color3;
  rotation: BABYLON.Vector3;
  positionOffset: BABYLON.Vector3;
  labelPosition: BABYLON.Vector3;
}

const AXIS_CONFIG = {
  length: 0.8,
  thickness: 0.04,
  arrow: {
    height: 0.15,
    width: 0.08,
  },
  label: {
    size: 0.25,
    offset: 0.3,
    fontSize: 96,
    textureSize: 128,
  },
  camera: {
    alpha: Math.PI / 4,
    beta: Math.PI / 3,
    radius: 3,
  },
  lights: [
    { name: 'helperLight1', direction: new BABYLON.Vector3(1, 1, 0), intensity: 0.7 },
    { name: 'helperLight2', direction: new BABYLON.Vector3(-1, -1, 0), intensity: 0.5 },
  ],
} as const;

const AXES: AxisDefinition[] = [
  {
    name: 'x',
    diffuseColor: new BABYLON.Color3(0.9, 0.2, 0.2),
    emissiveColor: new BABYLON.Color3(0.6, 0, 0),
    labelColor: new BABYLON.Color3(1, 0.2, 0.2),
    rotation: new BABYLON.Vector3(Math.PI / 2, 0, 0),
    positionOffset: new BABYLON.Vector3(0, 0, 1),
    labelPosition: new BABYLON.Vector3(0, 0, AXIS_CONFIG.length + AXIS_CONFIG.label.offset),
  },
  {
    name: 'y',
    diffuseColor: new BABYLON.Color3(0.2, 0.9, 0.2),
    emissiveColor: new BABYLON.Color3(0, 0.6, 0),
    labelColor: new BABYLON.Color3(0.2, 1, 0.2),
    rotation: new BABYLON.Vector3(0, 0, 0),
    positionOffset: new BABYLON.Vector3(0, 1, 0),
    labelPosition: new BABYLON.Vector3(0, AXIS_CONFIG.length + AXIS_CONFIG.label.offset, 0),
  },
  {
    name: 'z',
    diffuseColor: new BABYLON.Color3(0.2, 0.2, 0.9),
    emissiveColor: new BABYLON.Color3(0, 0, 0.6),
    labelColor: new BABYLON.Color3(0.2, 0.2, 1),
    rotation: new BABYLON.Vector3(0, 0, -Math.PI / 2),
    positionOffset: new BABYLON.Vector3(1, 0, 0),
    labelPosition: new BABYLON.Vector3(AXIS_CONFIG.length + AXIS_CONFIG.label.offset, 0, 0),
  },
];

function createAxisMaterial(
  name: string,
  diffuseColor: BABYLON.Color3,
  emissiveColor: BABYLON.Color3,
  scene: BABYLON.Scene,
): BABYLON.StandardMaterial {
  const material = new BABYLON.StandardMaterial(`${name}Mat`, scene);
  material.diffuseColor = diffuseColor;
  material.emissiveColor = emissiveColor;
  material.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
  return material;
}

function createAxis(definition: AxisDefinition, scene: BABYLON.Scene): void {
  const { name, diffuseColor, emissiveColor, rotation, positionOffset } = definition;
  const { length, thickness, arrow } = AXIS_CONFIG;

  const material = createAxisMaterial(name, diffuseColor, emissiveColor, scene);

  // Create axis cylinder
  const axis = BABYLON.MeshBuilder.CreateCylinder(
    `${name}Axis`,
    { height: length, diameter: thickness },
    scene,
  );
  axis.rotation = rotation;
  axis.position = positionOffset.scale(length / 2);
  axis.material = material;

  // Create arrow cone
  const cone = BABYLON.MeshBuilder.CreateCylinder(
    `${name}Cone`,
    { height: arrow.height, diameterTop: 0, diameterBottom: arrow.width },
    scene,
  );
  cone.rotation = rotation;
  cone.position = positionOffset.scale(length + arrow.height / 2);
  cone.material = material;
}

function createTextLabel(
  text: string,
  color: BABYLON.Color3,
  position: BABYLON.Vector3,
  scene: BABYLON.Scene,
): void {
  const { textureSize, fontSize, size } = AXIS_CONFIG.label;

  const texture = new BABYLON.DynamicTexture(
    `${text}Texture`,
    { width: textureSize, height: textureSize },
    scene,
    false,
  );
  texture.hasAlpha = true;

  const ctx = texture.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, textureSize, textureSize);
  ctx.fillStyle = color.toHexString();
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, textureSize / 2, textureSize / 2);
  texture.update();

  const plane = BABYLON.MeshBuilder.CreatePlane(`${text}Label`, { size }, scene);
  plane.position = position;
  plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

  const material = new BABYLON.StandardMaterial(`${text}LabelMat`, scene);
  material.diffuseTexture = texture;
  material.emissiveColor = color;
  material.opacityTexture = texture;
  material.backFaceCulling = false;
  plane.material = material;
}

function createLights(scene: BABYLON.Scene): void {
  for (const config of AXIS_CONFIG.lights) {
    const light = new BABYLON.HemisphericLight(config.name, config.direction, scene);
    light.intensity = config.intensity;
  }
}

/**
 * Sets up a Babylon.js scene for rendering an axis helper widget.
 * Creates a separate engine and scene with X, Y, Z axes, labels, and lights.
 *
 * @param canvas - The HTML canvas element to render on
 * @param getMainCamera - Function to get the main camera for synchronization
 * @returns Setup object with engine, scene, camera, sync function, and dispose function
 */
export function setupAxisHelper(
  canvas: HTMLCanvasElement,
  getMainCamera: () => { alpha: number; beta: number } | null,
): AxisHelperSetup {
  const engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true,
  });

  const helperScene = new BABYLON.Scene(engine);
  helperScene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

  const camera = new BABYLON.ArcRotateCamera(
    'axisHelperCamera',
    AXIS_CONFIG.camera.alpha,
    AXIS_CONFIG.camera.beta,
    AXIS_CONFIG.camera.radius,
    BABYLON.Vector3.Zero(),
    helperScene,
  );
  camera.attachControl(canvas, false);

  // Create all axes and labels
  for (const axis of AXES) {
    createAxis(axis, helperScene);
    createTextLabel(axis.name.toUpperCase(), axis.labelColor, axis.labelPosition, helperScene);
  }

  createLights(helperScene);

  const syncCamera = () => {
    const mainCamera = getMainCamera();
    if (mainCamera) {
      camera.alpha = mainCamera.alpha;
      camera.beta = mainCamera.beta;
    }
  };

  engine.runRenderLoop(() => {
    syncCamera();
    helperScene.render();
  });

  const handleResize = () => {
    engine.resize();
  };

  window.addEventListener('resize', handleResize);
  engine.resize();

  const dispose = () => {
    window.removeEventListener('resize', handleResize);
    helperScene.dispose();
    engine.dispose();
  };

  return { dispose };
}
