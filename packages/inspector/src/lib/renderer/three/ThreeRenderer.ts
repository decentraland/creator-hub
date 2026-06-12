import * as THREE from 'three';
import mitt from 'mitt';
import type { Emitter } from 'mitt';
import type { Entity } from '@dcl/ecs';
import { Vector3 as DclVector3 } from '@dcl/ecs-math';

import type {
  GroundPlane,
  IRenderer,
  RendererCamera,
  RendererDebug,
  RendererEvents,
  RendererGizmos,
  RendererMetrics,
  RendererViewport,
  SpawnPointController,
  Unsubscribe,
} from '../types';
import type { GizmoType } from '../../utils/gizmo';
import { ThreeSceneContext } from './ThreeSceneContext';

type AssetLoader = (src: string) => Promise<Uint8Array | null>;

/**
 * A minimal three.js {@link IRenderer} — the agnostic-contract proof.
 *
 * It implements the same boundary the Babylon renderer does, with a different
 * engine: its own ECS scene context (a CRDT subscriber), a free camera, and
 * raycast picking that emits `events.pick`. Editor concerns not yet built for
 * three (gizmos, metrics, spawn handles) are honest no-op stubs — they satisfy
 * the interface and report empty, so the inspector degrades gracefully rather
 * than assuming a Babylon scene graph.
 *
 * Scope: Transform + GltfContainer/MeshRenderer rendering, camera, pick. Enough
 * to prove the contract carries a second engine without Babylon assumptions.
 */
export class ThreeRenderer implements IRenderer {
  readonly events: Emitter<RendererEvents> = mitt<RendererEvents>();

  readonly context: ThreeSceneContext;
  readonly camera: RendererCamera;
  readonly gizmos: RendererGizmos;
  readonly metrics: RendererMetrics;
  readonly viewport: RendererViewport;
  readonly spawnPoints: SpawnPointController;
  readonly debug: RendererDebug;

