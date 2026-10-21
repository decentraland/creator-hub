import type { Entity } from '@dcl/sdk/ecs';
import {
  AudioSource,
  Billboard,
  BillboardMode,
  ColliderLayer,
  EasingFunction,
  engine,
  Material,
  MaterialTransparencyMode,
  MeshRenderer,
  TextureMovementType,
  Transform,
  TriggerArea,
  triggerAreaEventsSystem,
  Tween,
  TweenLoop,
  TweenSequence,
  VisibilityComponent,
} from '@dcl/sdk/ecs';
import { Color4, Quaternion, Vector2, Vector3 } from '@dcl/sdk/math';

// Both splash sheets are 3 x 3 grids played frames 0..8 (fishing-islands' playSplash).
const COLUMNS = 3;
const ROWS = 3;
const FRAMES = 9;
const POOL = 4;
// Sideways drift of each layer's ripples, top layer first: fishing-islands turns its layers
// in alternating directions, which reads as currents sliding past each other. Drifting the
// texture gives that motion while keeping every layer's edges aligned.
const LAYER_DRIFT = [
  { x: 1, y: 0.35 },
  { x: -0.55, y: 1 },
  { x: 0.8, y: -0.6 },
  { x: -1, y: -0.3 },
  { x: 0.25, y: -1 },
];
// Metres per repeat of the ripple texture: fishing-islands' 38 repeats across 512 m of sea.
const RIPPLE_SIZE = 512 / 38;
// Per-layer ripple size, within fishing-islands' 36..40-repeat range, so no two layers show the
// same pattern at the same spot (there, each layer's tiling tween starts at a random point).
const LAYER_RIPPLE = [38 / 38, 38 / 36, 38 / 40, 38 / 37, 38 / 39];
// fishing-islands adds its layers 0, 2, 4, 6 and 7 s apart, so their bobs never sync up
const LAYER_BOB_DELAY = [0, 2, 4, 6, 7];
// Texture repeats per second; at RIPPLE_SIZE that is ~0.1 m/s on the surface
const DRIFT_SPEED = 0.008;
const BOB = 0.05;

type Layer = {
  entity: Entity;
  x: number;
  y: number;
  z: number;
  flat: boolean;
  ripple: number;
  bob?: { level: Entity; delay: number };
};

type Splash = {
  entity: Entity;
  frame: number;
  elapsed: number;
  delay: number;
  fps: number;
  playing: boolean;
};

export class Water {
  private vertical: Splash[] = [];
  private ring: Splash[] = [];
  private inside = new Set<Entity>();
  private area: Entity | undefined;
  private layers: Layer[] = [];
  private scales: number[] = [];
  private sceneScale = { x: 1, y: 1, z: 1 };
  private elapsed = 0;
  private subs: Record<string, Array<(arg?: Entity) => void>> = {};

  /**
   * Water that splashes when a player jumps or walks into it: a vertical burst of spray, a
   * ring spreading on the surface and a splash sound, at the spot where the player entered.
   * The water is a stack of translucent MeshRenderer layers (children of this item), each
   * bobbing and rippling like fishing-islands' sea. The trigger area and the ripples follow
   * the top layer, so scaling this item or the layers resizes both.
   *
   * @event enter
   * @event exit
   * @param activatedBy - Who makes it splash: only this player, or any player.
   * @param depth - How far below the surface the area reaches, in metres before scaling. It never reaches past the bottom of a pool.
   * @param splashSize - Size of the splash effect, in metres.
   * @param sound - Name of an audio file inside this smart item's folder played on each splash. Leave empty for no sound.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public activatedBy: 'my player' | 'all players' = 'my player',
    public depth: number = 1,
    public splashSize: number = 1,
    public sound: string = 'splash.mp3',
  ) {}

  /**
   * Start function - called when the script is initialized
   */
  start() {
    this.animateLayers();
    const area = engine.addEntity();
    Transform.create(area, { parent: this.entity });
    this.area = area;
    this.refit();
    TriggerArea.setBox(area, ColliderLayer.CL_PLAYER);
    triggerAreaEventsSystem.onTriggerEnter(area, event =>
      this.entered(event.trigger?.entity, event.trigger?.position),
    );
    triggerAreaEventsSystem.onTriggerExit(area, event => this.left(event.trigger?.entity));

    for (let i = 0; i < POOL; i++) {
      this.vertical.push(this.sprite('splash2.png', true));
      this.ring.push(this.sprite('splash_horizontal.png', false));
    }
    if (this.sound) {
      AudioSource.createOrReplace(this.entity, {
        audioClipUrl: `${this.src}/${this.sound}`,
        playing: false,
      });
    }
  }

