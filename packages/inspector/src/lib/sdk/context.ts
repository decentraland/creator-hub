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
  // shows live transform values. We intentionally do NOT call
  // operations.updateValue() here — that would mark the inspector engine's
  // Transform component as dirty, and subsequent engine.update() calls would
  // flush intermediate values to the data layer, creating unwanted undo entries.
  // Instead we emit events with skipEngineSync so hooks update the UI only.
  ctx.gizmos.setLiveDragCallback(entities => {
    for (const entity of entities) {
      const rendererTransform = ctx.Transform.getOrNull(entity.entityId);
      if (!rendererTransform) continue;
      events.emit('change', {
        entity: entity.entityId,
        operation: CrdtMessageType.PUT_COMPONENT,
        component: components.Transform,
        value: rendererTransform,
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
