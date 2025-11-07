import * as BABYLON from '@babylonjs/core';

export interface AxisHelperSetup {
  engine: BABYLON.Engine;
  scene: BABYLON.Scene;
  camera: BABYLON.ArcRotateCamera;
  syncCamera: () => void;
  dispose: () => void;
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
  // Create a dedicated engine for the axis helper
  const engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true,
  });

  // Create a small scene for the axis helper
  const helperScene = new BABYLON.Scene(engine);
  helperScene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

  // Create camera for the helper - positioned to view the axes from an angle
  const camera = new BABYLON.ArcRotateCamera(
    'axisHelperCamera',
    Math.PI / 4, // alpha
    Math.PI / 3, // beta
    3, // radius
    BABYLON.Vector3.Zero(),
    helperScene,
  );
  camera.attachControl(canvas, false); // Attach without preventing default

  // Create axes with thicker, more visible geometry
  const axisLength = 0.8;
  const axisThickness = 0.04;
  const arrowHeight = 0.15;
  const arrowWidth = 0.08;

  // X Axis - Red
  const xAxis = BABYLON.MeshBuilder.CreateCylinder(
    'xAxis',
    { height: axisLength, diameter: axisThickness },
    helperScene,
  );
  xAxis.rotation.z = -Math.PI / 2;
  xAxis.position.x = axisLength / 2;
  const xMaterial = new BABYLON.StandardMaterial('xMat', helperScene);
  xMaterial.diffuseColor = new BABYLON.Color3(0.9, 0.2, 0.2);
  xMaterial.emissiveColor = new BABYLON.Color3(0.6, 0, 0);
  xMaterial.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
  xAxis.material = xMaterial;

  // X Arrow
  const xCone = BABYLON.MeshBuilder.CreateCylinder(
    'xCone',
    { height: arrowHeight, diameterTop: 0, diameterBottom: arrowWidth },
    helperScene,
  );
  xCone.rotation.z = -Math.PI / 2;
  xCone.position.x = axisLength + arrowHeight / 2;
  xCone.material = xMaterial;

  // Y Axis - Green
  const yAxis = BABYLON.MeshBuilder.CreateCylinder(
    'yAxis',
    { height: axisLength, diameter: axisThickness },
    helperScene,
  );
  yAxis.position.y = axisLength / 2;
  const yMaterial = new BABYLON.StandardMaterial('yMat', helperScene);
  yMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.9, 0.2);
  yMaterial.emissiveColor = new BABYLON.Color3(0, 0.6, 0);
  yMaterial.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
  yAxis.material = yMaterial;

  // Y Arrow
  const yCone = BABYLON.MeshBuilder.CreateCylinder(
    'yCone',
    { height: arrowHeight, diameterTop: 0, diameterBottom: arrowWidth },
    helperScene,
  );
  yCone.position.y = axisLength + arrowHeight / 2;
  yCone.material = yMaterial;

  // Z Axis - Blue
  const zAxis = BABYLON.MeshBuilder.CreateCylinder(
    'zAxis',
    { height: axisLength, diameter: axisThickness },
    helperScene,
  );
  zAxis.rotation.x = Math.PI / 2;
  zAxis.position.z = axisLength / 2;
  const zMaterial = new BABYLON.StandardMaterial('zMat', helperScene);
  zMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.9);
  zMaterial.emissiveColor = new BABYLON.Color3(0, 0, 0.6);
  zMaterial.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
  zAxis.material = zMaterial;

  // Z Arrow
  const zCone = BABYLON.MeshBuilder.CreateCylinder(
    'zCone',
    { height: arrowHeight, diameterTop: 0, diameterBottom: arrowWidth },
    helperScene,
  );
  zCone.rotation.x = Math.PI / 2;
  zCone.position.z = axisLength + arrowHeight / 2;
  zCone.material = zMaterial;

  // Helper function to create text labels
  const createTextLabel = (text: string, color: BABYLON.Color3, position: BABYLON.Vector3) => {
    // Create dynamic texture for text
    const texture = new BABYLON.DynamicTexture(
      `${text}Texture`,
      { width: 128, height: 128 },
      helperScene,
      false,
    );
    texture.hasAlpha = true;

    const ctx = texture.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = color.toHexString();
    ctx.font = 'bold 96px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 64);
    texture.update();

    // Create plane for label
    const plane = BABYLON.MeshBuilder.CreatePlane(`${text}Label`, { size: 0.25 }, helperScene);
    plane.position = position;
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

    const material = new BABYLON.StandardMaterial(`${text}LabelMat`, helperScene);
    material.diffuseTexture = texture;
    material.emissiveColor = color;
    material.opacityTexture = texture;
    material.backFaceCulling = false;
    plane.material = material;

    return plane;
  };

  // Add text labels at the end of each axis
  createTextLabel(
    'X',
    new BABYLON.Color3(1, 0.2, 0.2),
    new BABYLON.Vector3(axisLength + 0.3, 0, 0),
  );
  createTextLabel(
    'Y',
    new BABYLON.Color3(0.2, 1, 0.2),
    new BABYLON.Vector3(0, axisLength + 0.3, 0),
  );
  createTextLabel(
    'Z',
    new BABYLON.Color3(0.2, 0.2, 1),
    new BABYLON.Vector3(0, 0, axisLength + 0.3),
  );

  // Add lights for better 3D appearance
  const light1 = new BABYLON.HemisphericLight(
    'helperLight1',
    new BABYLON.Vector3(1, 1, 0),
    helperScene,
  );
  light1.intensity = 0.7;

  const light2 = new BABYLON.HemisphericLight(
    'helperLight2',
    new BABYLON.Vector3(-1, -1, 0),
    helperScene,
  );
  light2.intensity = 0.5;

  // Sync camera rotation with main scene camera
  const syncCamera = () => {
    const mainCamera = getMainCamera();
    if (mainCamera) {
      camera.alpha = mainCamera.alpha;
      camera.beta = mainCamera.beta;
    }
  };

  // Register render loop
  engine.runRenderLoop(() => {
    syncCamera();
    helperScene.render();
  });

  // Handle resize
  const handleResize = () => {
    engine.resize();
  };
  window.addEventListener('resize', handleResize);

  // Initial resize to ensure proper canvas size
  engine.resize();

  // Dispose function
  const dispose = () => {
    window.removeEventListener('resize', handleResize);
    helperScene.dispose();
    engine.dispose();
  };

  return {
    engine,
    scene: helperScene,
    camera,
    syncCamera,
    dispose,
  };
}
