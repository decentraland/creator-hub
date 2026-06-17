import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ComponentDefinition, Entity, IEngine, TransformType } from '@dcl/ecs';
import { CrdtMessageType, Engine } from '@dcl/ecs';
import * as components from '@dcl/ecs/dist/components';

import { createOperations } from '../../sdk/operations';
import { createEditorComponents } from '../../sdk/components';

const ROOT = 0 as Entity;

type AssetLoader = (src: string) => Promise<Uint8Array | null>;

/** Dispose a material and every texture it references. three.js frees no GPU
 * memory automatically — geometries, materials and textures must be disposed. */
function disposeMaterial(material: THREE.Material): void {
  for (const key of Object.keys(material)) {
    const value = (material as unknown as Record<string, unknown>)[key];
    if (value instanceof THREE.Texture) value.dispose();
  }
  material.dispose();
}

/** Recursively dispose an object's geometries, materials and textures, then
 * detach it from its parent. Safe to call on any Object3D subtree. */
function disposeObject(object: THREE.Object3D): void {
  object.traverse(node => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (material) {
      (Array.isArray(material) ? material : [material]).forEach(disposeMaterial);
    }
  });
  object.removeFromParent();
}

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

  // Engine-bound operations + editor components, so the reverse-channel handler
  // can apply picks/edits against this renderer's engine just like Babylon's.
  readonly operations = createOperations(this.engine);
  readonly editorComponents = createEditorComponents(this.engine);

  #objects = new Map<Entity, THREE.Object3D>();
  #animations = new Map<Entity, string[]>();
  // Monotonic per-entity token guarding against out-of-order GLTF loads: a
  // load only applies if its token is still the latest for that entity.
  #gltfLoadToken = new Map<Entity, number>();
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
    disposeObject(obj);
    this.#objects.delete(entity);
    this.#animations.delete(entity);
    this.#gltfLoadToken.delete(entity);
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

    // Bump the load token first — any in-flight load for this entity is now stale.
    const token = (this.#gltfLoadToken.get(entity) ?? 0) + 1;
    this.#gltfLoadToken.set(entity, token);

    // Clear any previously-loaded gltf for this entity (disposing its GPU memory).
    const existing = obj.getObjectByName('gltf');
    if (existing) disposeObject(existing);
    this.#animations.delete(entity);
    if (!value?.src) return;

    const bytes = await this.loadAsset(value.src);
    const gltf = bytes
      ? await this.#gltfLoader.parseAsync(
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
          '',
        )
      : null;

    // A newer load (or an entity removal) superseded this one while awaiting:
    // discard the now-stale result, freeing its GPU memory.
    if (!gltf) return;
    if (this.#gltfLoadToken.get(entity) !== token || !this.#objects.has(entity)) {
      disposeObject(gltf.scene);
      return;
    }

    gltf.scene.name = 'gltf';
    obj.add(gltf.scene);
    this.#animations.set(
      entity,
      gltf.animations.map(clip => clip.name),
    );
  }

  getAnimationNames(entity: Entity): string[] {
    return this.#animations.get(entity) ?? [];
  }

  #applyMeshRenderer(entity: Entity, obj: THREE.Object3D) {
    const existing = obj.getObjectByName('mesh');
    if (existing) disposeObject(existing);
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
    // Free all GPU resources before dropping references (scene.clear alone leaks).
    for (const obj of this.#objects.values()) disposeObject(obj);
    this.scene.traverse(node => {
      const mesh = node as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
    this.scene.clear();
    this.#objects.clear();
    this.#animations.clear();
    this.#gltfLoadToken.clear();
  }
}
