import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

const SUN_DISTANCE = 450; // inside the 1000-unit skybox
const SUN_SIZE = 38;
const SUN2_ORBIT_RADIUS = 36;
const MIDDAY_SECONDS = 43200;
// cos(atan(SUN_SIZE/2 / SUN_DISTANCE)) — threshold for dot(dir, sunDir) to be inside the disc
const SUN_COS_RADIUS = Math.cos(Math.atan(SUN_SIZE / 2 / SUN_DISTANCE));
// cos for the companion disc (radius ~3.7 at ~450 units)
const SUN2_COS_RADIUS = Math.cos(Math.atan((SUN_SIZE * 0.15 * 1.3) / 2 / SUN_DISTANCE));

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
function _computeSkyColor(fixedTime: number): BABYLON.Color3 {
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

// ─── GenesisSky gradient data ────────────────────────────────────────────────
// Source: Decentraland unity-explorer StylizedSkybox/SkyboxRenderController
// t=0 / t=1 = midnight, t=0.25 = 6am, t=0.5 = noon, t=0.75 = 6pm

type ColorStop = [number, [number, number, number]];

const ZENIT_STOPS: ColorStop[] = [
  [0.0, [0.261, 0.199, 0.51]],
  [0.05, [0.259, 0.197, 0.507]],
  [0.2, [0.369, 0.399, 0.792]],
  [0.3, [0.52, 0.538, 0.896]],
  [0.5, [0.187, 0.601, 0.933]],
  [0.75, [0.49, 0.414, 0.887]],
  [1.0, [0.261, 0.199, 0.51]],
];

const HORIZON_STOPS: ColorStop[] = [
  [0.0, [0.291, 0.0, 0.44]],
  [0.2, [0.414, 0.372, 0.589]],
  [0.3, [1.0, 0.561, 0.524]],
  [0.38, [0.573, 0.792, 0.772]],
  [0.5, [0.676, 0.828, 0.962]],
  [0.75, [0.953, 0.499, 0.563]],
  [0.84, [0.256, 0.165, 0.457]],
  [1.0, [0.291, 0.0, 0.44]],
];

const NADIR_STOPS: ColorStop[] = [
  [0.0, [0.0, 0.0, 0.0]],
  [0.25, [0.858, 0.442, 0.433]],
  [0.5, [0.267, 0.795, 0.851]],
  [0.7, [0.887, 0.345, 0.953]],
  [1.0, [0.0, 0.0, 0.0]],
];

const SUN_COLOR_STOPS: ColorStop[] = [
  [0.0, [1.0, 0.64, 1.0]],
  [0.18, [0.35, 0.4, 0.75]],
  [0.3, [1.0, 0.65, 0.0]],
  [0.5, [1.0, 1.0, 0.9]],
  [0.75, [1.0, 0.8, 0.5]],
  [0.86, [0.4, 0.4, 1.0]],
  [1.0, [1.0, 0.64, 1.0]],
];

// Cloud color ramp (tinted by time-of-day, matching unity-explorer cloudsColorRamp)
const CLOUD_COLOR_STOPS: ColorStop[] = [
  [0.0, [0.15, 0.08, 0.28]],
  [0.25, [0.8, 0.5, 0.25]],
  [0.3, [1.0, 0.72, 0.5]],
  [0.5, [1.0, 1.0, 1.0]],
  [0.7, [0.85, 0.6, 0.4]],
  [0.75, [1.0, 0.5, 0.28]],
  [0.82, [0.28, 0.12, 0.3]],
  [1.0, [0.15, 0.08, 0.28]],
];

type FloatStop = [number, number];

// Cloud highlights intensity — peaks at sunrise/sunset (~4.0), dim at night
const CLOUD_HIGHLIGHT_STOPS: FloatStop[] = [
  [0.0, 0.35],
  [0.25, 1.0],
  [0.3, 3.5],
  [0.5, 1.0],
  [0.7, 0.9],
  [0.75, 3.0],
  [0.82, 0.4],
  [1.0, 0.35],
];

function sampleFloatGradient(t: number, stops: FloatStop[]): number {
  const v = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, v0] = stops[i];
    const [t1, v1] = stops[i + 1];
    if (v <= t1) {
      const f = (v - t0) / (t1 - t0);
      return v0 + (v1 - v0) * f;
    }
  }
  return stops[stops.length - 1][1];
}

