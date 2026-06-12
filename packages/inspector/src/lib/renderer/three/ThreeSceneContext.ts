import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ComponentDefinition, Entity, IEngine, TransformType } from '@dcl/ecs';
import { CrdtMessageType, Engine } from '@dcl/ecs';
import * as components from '@dcl/ecs/dist/components';

const ROOT = 0 as Entity;

type AssetLoader = (src: string) => Promise<Uint8Array | null>;

/**
 * The three.js counterpart of Babylon's `SceneContext`: it owns an `@dcl/ecs`
 * engine, subscribes to its changes, and projects entity/component state into a
 * three.js scene graph. This is the same architecture the Babylon renderer uses
 * — proving the boundary is engine-agnostic, not Babylon-shaped.
 *
 * Scope (minimal proof): Transform (position/rotation/scale/parent) and
 * GltfContainer/MeshRenderer. Other components are intentionally unhandled here.
 *
 * The engine is exposed so the inspector connects it to the CRDT stream exactly
 * as it does Babylon's (`addEngines({ inspector, babylon: ctx.engine })`).
 */
export class ThreeSceneContext {
  readonly scene = new THREE.Scene();
  readonly engine: IEngine = Engine({
    onChangeFunction: (entity, op, component) => this.#processEcsChange(entity, op, component),
  });

  readonly Transform = components.Transform(this.engine);
  readonly GltfContainer = components.GltfContainer(this.engine);
  readonly MeshRenderer = components.MeshRenderer(this.engine);

  #objects = new Map<Entity, THREE.Object3D>();
  #gltfLoader = new GLTFLoader();

  constructor(private readonly loadAsset: AssetLoader) {
    this.#getOrCreate(ROOT);
  }

  #processEcsChange(entity: Entity, op: CrdtMessageType, component?: ComponentDefinition<unknown>) {
    if (op === CrdtMessageType.DELETE_ENTITY) {
      this.#remove(entity);
      return;
    }
    if (!component) return;

    const obj = this.#getOrCreate(entity);
    switch (component.componentId) {
      case this.Transform.componentId:
        this.#applyTransform(entity, obj);
        break;
      case this.GltfContainer.componentId:
        void this.#applyGltf(entity, obj);
        break;
      case this.MeshRenderer.componentId:
        this.#applyMeshRenderer(entity, obj);
        break;
    }
  }

  #getOrCreate(entity: Entity): THREE.Object3D {
    let obj = this.#objects.get(entity);
    if (!obj) {
      obj = new THREE.Group();
      obj.name = `ecs-${entity}`;
      (obj as { entityId?: Entity }).entityId = entity;
      this.#objects.set(entity, obj);
      if (entity !== ROOT) this.scene.add(obj);
    }
    return obj;
  }

  #remove(entity: Entity) {
    const obj = this.#objects.get(entity);
    if (!obj) return;
    obj.removeFromParent();
    this.#objects.delete(entity);
  }

  #applyTransform(entity: Entity, obj: THREE.Object3D) {
    const t = this.Transform.getOrNull(entity) as TransformType | null;
    if (!t) {
      obj.position.set(0, 0, 0);
      obj.quaternion.set(0, 0, 0, 1);
      obj.scale.set(1, 1, 1);
      if (obj.parent !== this.scene) this.scene.add(obj);
      return;
    }
    obj.position.set(t.position.x, t.position.y, t.position.z);
    obj.quaternion.set(t.rotation.x, t.rotation.y, t.rotation.z, t.rotation.w);
    obj.scale.set(t.scale.x, t.scale.y, t.scale.z);

    // Reparent under the transform's parent (or the scene root).
    const parent = t.parent ? this.#getOrCreate(t.parent as Entity) : this.scene;
    if (obj.parent !== parent) parent.add(obj);
  }

  async #applyGltf(entity: Entity, obj: THREE.Object3D) {
    const value = this.GltfContainer.getOrNull(entity) as { src: string } | null;
    // Clear any previously-loaded gltf for this entity.
    const existing = obj.getObjectByName('gltf');
    if (existing) existing.removeFromParent();
    if (!value?.src) return;

    const bytes = await this.loadAsset(value.src);
    if (!bytes) return;
    // Entity may have been removed while loading.
    if (!this.#objects.has(entity)) return;

    const gltf = await this.#gltfLoader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      '',
    );
    gltf.scene.name = 'gltf';
    obj.add(gltf.scene);
  }

  #applyMeshRenderer(entity: Entity, obj: THREE.Object3D) {
    const existing = obj.getObjectByName('mesh');
    if (existing) existing.removeFromParent();
    const value = this.MeshRenderer.getOrNull(entity);
    if (!value) return;
    // Minimal proof: any MeshRenderer renders as a unit box.
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x888888 }),
    );
    mesh.name = 'mesh';
    obj.add(mesh);
  }

  getObject(entity: Entity): THREE.Object3D | null {
    return this.#objects.get(entity) ?? null;
  }

  getEntityFromObject(object: THREE.Object3D): Entity | null {
    let node: THREE.Object3D | null = object;
    while (node) {
      const id = (node as { entityId?: Entity }).entityId;
      if (id !== undefined) return id;
      node = node.parent;
    }
    return null;
  }

  allObjects(): Iterable<THREE.Object3D> {
    return this.#objects.values();
  }

  dispose() {
    this.#objects.clear();
    this.scene.clear();
  }
}