  /**
   * Update function - steps every playing splash sprite through its sheet
   * @param dt - Delta time since last frame (in seconds)
   */
  update(dt: number) {
    this.refit();
    this.startBobs(dt);
    for (const s of this.vertical) step(s, dt);
    for (const s of this.ring) step(s, dt);
  }

  /**
   * Plays a splash in the middle of the water
   * @action
   */
  public splash() {
    const w = this.surface();
    this.splashAt(this.toWorld(Vector3.create(w.x, w.top, w.z)));
  }

  /** Subscribe a reaction to this item's events ('enter' / 'exit'). */
  onEvent(name: string, fn: (arg?: Entity) => void) {
    (this.subs[name] ??= []).push(fn);
  }

  // The water's top layer, in this item's local space: centre, footprint, top and height. A
  // plane primitive is flat in its own XY and laid down by its rotation; a cylinder is 1 tall
  // and centred on its origin. The footprint is the box around the layer as it is turned, so
  // a layer turned 90 degrees swaps its width and length. Scale and rotation are read live
  // from the layer, position from where it sat before animateLayers() moved it under its bob
  // root.
  private surface() {
    let best = { x: 0, z: 0, width: 1, length: 1, top: 0, height: 0 };
    for (const l of this.layers) {
      const t = Transform.getOrNull(l.entity);
      const s = t?.scale ?? Vector3.One();
      const q = t?.rotation ?? Quaternion.Identity();
      const ax = Vector3.rotate(Vector3.create(s.x / 2, 0, 0), q);
      const ay = Vector3.rotate(Vector3.create(0, s.y / 2, 0), q);
      const az = Vector3.rotate(Vector3.create(0, 0, l.flat ? 0 : s.z / 2), q);
      const half = {
        x: Math.abs(ax.x) + Math.abs(ay.x) + Math.abs(az.x),
        y: Math.abs(ax.y) + Math.abs(ay.y) + Math.abs(az.y),
        z: Math.abs(ax.z) + Math.abs(ay.z) + Math.abs(az.z),
      };
      const w = {
        x: l.x,
        z: l.z,
        width: 2 * half.x,
        length: 2 * half.z,
        top: l.flat ? l.y : l.y + half.y,
        height: l.flat ? 0 : 2 * half.y,
      };
      if (this.layers[0] === l || w.top > best.top) best = w;
    }
    return best;
  }

  // A point in this item's local space, in scene coordinates: through the item's own Transform
  // and every parent above it, since the splash sprites live at the scene root.
  private toWorld(local: Vector3) {
    let p = local;
    let e: Entity | undefined = this.entity;
    for (let depth = 0; e !== undefined && e !== engine.RootEntity && depth < 32; depth++) {
      const t = Transform.getOrNull(e);
      if (!t) break;
      p = Vector3.add(
        Vector3.rotate(
          Vector3.create(p.x * t.scale.x, p.y * t.scale.y, p.z * t.scale.z),
          t.rotation,
        ),
        t.position,
      );
      e = t.parent;
    }
    return p;
  }

  // Per layer, after fishing-islands' addWaterLayer: a root bobbing every 5 s (0.05 m, half the
  // repo's, since the layers here are 1 m apart in total) started on the repo's stagger, and
  // the normal map drifting sideways. The bob starts are scheduled in update().
  private animateLayers() {
    for (const [child, t, renderer] of engine.getEntitiesWith(Transform, MeshRenderer)) {
      if (t.parent !== this.entity || !isWaterLayer(child, renderer.mesh?.$case)) continue;
      const flat = renderer.mesh?.$case === 'plane';
      this.layers.push({
        entity: child,
        x: t.position.x,
        y: t.position.y,
        z: t.position.z,
        flat,
        ripple: 1,
      });
    }
    this.layers.sort((a, b) => b.y - a.y);
    this.layers.forEach((layer, i) => {
      layer.ripple = LAYER_RIPPLE[i % LAYER_RIPPLE.length];
      const level = engine.addEntity();
      Transform.create(level, {
        parent: this.entity,
        position: Vector3.create(layer.x, layer.y, layer.z),
      });
      layer.bob = { level, delay: LAYER_BOB_DELAY[i % LAYER_BOB_DELAY.length] };
      const t = Transform.getMutable(layer.entity);
      t.parent = level;
      t.position = Vector3.Zero();
      const d = LAYER_DRIFT[i % LAYER_DRIFT.length];
      const len = Math.hypot(d.x, d.y);
      Tween.setTextureMoveContinuous(
        layer.entity,
        Vector2.create(d.x / len, d.y / len),
        DRIFT_SPEED,
        TextureMovementType.TMT_OFFSET,
      );
    });
  }