function sampleGradient(t: number, stops: ColorStop[]): BABYLON.Color3 {
  const v = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, [r0, g0, b0]] = stops[i];
    const [t1, [r1, g1, b1]] = stops[i + 1];
    if (v <= t1) {
      const f = (v - t0) / (t1 - t0);
      return new BABYLON.Color3(r0 + (r1 - r0) * f, g0 + (g1 - g0) * f, b0 + (b1 - b0) * f);
    }
  }
  const [, [r, g, b]] = stops[stops.length - 1];
  return new BABYLON.Color3(r, g, b);
}

// ─── Real skybox shader ───────────────────────────────────────────────────────

const REAL_SKY_VERT = `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vDir;
void main(void) {
  vDir = position;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`;

const REAL_SKY_FRAG = `
precision highp float;
varying vec3 vDir;
uniform vec3 zenitColor;
uniform vec3 horizonColor;
uniform vec3 nadirColor;
uniform float iTime;
uniform vec3 cloudColor;
uniform float cloudHighlights;
uniform vec3 sunDir;
uniform vec3 sun2Dir;
uniform vec3 sunColor;
uniform float sunVisible;
uniform float sunCosRadius;
uniform float sun2CosRadius;

// ── Noise helpers ──────────────────────────────────────────────────────────
float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 7; i++) {
    v += noise2(p) * a;
    p = p * 2.1 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main(void) {
  vec3 d = normalize(vDir);
  float y = d.y;

  // 3-zone gradient: ocean -> horizon -> zenit
  vec3 sky;
  if (y >= 0.0) {
    sky = mix(horizonColor, zenitColor, smoothstep(0.0, 0.5, y));
  } else {
    vec3 oceanColor = mix(nadirColor, vec3(0.04, 0.22, 0.65), 0.75);
    sky = mix(oceanColor, horizonColor, smoothstep(-0.35, 0.0, y));
  }

  // ── Horizon blend — melts sky into ground colour ──
  float hBlur = exp(-abs(y) * 1.8) * 0.72;
  sky = mix(sky, horizonColor, hBlur);

  // ── Stars ──────────────────────────────────────────────────────────────
  if (y > 0.0) {
    float dayBrightness = dot(sky, vec3(0.299, 0.587, 0.114));
    float starFade = clamp((0.50 - dayBrightness) / 0.50, 0.0, 1.0);
    if (starFade > 0.0) {
      float scale = 160.0;
      vec2 starUV = vec2(atan(d.z, d.x), asin(d.y)) * scale;
      vec2 cell = floor(starUV);
      vec2 cellOff = fract(starUV) - 0.5;
      float r  = hash21(cell);
      float r2 = hash21(cell + vec2(31.7, 17.3));
      vec2 starPos = (vec2(r, r2) - 0.5) * 0.6;
      float dist = length(cellOff - starPos);
      float starBright = step(0.985, r) * smoothstep(0.10, 0.0, dist) * 4.62 * starFade;
      sky += vec3(starBright);
    }
  }

  // ── Sun + companion (rendered before clouds so clouds occlude them) ────
  if (sunVisible > 0.5) {
    vec3 sd = normalize(sunDir);
    float cosA = dot(d, sd);
    float disc   = smoothstep(sunCosRadius - 0.0003, sunCosRadius + 0.0002, cosA);
    float corona  = smoothstep(sunCosRadius - 0.012, sunCosRadius - 0.0003, cosA) * 0.28;
    float hGlow  = smoothstep(0.92, 1.0, cosA) * max(0.0, 1.0 - abs(y) * 4.0) * 0.32;
    vec3 white = vec3(1.0, 1.0, 1.0);
    sky = mix(sky, white * 1.15, clamp(disc + corona + hGlow, 0.0, 1.0));

    vec3 sd2 = normalize(sun2Dir);
    float cosA2 = dot(d, sd2);
    float disc2 = smoothstep(sun2CosRadius - 0.00003, sun2CosRadius + 0.00002, cosA2);
    sky = mix(sky, white, disc2);
  }

  // ── Clouds ─────────────────────────────────────────────────────────────
  if (y > 0.04) {
    float horizonFade = smoothstep(0.04, 0.28, y);
    float cy = max(y, 0.04);
    vec2 uv = vec2(d.x, d.z) / cy;
    float t1 = iTime * 0.004;
    vec2 uv1 = uv * 0.70 + vec2(cos(t1), sin(t1)) * 2.5;
    // Two-level domain warp: coarse warp shapes the mass, fine warp adds detail
    vec2 wCoarse = vec2(fbm(uv1 + vec2(1.7, 9.2)), fbm(uv1 + vec2(8.3, 2.8)));
    vec2 warped  = uv1 + 0.52 * wCoarse;
    vec2 wFine   = vec2(fbm(warped * 2.5 + vec2(3.1, 6.7)), fbm(warped * 2.5 + vec2(5.4, 1.3)));
    float cloud  = smoothstep(0.68, 0.76, fbm(warped + 0.26 * wFine));
    float clouds = cloud * horizonFade;
    if (clouds > 0.0) {
      sky = mix(sky, cloudColor * cloudHighlights, clouds * 0.85);
    }
  }

  gl_FragColor = vec4(sky, 1.0);
}`;

