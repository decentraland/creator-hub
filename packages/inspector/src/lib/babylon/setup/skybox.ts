import * as BABYLON from '@babylonjs/core';

const SUN_DISTANCE = 450; // inside the 1000-unit skybox
const SUN_SIZE = 28;
const MIDDAY_SECONDS = 43200;

// Sun elevation: -1 = below horizon (midnight), 0 = horizon, 1 = zenith (noon)
function sunElevation(fixedTime: number): number {
  return -Math.cos((fixedTime / 86400) * Math.PI * 2);
}

// Sun position as a unit direction scaled to SUN_DISTANCE, parented to env rootMesh
function computeSunPosition(fixedTime: number): BABYLON.Vector3 {
  const angle = (fixedTime / 86400) * Math.PI * 2;
  return new BABYLON.Vector3(Math.sin(angle), -Math.cos(angle), 0)
    .normalize()
    .scaleInPlace(SUN_DISTANCE);
}

// Sky background color interpolated across the day cycle
function computeSkyColor(fixedTime: number): BABYLON.Color3 {
  const elev = sunElevation(fixedTime);

  const night = new BABYLON.Color3(0.01, 0.01, 0.05);
  const sunrise = new BABYLON.Color3(0.6, 0.25, 0.08);
  const day = new BABYLON.Color3(0.1, 0.5, 0.99);

  if (elev < -0.12) {
    return night.clone();
  } else if (elev < 0.15) {
    const t = (elev + 0.12) / 0.27;
    return BABYLON.Color3.Lerp(night, sunrise, Math.max(0, Math.min(1, t)));
  } else if (elev < 0.55) {
    const t = (elev - 0.15) / 0.4;
    return BABYLON.Color3.Lerp(sunrise, day, Math.max(0, Math.min(1, t)));
  }
  return day.clone();
}

export interface SkyboxSetup {
  updateSkybox: (fixedTime?: number) => void;
  dispose: () => void;
}

export function setupSkybox(
  scene: BABYLON.Scene,
  envHelper: BABYLON.EnvironmentHelper,
): SkyboxSetup {
  const sunMat = new BABYLON.StandardMaterial('editorSunMat', scene);
  sunMat.emissiveColor = new BABYLON.Color3(1, 0.97, 0.85);
  sunMat.disableLighting = true;
  sunMat.backFaceCulling = false;

  function makeSunDisc(name: string, radius: number): BABYLON.Mesh {
    const mesh = BABYLON.MeshBuilder.CreateDisc(name, { radius, tessellation: 32 }, scene);
    mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    mesh.parent = envHelper.rootMesh;
    mesh.isPickable = false;
    mesh.renderingGroupId = 1;
    mesh.material = sunMat;
    return mesh;
  }

  // Primary sun disc
  const sunMesh = makeSunDisc('editorSun', SUN_SIZE / 2);

  // Decorative companion — orbits the main sun as time changes
  const SUN2_ORBIT_RADIUS = 36;
  const sun2Mesh = makeSunDisc('editorSun2', (SUN_SIZE * 0.15 * 1.3) / 2);

  function updateSkybox(fixedTime?: number): void {
    const t = fixedTime ?? MIDDAY_SECONDS;
    const visible = sunElevation(t) > -0.05;

    const mainPos = computeSunPosition(t);
    sunMesh.position.copyFrom(mainPos);
    sunMesh.setEnabled(visible);

    // Build a coordinate frame in the plane perpendicular to the camera→sun direction
    // so the orbit appears as a circle around the main sun disc on screen.
    const orbitAngle = (t / 86400) * Math.PI * 2 * 3;
    const forward = mainPos.normalizeToNew();
    const worldUp = BABYLON.Vector3.Up();
    const right = BABYLON.Vector3.Cross(forward, worldUp).normalize();
    const up = BABYLON.Vector3.Cross(right, forward).normalize();
    sun2Mesh.position
      .copyFrom(mainPos)
      .addInPlace(right.scaleInPlace(Math.cos(orbitAngle) * SUN2_ORBIT_RADIUS))
      .addInPlace(up.scaleInPlace(Math.sin(orbitAngle) * SUN2_ORBIT_RADIUS));
    sun2Mesh.setEnabled(visible);

    const skyColor = computeSkyColor(t);
    if (envHelper.skyboxMaterial) {
      (envHelper.skyboxMaterial as BABYLON.BackgroundMaterial).primaryColor = skyColor;
    }
  }

  // Initialize at noon by default
  updateSkybox(MIDDAY_SECONDS);

  return {
    updateSkybox,
    dispose: () => {
      sunMat.dispose();
      sunMesh.dispose();
      sun2Mesh.dispose();
    },
  };
}
