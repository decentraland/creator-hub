import type { Scene } from '@babylonjs/core';
import type { Emitter } from 'mitt';
import { MessageTransport } from '@dcl/mini-rpc';
import { CrdtMessageType } from '@dcl/ecs';
import type { ComponentDefinition, Entity, IEngine } from '@dcl/ecs';

import { SceneContext } from '../babylon/decentraland/SceneContext';
import { initRenderer } from '../babylon/setup/init';
import type { Gizmos } from '../babylon/decentraland/GizmoManager';
import type { CameraManager } from '../babylon/decentraland/camera';
import type { InspectorPreferences } from '../logic/preferences/types';
import { SceneMetricsServer } from '../../lib/rpc/scene-metrics/server';
import { SceneServer } from '../rpc/scene/server';
import { getConfig } from '../logic/config';
import type { AssetPack } from '../logic/catalog';
import { store } from '../../redux/store';
import { createOperations } from './operations';
import { createInspectorEngine } from './inspector-engine';
import { getHardcodedLoadableScene } from './test-local-scene';
import type { EditorComponents, SdkComponents } from './components';
import type { EnumEntity } from './enum-entity';
import { createEnumEntityId } from './enum-entity';

export type SdkContextEvents = {
  change: {
    entity: Entity;
    operation: CrdtMessageType;
    component?: ComponentDefinition<any>;
    value?: any;
    /** When true, the value is for UI display only (e.g. live drag preview).
     *  Hooks should NOT sync it back to the engine or dispatch CRDT updates. */
    skipEngineSync?: boolean;
  };
  dispose: undefined;
};

export type SdkContextComponents = EditorComponents & SdkComponents;

export type SdkContextValue = {
  engine: IEngine;
  components: SdkContextComponents;
  scene: Scene;
  sceneContext: SceneContext;
  events: Emitter<SdkContextEvents>;
  dispose(): void;
  operations: ReturnType<typeof createOperations>;
  gizmos: Gizmos;
  editorCamera: CameraManager;
  enumEntity: EnumEntity;
};

export async function createSdkContext(
  canvas: HTMLCanvasElement,
  catalog: AssetPack[],
  preferences: InspectorPreferences,
): Promise<SdkContextValue> {
  const renderer = initRenderer(canvas, preferences);
  const { scene } = renderer;

  // create scene context
  const ctx = new SceneContext(
    renderer.engine,
    scene,
    getHardcodedLoadableScene(
      'urn:decentraland:entity:bafkreid44xhavttoz4nznidmyj3rjnrgdza7v6l7kd46xdmleor5lmsxfm1',
      catalog,
    ),
  );
  ctx.rootNode.position.set(0, 0, 0);

  // create inspector engine context and components
  const { engine, components, events, dispose } = createInspectorEngine();

  // register some globals for debugging
  Object.assign(globalThis, { inspectorEngine: engine });

  // if there is a parent, initialize rpc servers
  const config = getConfig();
  if (config.dataLayerRpcParentUrl) {
    const transport = new MessageTransport(window, window.parent, config.dataLayerRpcParentUrl);
    new SceneServer(transport, store, renderer);
    new SceneMetricsServer(transport, store);
  }

  const operations = createOperations(engine);

  // Wire live drag updates: during gizmo drag, emit change events so the UI
  // shows live transform values.  Neither the renderer ECS nor the inspector
  // engine are updated during drag — this prevents intermediate undo entries.
  // We read positions directly from the Babylon entity nodes and emit events
  // with skipEngineSync so hooks update the UI only.
  ctx.gizmos.setLiveDragCallback(entities => {
    for (const entity of entities) {
      // Read base transform for fields that don't change during drag (e.g. parent)
      const baseTransform = ctx.Transform.getOrNull(entity.entityId);
      if (!baseTransform) continue;
      // Construct live transform from Babylon entity's current node properties
      const liveValue = {
        ...baseTransform,
        position: { x: entity.position.x, y: entity.position.y, z: entity.position.z },
        rotation: entity.rotationQuaternion
          ? {
              x: entity.rotationQuaternion.x,
              y: entity.rotationQuaternion.y,
              z: entity.rotationQuaternion.z,
              w: entity.rotationQuaternion.w,
            }
          : baseTransform.rotation,
        scale: { x: entity.scaling.x, y: entity.scaling.y, z: entity.scaling.z },
      };
      events.emit('change', {
        entity: entity.entityId,
        operation: CrdtMessageType.PUT_COMPONENT,
        component: components.Transform,
        value: liveValue,
        skipEngineSync: true,
      });
    }
  });

  return {
    engine,
    components,
    events,
    scene,
    sceneContext: ctx,
    dispose,
    operations,
    gizmos: ctx.gizmos,
    editorCamera: renderer.editorCamera,
    enumEntity: createEnumEntityId(engine),
  };
}