  // Start each layer's bob once its stagger delay has passed (fishing-islands' timers).
  private startBobs(dt: number) {
    this.elapsed += dt;
    for (const layer of this.layers) {
      if (!layer.bob || this.elapsed < layer.bob.delay) continue;
      const { level } = layer.bob;
      layer.bob = undefined;
      const at = Vector3.create(layer.x, layer.y, layer.z);
      const up = Vector3.create(layer.x, layer.y + BOB, layer.z);
      Tween.create(level, {
        duration: 5000,
        easingFunction: EasingFunction.EF_EASESINE,
        mode: Tween.Mode.Move({ start: at, end: up }),
      });
      TweenSequence.create(level, {
        sequence: [
          {
            duration: 5000,
            easingFunction: EasingFunction.EF_EASESINE,
            mode: Tween.Mode.Move({ start: up, end: at }),
          },
        ],
        loop: TweenLoop.TL_RESTART,
      });
    }
  }

  private fitRipples(layer: Layer) {
    const root = this.sceneScale;
    const s = Transform.get(layer.entity).scale;
    const size = RIPPLE_SIZE * layer.ripple;
    const q = Transform.get(layer.entity).rotation;
    const xAxis = Vector3.rotate(Vector3.Right(), q);
    const turned = Math.abs(xAxis.z) > Math.abs(xAxis.x);
    const [rx, rz] = turned ? [root.z, root.x] : [root.x, root.z];
    const across = (rx * s.x) / size;
    const along = (rz * (layer.flat ? s.y : s.z)) / size;
    const m = Material.getMutableOrNull(layer.entity);
    if (m?.material?.$case !== 'pbr') return;
    const tex = m.material.pbr.bumpTexture?.tex;
    if (tex?.$case !== 'texture') return;
    tex.texture.tiling = Vector2.create(across, along);
  }

  private measureSceneScale() {
    let x = 1;
    let y = 1;
    let z = 1;
    let e: Entity | undefined = this.entity;
    for (let depth = 0; e !== undefined && e !== engine.RootEntity && depth < 32; depth++) {
      const t = Transform.getOrNull(e);
      if (!t) break;
      x *= t.scale.x;
      y *= t.scale.y;
      z *= t.scale.z;
      e = t.parent;
    }
    this.sceneScale.x = x;
    this.sceneScale.y = y;
    this.sceneScale.z = z;
  }

  private refit() {
    this.measureSceneScale();
    let changed = false;
    for (let i = 0; i <= this.layers.length; i++) {
      const s = i === 0 ? this.sceneScale : Transform.getOrNull(this.layers[i - 1].entity)?.scale;
      if (!s) continue;
      const k = i * 3;
      if (this.scales[k] === s.x && this.scales[k + 1] === s.y && this.scales[k + 2] === s.z) {
        continue;
      }
      this.scales[k] = s.x;
      this.scales[k + 1] = s.y;
      this.scales[k + 2] = s.z;
      changed = true;
    }
    if (!changed) return;
    for (const layer of this.layers) this.fitRipples(layer);
    this.fitArea();
  }

  // Box from `depth` below the surface (never past the bottom of a pool) to 0.5 m above it.
  private fitArea() {
    if (this.area === undefined) return;
    const w = this.surface();
    const depth = w.height > 0 ? Math.min(this.depth, w.height) : this.depth;
    const t = Transform.getMutable(this.area);
    t.position = Vector3.create(w.x, w.top - depth / 2 + 0.25, w.z);
    t.scale = Vector3.create(w.width, depth + 0.5, w.length);
  }

  private entered(raw?: number, at?: { x: number; y: number; z: number }) {
    if (raw === undefined || raw === 0) return;
    const who = raw as Entity;
    if (this.activatedBy === 'my player' && who !== engine.PlayerEntity) return;
    if (this.inside.has(who)) return;
    this.inside.add(who);
    const w = this.surface();
    const surface = this.toWorld(Vector3.create(w.x, w.top, w.z)).y;
    const where = at ?? Transform.get(who).position;
    this.splashAt(Vector3.create(where.x, surface, where.z));
    for (const fn of this.subs.enter ?? []) fn(who);
  }

