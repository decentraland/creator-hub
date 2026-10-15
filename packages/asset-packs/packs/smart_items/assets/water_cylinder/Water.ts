import type { Entity } from '@dcl/sdk/ecs';
import {
  AudioSource,
  Billboard,
  BillboardMode,
  ColliderLayer,
  engine,
  Material,
  MaterialTransparencyMode,
  MeshRenderer,
  Transform,
  TriggerArea,
  triggerAreaEventsSystem,
  VisibilityComponent,
} from '@dcl/sdk/ecs';
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math';

// Both splash sheets are 3 x 3 grids played frames 0..8 (fishing-islands' playSplash).
const COLUMNS = 3;
const ROWS = 3;
const FRAMES = 9;
const POOL = 4;

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
  private subs: Record<string, Array<(arg?: Entity) => void>> = {};

  /**
   * Water that splashes when a player jumps or walks into it: a vertical burst of spray, a
   * ring spreading on the surface and a splash sound, at the spot where the player entered.
   * The water surface is a MeshRenderer child of this item; the trigger area tracks that
   * surface every frame, so scaling either this item or the surface resizes both.
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
    public depth: number = 2,
    public splashSize: number = 1,
    public sound: string = 'splash.mp3',
  ) {}

  /**
   * Start function - called when the script is initialized
   */
  start() {
    const area = engine.addEntity();
    Transform.create(area, { parent: this.entity });
    this.area = area;
    this.fitArea();
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
    this.fitArea();
    for (const s of [...this.vertical, ...this.ring]) {
      if (!s.playing) continue;
      if (s.delay > 0) {
        s.delay -= dt;
        if (s.delay <= 0) VisibilityComponent.getMutable(s.entity).visible = true;
        continue;
      }
      s.elapsed += dt;
      if (s.elapsed < 1 / s.fps) continue;
      s.elapsed = 0;
      s.frame++;
      if (s.frame >= FRAMES) {
        s.playing = false;
        VisibilityComponent.getMutable(s.entity).visible = false;
        continue;
      }
      MeshRenderer.setPlane(s.entity, uvs(s.frame));
    }
  }

  /**
   * Plays a splash in the middle of the water
   * @action
   */
  public splash() {
    const t = Transform.get(this.entity);
    this.splashAt(
      Vector3.create(t.position.x, t.position.y + this.surface().top * t.scale.y, t.position.z),
    );
  }

  /** Subscribe a reaction to this item's events ('enter' / 'exit'). */
  onEvent(name: string, fn: (arg?: Entity) => void) {
    (this.subs[name] ??= []).push(fn);
  }

  // The visible water: the MeshRenderer child of this item, or this item itself. Returns its
  // centre, footprint, top and height in this item's local space. A plane primitive stands
  // upright and is laid flat by its rotation, so its Y scale is the length; a cylinder is
  // 1 tall and centred on its origin.
  private surface() {
    let e: Entity = this.entity;
    for (const [child, t] of engine.getEntitiesWith(Transform, MeshRenderer)) {
      if (t.parent === this.entity) {
        e = child;
        break;
      }
    }
    const t = e === this.entity ? undefined : Transform.getOrNull(e);
    const s = t ? t.scale : Vector3.One();
    const p = t ? t.position : Vector3.Zero();
    const flat = MeshRenderer.getOrNull(e)?.mesh?.$case === 'plane';
    return flat
      ? { x: p.x, z: p.z, width: s.x, length: s.y, top: p.y, height: 0 }
      : { x: p.x, z: p.z, width: s.x, length: s.z, top: p.y + s.y / 2, height: s.y };
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
    const t = Transform.get(this.entity);
    const surface = t.position.y + this.surface().top * t.scale.y;
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

// UVs of one cell of the 3 x 3 sheet, counting cells left-to-right, top-to-bottom, in the
// same 8-value layout fishing-islands' spriteAnimator passes to MeshRenderer.setPlane.
function uvs(frame: number): number[] {
  const u = (frame % COLUMNS) / COLUMNS,
    v = Math.floor(frame / COLUMNS) / ROWS;
  const su = 1 / COLUMNS,
    sv = 1 / ROWS;
  return [u, 1 - (v + sv), u, 1 - v, u + su, 1 - v, u + su, 1 - (v + sv)];
}