function createRealSkyMat(scene: BABYLON.Scene): BABYLON.ShaderMaterial {
  const mat = new BABYLON.ShaderMaterial(
    'realSkyboxMat',
    scene,
    { vertexSource: REAL_SKY_VERT, fragmentSource: REAL_SKY_FRAG },
    {
      attributes: ['position'],
      uniforms: [
        'worldViewProjection',
        'zenitColor',
        'horizonColor',
        'nadirColor',
        'iTime',
        'cloudColor',
        'cloudHighlights',
        'sunDir',
        'sun2Dir',
        'sunColor',
        'sunVisible',
        'sunCosRadius',
        'sun2CosRadius',
      ],
    },
  );
  mat.backFaceCulling = false;
  return mat;
}

function applyRealSkyUniforms(mat: BABYLON.ShaderMaterial, fixedTime: number): void {
  const t = fixedTime / 86400;
  mat.setColor3('zenitColor', sampleGradient(t, ZENIT_STOPS));
  mat.setColor3('horizonColor', sampleGradient(t, HORIZON_STOPS));
  mat.setColor3('nadirColor', sampleGradient(t, NADIR_STOPS));
  mat.setFloat('iTime', performance.now() / 1000.0);
  mat.setColor3('cloudColor', sampleGradient(t, CLOUD_COLOR_STOPS));
  mat.setFloat('cloudHighlights', sampleFloatGradient(t, CLOUD_HIGHLIGHT_STOPS));

  const mainPos = computeSunPosition(fixedTime);
  mat.setVector3('sunDir', mainPos.normalizeToNew());
  mat.setColor3('sunColor', sampleGradient(t, SUN_COLOR_STOPS));
  mat.setFloat('sunVisible', sunElevation(fixedTime) > -0.05 ? 1 : 0);
  mat.setFloat('sunCosRadius', SUN_COS_RADIUS);
  mat.setFloat('sun2CosRadius', SUN2_COS_RADIUS);

  const orbitAngle = (fixedTime / 86400) * Math.PI * 2 * 3;
  const forward = mainPos.normalizeToNew();
  const right = BABYLON.Vector3.Cross(forward, BABYLON.Vector3.Up()).normalize();
  const up = BABYLON.Vector3.Cross(right, forward).normalize();
  const sun2Pos = mainPos
    .clone()
    .addInPlace(right.scale(Math.cos(orbitAngle) * SUN2_ORBIT_RADIUS))
    .addInPlace(up.scale(Math.sin(orbitAngle) * SUN2_ORBIT_RADIUS));
  mat.setVector3('sun2Dir', sun2Pos.normalizeToNew());
}

// ─── Real ground shader (grid inside scene, red terrain outside) ──────────────