  private left(raw?: number) {
    if (raw === undefined || raw === 0) return;
    if (!this.inside.delete(raw as Entity)) return;
    for (const fn of this.subs.exit ?? []) fn(raw as Entity);
  }

  // fishing-islands: a 4 x 3 vertical burst at 24 fps, and a 4.5 x 4.5 ring on the surface
  // that starts 0.15 s later at 16 fps, both scaled by the splash size.
  private splashAt(pos: Vector3) {
    const k = this.splashSize;
    this.play(
      this.vertical,
      Vector3.create(pos.x, pos.y + 1.5 * k, pos.z),
      Vector3.create(4 * k, 3 * k, 1),
      undefined,
      0,
      24,
    );
    this.play(
      this.ring,
      Vector3.create(pos.x, pos.y + 0.05, pos.z),
      Vector3.create(4.5 * k, 4.5 * k, 1),
      Quaternion.fromEulerDegrees(90, Math.random() * 360, 0),
      0.15,
      16,
    );
    if (this.sound) AudioSource.playSound(this.entity, `${this.src}/${this.sound}`);
  }

  private play(
    pool: Splash[],
    position: Vector3,
    scale: Vector3,
    rotation: Quaternion | undefined,
    delay: number,
    fps: number,
  ) {
    const s = pool.shift();
    if (!s) return;
    pool.push(s);
    const t = Transform.getMutable(s.entity);
    t.position = position;
    t.scale = scale;
    if (rotation) t.rotation = rotation;
    Object.assign(s, { frame: 0, elapsed: 0, delay, fps, playing: true });
    MeshRenderer.setPlane(s.entity, uvs(0));
    VisibilityComponent.getMutable(s.entity).visible = delay <= 0;
  }

  private sprite(sheet: string, billboard: boolean): Splash {
    const entity = engine.addEntity();
    Transform.create(entity, { position: Vector3.create(0, -100, 0) });
    MeshRenderer.setPlane(entity, uvs(0));
    const texture = Material.Texture.Common({ src: `${this.src}/${sheet}` });
    Material.setPbrMaterial(entity, {
      texture,
      emissiveTexture: texture,
      emissiveColor: Color4.White(),
      emissiveIntensity: 1,
      transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
      metallic: 0,
      roughness: 1,
      castShadows: false,
    });
    if (billboard) Billboard.create(entity, { billboardMode: BillboardMode.BM_Y });
    VisibilityComponent.create(entity, { visible: false });
    return { entity, frame: 0, elapsed: 0, delay: 0, fps: 24, playing: false };
  }
}

// Only the water's own layers: primitive planes or cylinders with the water's normal-mapped PBR
// material. Any other mesh a creator parents under the water is left alone.
function isWaterLayer(entity: Entity, mesh: string | undefined) {
  if (mesh !== 'plane' && mesh !== 'cylinder') return false;
  const material = Material.getOrNull(entity)?.material;
  return material?.$case === 'pbr' && material.pbr.bumpTexture?.tex?.$case === 'texture';
}

// Steps a playing splash sprite through its sheet.
function step(s: Splash, dt: number) {
  if (!s.playing) return;
  if (s.delay > 0) {
    s.delay -= dt;
    if (s.delay <= 0) VisibilityComponent.getMutable(s.entity).visible = true;
    return;
  }
  s.elapsed += dt;
  if (s.elapsed < 1 / s.fps) return;
  s.elapsed = 0;
  s.frame++;
  if (s.frame >= FRAMES) {
    s.playing = false;
    VisibilityComponent.getMutable(s.entity).visible = false;
    return;
  }
  MeshRenderer.setPlane(s.entity, uvs(s.frame));
}

// UVs of one cell of the 3 x 3 sheet, counting cells left-to-right, top-to-bottom, in the
// same 8-value layout fishing-islands' spriteAnimator passes to MeshRenderer.setPlane.
function uvs(frame: number): number[] {
  const u = (frame % COLUMNS) / COLUMNS,
    v = Math.floor(frame / COLUMNS) / ROWS;
  const su = 1 / COLUMNS,
    sv = 1 / ROWS;
  return [u, 1 - (v + sv), u, 1 - v, u + su, 1 - v, u + su, 1 - (v + sv)];
}