  #renderer: THREE.WebGLRenderer;
  #camera: THREE.PerspectiveCamera;
  #raycaster = new THREE.Raycaster();
  #frameHandlers = new Set<() => void>();
  #speed = 4;
  #disposed = false;
  #onPointerDown: (e: PointerEvent) => void;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    loadAsset: AssetLoader,
  ) {
    this.context = new ThreeSceneContext(loadAsset);

    this.#renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.#renderer.setSize(canvas.clientWidth || 1, canvas.clientHeight || 1, false);

    this.#camera = new THREE.PerspectiveCamera(
      60,
      (canvas.clientWidth || 1) / (canvas.clientHeight || 1),
      0.1,
      1000,
    );
    this.#camera.position.set(8, 12, 24);
    this.#camera.lookAt(8, 0, 8);

    const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.context.scene.add(light);
    this.context.scene.add(new THREE.GridHelper(160, 10));

    this.camera = this.#createCamera();
    this.gizmos = this.#createGizmoStub();
    this.metrics = this.#createMetrics();
    this.viewport = this.#createViewport();
    this.spawnPoints = this.#createSpawnPointStub();
    this.debug = { isVisible: () => false, toggle: () => {} };

    // Click → raycast → pick. Emits the same reverse-channel event Babylon does.
    this.#onPointerDown = e => this.#handlePick(e);
    canvas.addEventListener('pointerdown', this.#onPointerDown);

    this.#renderer.setAnimationLoop(() => this.#onFrame());
  }

  #onFrame() {
    if (this.#disposed) return;
    this.#renderer.render(this.context.scene, this.#camera);
    for (const h of this.#frameHandlers) h();
  }

  #handlePick(event: PointerEvent) {
    if (event.button !== 0) return;
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.#raycaster.setFromCamera(ndc, this.#camera);
    const hits = this.#raycaster.intersectObjects(this.context.scene.children, true);
    const entity = hits.length ? this.context.getEntityFromObject(hits[0].object) : null;
    this.events.emit('pick', {
      target: entity !== null ? { kind: 'entity', entity } : { kind: 'empty' },
      modifiers: { multi: event.shiftKey || event.ctrlKey },
    });
  }

  #createCamera(): RendererCamera {
    return {
      getSpeed: () => this.#speed,
      reset: () => {
        this.#camera.position.set(8, 12, 24);
        this.#camera.lookAt(8, 0, 8);
      },
      focusOnEntity: entity => {
        const obj = this.context.getObject(entity);
        if (!obj) return;
        const pos = new THREE.Vector3();
        obj.getWorldPosition(pos);
        this.#camera.position.set(pos.x + 6, pos.y + 8, pos.z + 12);
        this.#camera.lookAt(pos);
      },
      setInvertRotation: () => {},
      zoom: step => {
        const dir = new THREE.Vector3();
        this.#camera.getWorldDirection(dir);
        this.#camera.position.addScaledVector(dir, step);
      },
      getPose: () => {
        const target = new THREE.Vector3();
        this.#camera.getWorldDirection(target);
        target.add(this.#camera.position);
        return {
          position: DclVector3.create(
            this.#camera.position.x,
            this.#camera.position.y,
            this.#camera.position.z,
          ),
          target: DclVector3.create(target.x, target.y, target.z),
          fov: THREE.MathUtils.degToRad(this.#camera.fov),
        };
      },
      setPose: (position, target) => {
        this.#camera.position.set(position.x, position.y, position.z);
        this.#camera.lookAt(target.x, target.y, target.z);
      },
      setControlEnabled: () => {},
    };
  }

  #createViewport(): RendererViewport {
    return {
      onFrame: (cb): Unsubscribe => {
        this.#frameHandlers.add(cb);
        return () => this.#frameHandlers.delete(cb);
      },
      getGroundPlanes: (): GroundPlane[] => [],
      getEntityWorldPositions: entities => {
        const out = new Map<Entity, ReturnType<typeof DclVector3.create>>();
        const v = new THREE.Vector3();
        for (const entity of entities) {
          const obj = this.context.getObject(entity);
          if (!obj || !obj.visible) continue;
          obj.getWorldPosition(v);
          out.set(entity, DclVector3.create(v.x, v.y, v.z));
        }
        return out;
      },
    };
  }

  #createMetrics(): RendererMetrics {
    return {
      getSceneMetrics: () => {
        let triangles = 0;
        let bodies = 0;
        this.context.scene.traverse(o => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            bodies++;
            const index = mesh.geometry?.getIndex();
            if (index) triangles += index.count / 3;
          }
        });
        return { triangles: Math.floor(triangles), bodies, materials: 0, textures: 0 };
      },
      getEntitiesOutsideLayout: () => [],
      onChange: () => () => {},
    };
  }

  // Editor manipulation not yet implemented for three — honest stubs.
  #createGizmoStub(): RendererGizmos {
    return {
      isEnabled: () => false,
      setEnabled: () => {},
      setMode: (_mode: GizmoType) => {},
      isWorldAligned: () => true,
      setWorldAligned: () => {},
      isWorldAlignmentDisabled: () => true,
      onChange: () => () => {},
    };
  }

  #createSpawnPointStub(): SpawnPointController {
    return {
      getSelectedIndex: () => null,
      getSelectedTarget: () => null,
      isHidden: () => false,
      select: () => {},
      selectCameraTarget: () => {},
      setVisible: () => {},
      onSelectionChange: () => () => {},
      onVisibilityChange: () => () => {},
      attachGizmo: () => {},
      detachGizmo: () => {},
      setPosition: () => {},
    };
  }

  setSelection(_entities: Entity[]): void {
    // Selection visuals not yet implemented for three (no-op proof stub).
  }

  async getPointerWorldPoint(): Promise<ReturnType<typeof DclVector3.create> | null> {
    // Ground-plane projection from the camera through the screen centre is
    // sufficient for the proof; full pointer tracking is future work.
    const dir = new THREE.Vector3();
    this.#camera.getWorldDirection(dir);
    if (Math.abs(dir.y) < 1e-6) return null;
    const t = -this.#camera.position.y / dir.y;
    if (t < 0) return null;
    const p = this.#camera.position.clone().addScaledVector(dir, t);
    return DclVector3.create(p.x, 0, p.z);
  }

  async getEntityAnimations(entity: Entity): Promise<string[]> {
    return this.context.getAnimationNames(entity);
  }

  setGridVisible(visible: boolean): void {
    const grid = this.context.scene.children.find(c => c instanceof THREE.GridHelper);
    if (grid) grid.visible = visible;
  }

  dispose(): void {
    this.#disposed = true;
    this.#renderer.setAnimationLoop(null);
    this.canvas.removeEventListener('pointerdown', this.#onPointerDown);
    this.context.dispose();
    this.#renderer.dispose();
    this.events.all.clear();
    this.#frameHandlers.clear();
  }
}