const REAL_GROUND_VERT = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
uniform mat4 world;
varying vec3 vWorldPos;
void main(void) {
  vec4 wp = world * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`;

const REAL_GROUND_FRAG = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
varying vec3 vWorldPos;
uniform float sceneMinX;
uniform float sceneMaxX;
uniform float sceneMinZ;
uniform float sceneMaxZ;
uniform vec3 uHorizonColor;
uniform float uShowGrid;

float hash21t(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
float noise2t(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21t(i), hash21t(i + vec2(1.0, 0.0)), f.x),
    mix(hash21t(i + vec2(0.0, 1.0)), hash21t(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
float fbmt(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += noise2t(p) * a;
    p = p * 2.1 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main(void) {
  float wx = vWorldPos.x;
  float wz = vWorldPos.z;
  bool inScene = (wx >= sceneMinX && wx < sceneMaxX && wz >= sceneMinZ && wz < sceneMaxZ);
  bool showGrid = inScene || uShowGrid > 0.5;

  vec3 color;
  if (showGrid) {
    vec2 gxz = vec2(wx, wz);
    vec2 f = abs(fract(gxz + 0.5) - 0.5);
    vec2 df = fwidth(gxz);
    float lineW = max(df.x, df.y);
    float minor = max(smoothstep(lineW, 0.0, f.x), smoothstep(lineW, 0.0, f.y));
    vec2 f4 = abs(fract(gxz * 0.25 + 0.5) - 0.5) * 4.0;
    float lineW4 = max(df.x, df.y);
    float major = max(smoothstep(lineW4, 0.0, f4.x), smoothstep(lineW4, 0.0, f4.y));
    float lineIntensity = clamp(max(minor, major * 1.4), 0.0, 1.0);
    // Outside scene parcels the grid is much more faint
    float gridStrength = inScene ? 1.0 : 0.25;
    vec3 mainCol = mix(vec3(0.212, 0.204, 0.239), uHorizonColor, 0.08);
    vec3 lineCol = mix(vec3(0.314, 0.306, 0.345), uHorizonColor, 0.10);
    color = mix(mainCol, lineCol, lineIntensity * gridStrength);
  } else {
    float large = fbmt(vec2(wx, wz) * 6.72);
    float detail = noise2t(vec2(wx, wz) * 36.72) * 0.28;
    float n = clamp(large + detail, 0.0, 1.0);
    // Terrain tinted by sky horizon colour
    vec3 terrainDark  = mix(vec3(0.44, 0.04, 0.08), uHorizonColor * 0.6, 0.35);
    vec3 terrainBase  = mix(vec3(0.52, 0.05, 0.10), uHorizonColor * 0.7, 0.30);
    vec3 terrainLight = mix(vec3(0.58, 0.07, 0.12), uHorizonColor * 0.8, 0.25);
    color = mix(terrainDark, mix(terrainBase, terrainLight, smoothstep(0.3, 0.8, n)), smoothstep(0.15, 0.55, n));
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(luma), color, 1.8) * 0.55;
  }
  // Fade ground edges toward sky horizon colour so the seam disappears
  float dist = length(vec2(wx, wz));
  float edgeFade = smoothstep(350.0, 490.0, dist);
  color = mix(color, uHorizonColor, edgeFade);
  gl_FragColor = vec4(color, 1.0);
}`;

function createRealGroundMat(scene: BABYLON.Scene): BABYLON.ShaderMaterial {
  const mat = new BABYLON.ShaderMaterial(
    'realGroundMat',
    scene,
    { vertexSource: REAL_GROUND_VERT, fragmentSource: REAL_GROUND_FRAG },
    {
      attributes: ['position'],
      uniforms: [
        'worldViewProjection',
        'world',
        'sceneMinX',
        'sceneMaxX',
        'sceneMinZ',
        'sceneMaxZ',
        'uHorizonColor',
        'uShowGrid',
      ],
    },
  );
  mat.backFaceCulling = false;
  mat.setFloat('sceneMinX', 0);
  mat.setFloat('sceneMaxX', 0);
  mat.setFloat('sceneMinZ', 0);
  mat.setFloat('sceneMaxZ', 0);
  mat.setColor3('uHorizonColor', new BABYLON.Color3(0.1, 0.5, 0.99));
  mat.setFloat('uShowGrid', 0);
  return mat;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SkyboxSetup {
  updateSkybox: (fixedTime?: number) => void;
  setRealSky: (enabled: boolean) => void;
  setRealGround: (enabled: boolean) => void;
  setFloorGrid: (enabled: boolean) => void;
  setSceneBounds: (minX: number, minZ: number, maxX: number, maxZ: number) => void;
  dispose: () => void;
}

export function setupSkybox(
  scene: BABYLON.Scene,
  envHelper: BABYLON.EnvironmentHelper,
  realSky = false,
  realGround = false,
  floorGrid = false,
): SkyboxSetup {
  const sunMat = new BABYLON.StandardMaterial('editorSunMat', scene);
  sunMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
  sunMat.disableLighting = true;
  sunMat.backFaceCulling = false;

  function makeSunDisc(name: string, radius: number): BABYLON.Mesh {
    const mesh = BABYLON.MeshBuilder.CreateDisc(name, { radius, tessellation: 32 }, scene);
    mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    mesh.parent = envHelper.rootMesh;
    mesh.isPickable = false;
    mesh.renderingGroupId = 0;
    mesh.material = sunMat;
    return mesh;
  }

  // Primary sun disc
  const sunMesh = makeSunDisc('editorSun', SUN_SIZE / 2);

  // Decorative companion — orbits the main sun as time changes
  const sun2Mesh = makeSunDisc('editorSun2', (SUN_SIZE * 0.15 * 1.3) / 2);

  // Sphere mesh for real sky — avoids the cube seam artifacts
  const realSkyMat = createRealSkyMat(scene);
  const realSkySphere = BABYLON.MeshBuilder.CreateSphere(
    'realSkySphere',
    { diameter: 950, segments: 48 },
    scene,
  );
  realSkySphere.parent = envHelper.rootMesh;
  realSkySphere.infiniteDistance = true;
  realSkySphere.isPickable = false;
  realSkySphere.renderingGroupId = 0;
  realSkySphere.material = realSkyMat;
  realSkySphere.setEnabled(false);

  const defaultSkyMat = envHelper.skybox?.material ?? null;
  const defaultGroundMat = envHelper.ground?.material ?? null;

  // Custom ground shader: grid inside scene bounds, red terrain outside
  const realGroundMat = createRealGroundMat(scene);

  let usingRealSky = false;
  let lastFixedTime = MIDDAY_SECONDS;

  function setRealSky(enabled: boolean): void {
    usingRealSky = enabled;
    if (enabled) {
      if (envHelper.skybox) envHelper.skybox.setEnabled(false);
      realSkySphere.setEnabled(true);
      sunMesh.setEnabled(false);
      sun2Mesh.setEnabled(false);
      applyRealSkyUniforms(realSkyMat, lastFixedTime);
    } else {
      realSkySphere.setEnabled(false);
      sunMesh.setEnabled(false);
      sun2Mesh.setEnabled(false);
      if (envHelper.skybox) {
        envHelper.skybox.setEnabled(true);
        if (defaultSkyMat) envHelper.skybox.material = defaultSkyMat;
      }
    }
  }

  function setRealGround(enabled: boolean): void {
    if (enabled) {
      if (envHelper.ground) envHelper.ground.material = realGroundMat;
    } else {
      if (envHelper.ground && defaultGroundMat) envHelper.ground.material = defaultGroundMat;
    }
  }

  function setFloorGrid(enabled: boolean): void {
    realGroundMat.setFloat('uShowGrid', enabled ? 1.0 : 0.0);
  }

  function setSceneBounds(minX: number, minZ: number, maxX: number, maxZ: number): void {
    realGroundMat.setFloat('sceneMinX', minX);
    realGroundMat.setFloat('sceneMaxX', maxX);
    realGroundMat.setFloat('sceneMinZ', minZ);
    realGroundMat.setFloat('sceneMaxZ', maxZ);
  }

  function updateSkybox(fixedTime?: number): void {
    const t = fixedTime ?? MIDDAY_SECONDS;
    lastFixedTime = t;

    // Keep ground edge fade in sync with sky horizon colour
    const horizCol = sampleGradient(t / 86400, HORIZON_STOPS);
    realGroundMat.setColor3('uHorizonColor', horizCol);

    if (usingRealSky) {
      const visible = sunElevation(t) > -0.05;
      const mainPos = computeSunPosition(t);
      sunMesh.position.copyFrom(mainPos);
      sunMesh.setEnabled(visible);

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

      applyRealSkyUniforms(realSkyMat, t);
    }
  }

  setRealSky(realSky);
  setRealGround(realGround);
  setFloorGrid(floorGrid);

  return {
    updateSkybox,
    setRealSky,
    setRealGround,
    setFloorGrid,
    setSceneBounds,
    dispose: () => {
      sunMat.dispose();
      sunMesh.dispose();
      sun2Mesh.dispose();
      realGroundMat.dispose();
      realSkyMat.dispose();
      realSkySphere.dispose();
    },
  };
}
