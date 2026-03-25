import * as BABYLON from '@babylonjs/core';

interface AxisHelperSetup {
  dispose: () => void;
  setHovered: (hovered: boolean) => void;
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

const HELPER_NAME_PREFIX = 'axisHelper';
const getHelperName = (suffix: string) => `${HELPER_NAME_PREFIX}_${suffix}`;

const AXIS_CONFIG = {
  length: 0.8,
  thickness: 0.08,
  arrow: {
    height: 0.15,
    width: 0.16,
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
  viewport: {
    pixelSize: 75, // compass size in pixels (square)
    pixelPadding: 8, // gap from right edge and from top edge, in pixels
  },
  lights: [
    { name: 'helperLight1', direction: new BABYLON.Vector3(1, 1, 0), intensity: 0.7 },
    { name: 'helperLight2', direction: new BABYLON.Vector3(-1, -1, 0), intensity: 0.5 },
  ],
} as const;

function computeViewport(engine: BABYLON.AbstractEngine): BABYLON.Viewport {
  const w = engine.getRenderWidth();
  const h = engine.getRenderHeight();
  const { pixelSize, pixelPadding } = AXIS_CONFIG.viewport;
  const sizeW = pixelSize / w;
  const sizeH = pixelSize / h;
  const padW = pixelPadding / w;
  const padH = pixelPadding / h;
  // Babylon.js Viewport: x/y is bottom-left corner, y=0 is canvas bottom, y=1 is top.
  // Position compass in top-right: right edge = 1 - padW, top edge = 1 - padH.
  return new BABYLON.Viewport(1 - sizeW - padW, 1 - sizeH - padH, sizeW, sizeH);
}

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
  const material = new BABYLON.StandardMaterial(getHelperName(`${name}Mat`), scene);
  material.diffuseColor = diffuseColor;
  material.emissiveColor = emissiveColor;
  material.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
  return material;
}

function createAxis(definition: AxisDefinition, scene: BABYLON.Scene): BABYLON.Mesh[] {
  const { name, diffuseColor, emissiveColor, rotation, positionOffset } = definition;
  const { length, thickness, arrow } = AXIS_CONFIG;
  const meshes: BABYLON.Mesh[] = [];

  const material = createAxisMaterial(name, diffuseColor, emissiveColor, scene);

  // Create axis cylinder
  const axis = BABYLON.MeshBuilder.CreateCylinder(
    getHelperName(`${name}Axis`),
    { height: length, diameter: thickness },
    scene,
  );
  axis.rotation = rotation;
  axis.position = positionOffset.scale(length / 2);
  axis.material = material;
  axis.isPickable = false;
  meshes.push(axis);

  // Create arrow cone
  const cone = BABYLON.MeshBuilder.CreateCylinder(
    getHelperName(`${name}Cone`),
    { height: arrow.height, diameterTop: 0, diameterBottom: arrow.width },
    scene,
  );
  cone.rotation = rotation;
  cone.position = positionOffset.scale(length + arrow.height / 2);
  cone.material = material;
  cone.isPickable = false;
  meshes.push(cone);

  return meshes;
}

function _createTextLabel(
  text: string,
  color: BABYLON.Color3,
  position: BABYLON.Vector3,
  scene: BABYLON.Scene,
): BABYLON.Mesh {
  const { textureSize, fontSize, size } = AXIS_CONFIG.label;

  const texture = new BABYLON.DynamicTexture(
    getHelperName(`${text}Texture`),
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

  const plane = BABYLON.MeshBuilder.CreatePlane(getHelperName(`${text}Label`), { size }, scene);
  plane.position = position;
  plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;

  const material = new BABYLON.StandardMaterial(getHelperName(`${text}LabelMat`), scene);
  material.diffuseTexture = texture;
  material.emissiveColor = color;
  material.opacityTexture = texture;
  material.backFaceCulling = false;
  plane.material = material;

  return plane;
}

function createBackground(scene: BABYLON.Scene): {
  disc: BABYLON.Mesh;
  setHovered: (hovered: boolean) => void;
} {
  const texSize = 128;
  const texture = new BABYLON.DynamicTexture(
    getHelperName('bgTexture'),
    { width: texSize, height: texSize },
    scene,
    false,
  );
  texture.hasAlpha = true;

  const ctx = texture.getContext() as CanvasRenderingContext2D;

  function drawGradient(hovered: boolean): void {
    ctx.clearRect(0, 0, texSize, texSize);
    const c = texSize / 2;
    const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
    if (hovered) {
      gradient.addColorStop(0, 'rgba(80, 80, 80, 0.55)');
      gradient.addColorStop(0.5, 'rgba(50, 50, 50, 0.35)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0.15)');
      gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.08)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, texSize, texSize);
    texture.update();
  }

  drawGradient(false);

  const disc = BABYLON.MeshBuilder.CreateDisc(
    getHelperName('bg'),
    { radius: 1.3, tessellation: 64 },
    scene,
  );
  disc.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
  disc.isPickable = false;
  disc.renderingGroupId = 0;

  const material = new BABYLON.StandardMaterial(getHelperName('bgMat'), scene);
  material.diffuseTexture = texture;
  material.useAlphaFromDiffuseTexture = true;
  material.disableLighting = true;
  material.backFaceCulling = false;
  disc.material = material;

  return { disc, setHovered: drawGradient };
}

function createLights(scene: BABYLON.Scene): BABYLON.Light[] {
  const lights: BABYLON.Light[] = [];
  for (const config of AXIS_CONFIG.lights) {
    const light = new BABYLON.HemisphericLight(config.name, config.direction, scene);
    light.intensity = config.intensity;
    lights.push(light);
  }
  return lights;
}

/**
 * Sets up an axis helper widget rendered in the top-right corner of the main canvas.
 * Uses a separate scene on the same engine, rendered manually after the main scene.
 *
 * @param scene - The main Babylon.js scene
 * @param getMainCamera - Function to get the main camera orientation for synchronization
 * @returns Setup object with dispose function
 */
export function setupAxisHelper(
  scene: BABYLON.Scene,
  getMainCamera: () => { alpha: number; beta: number } | null,
): AxisHelperSetup {
  const engine = scene.getEngine();

  const axisScene = new BABYLON.Scene(engine);
  axisScene.autoClear = false;
  axisScene.autoClearDepthAndStencil = false;
  axisScene.blockMaterialDirtyMechanism = true;

  // Create axis helper camera with viewport in top-right corner
  const axisCamera = new BABYLON.ArcRotateCamera(
    getHelperName('Camera'),
    AXIS_CONFIG.camera.alpha,
    AXIS_CONFIG.camera.beta,
    AXIS_CONFIG.camera.radius,
    BABYLON.Vector3.Zero(),
    axisScene,
  );
  axisCamera.viewport = computeViewport(engine);
  axisScene.activeCamera = axisCamera;

  // Keep equal pixel distance from right/top edges as the canvas resizes
  const resizeObserver = engine.onResizeObservable.add(() => {
    axisCamera.viewport = computeViewport(engine);
  });

  // Create all axes and shadow clones in the axis scene
  const meshes: BABYLON.Mesh[] = [];
  const bg = createBackground(axisScene);
  meshes.push(bg.disc);

  for (const axis of AXES) {
    const axisMeshes = createAxis(axis, axisScene);
    for (const mesh of axisMeshes) {
      mesh.renderingGroupId = 1;
    }
    meshes.push(...axisMeshes);
  }

  const lights = createLights(axisScene);

  // Render the axis scene after the main scene renders
  const renderObserver = scene.onAfterRenderObservable.add(() => {
    const cameraAngles = getMainCamera();
    if (cameraAngles) {
      axisCamera.alpha = cameraAngles.alpha;
      axisCamera.beta = cameraAngles.beta;
    }

    axisScene.render();
  });

  const dispose = () => {
    scene.onAfterRenderObservable.remove(renderObserver);
    engine.onResizeObservable.remove(resizeObserver);

    for (const mesh of meshes) {
      if (mesh.material) {
        mesh.material.dispose();
      }
      mesh.dispose();
    }

    for (const light of lights) {
      light.dispose();
    }

    axisCamera.dispose();
    axisScene.dispose();
  };

  return { dispose, setHovered: bg.setHovered };
}
