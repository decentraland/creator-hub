import type { Scene } from '@babylonjs/core';
import type { Emitter } from 'mitt';
import { MessageTransport } from '@dcl/mini-rpc';
import type { ComponentDefinition, CrdtMessageType, Entity, IEngine } from '@dcl/ecs';

import { SceneContext } from '../babylon/decentraland/SceneContext';
import { initRenderer } from '../babylon/setup/init';
import { BabylonRenderer } from '../renderer/babylon/BabylonRenderer';
import { connectReverseChannel } from '../renderer/reverse-channel';
import { RendererRegistry } from '../renderer/registry';
import type { IRenderer } from '../renderer/types';
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
  };
  dispose: undefined;
};

export type SdkContextComponents = EditorComponents & SdkComponents;

export type SdkContextValue = {
  engine: IEngine;
  components: SdkContextComponents;
  events: Emitter<SdkContextEvents>;
  dispose(): void;
  operations: ReturnType<typeof createOperations>;
  enumEntity: EnumEntity;

  /**
   * The renderer-agnostic boundary — the inspector's preferred handle on
   * whatever is drawing the scene (in-process Babylon today; an out-of-process
   * Unity/Bevy iframe via the registry). New code goes through here. See
   * `lib/renderer/types.ts`.
   */
  renderer: IRenderer;

  /**
   * @deprecated Raw Babylon handles for the few not-yet-migrated consumers
   * (GLTF introspection in Action/Animator inspectors, getDropPosition, the
   * addEngines debug hook). Only present for the in-process Babylon renderer;
   * an out-of-process renderer will not have these. Do not add new usages.
   */
  scene: Scene;
  /** @deprecated Use `renderer.*`. Migration-only; absent out-of-process. */
  sceneContext: SceneContext;
  /** @deprecated Use `renderer.gizmos`. Migration-only; absent out-of-process. */
  gizmos: Gizmos;
  /** @deprecated Use `renderer.camera`. Migration-only; absent out-of-process. */
  editorCamera: CameraManager;
};

/**
 * Build the in-process Babylon renderer as an {@link IRenderer}: the Babylon
 * engine, its SceneContext, the renderer-agnostic adapter, and the reverse
 * channel that turns viewport interactions into ECS edits. Disposing it tears
 * the whole thing down — so the registry can unmount and swap it cleanly.
 */
function createBabylonRenderer(
  canvas: HTMLCanvasElement,
  catalog: AssetPack[],
  preferences: InspectorPreferences,
) {
  const babylon = initRenderer(canvas, preferences);

  const ctx = new SceneContext(
    babylon.engine,
    babylon.scene,
    getHardcodedLoadableScene(
      'urn:decentraland:entity:bafkreid44xhavttoz4nznidmyj3rjnrgdza7v6l7kd46xdmleor5lmsxfm1',
      catalog,
    ),
  );
  ctx.rootNode.position.set(0, 0, 0);

  const adapter = new BabylonRenderer(ctx, babylon.editorCamera);

  // The inspector owns the response to viewport interactions (pick/gizmo) — the
  // renderer only emits them. This is the single viewport → ECS edit path.
  const disconnectReverseChannel = connectReverseChannel(ctx);

  const baseDispose = adapter.dispose.bind(adapter);
  adapter.dispose = () => {
    disconnectReverseChannel();
    baseDispose();
  };

  // `babylon` is the raw Babylon setup bundle still needed by the scene RPC
  // server (screenshots/camera). `ctx`/gizmos/camera back the deprecated
  // SdkContextValue fields the few not-yet-migrated consumers still read.
  return { adapter, babylon, ctx };
}

export async function createSdkContext(
  canvas: HTMLCanvasElement,
  catalog: AssetPack[],
  preferences: InspectorPreferences,
): Promise<SdkContextValue> {
  // Mount the renderer through the registry. Today this is the in-process
  // Babylon renderer; an out-of-process Unity/Bevy iframe is mounted the same
  // way (see RendererRegistry), and the rest of the inspector is unaffected.
  const { adapter, babylon, ctx } = createBabylonRenderer(canvas, catalog, preferences);
  const registry = new RendererRegistry();
  await registry.mount({ id: 'babylon', kind: 'in-process', create: () => adapter });

  // create inspector engine context and components
  const { engine, components, events, dispose: disposeEngine } = createInspectorEngine();

  const dispose = () => {
    registry.unmount();
    disposeEngine();
  };

  // register some globals for debugging
  Object.assign(globalThis, { inspectorEngine: engine });

  // if there is a parent, initialize rpc servers
  const config = getConfig();
  if (config.dataLayerRpcParentUrl) {
    const transport = new MessageTransport(window, window.parent, config.dataLayerRpcParentUrl);
    new SceneServer(transport, store, babylon);
    new SceneMetricsServer(transport, store);
  }

  return {
    engine,
    components,
    events,
    dispose,
    operations: createOperations(engine),
    enumEntity: createEnumEntityId(engine),
    renderer: registry.current,
    scene: babylon.scene,
    sceneContext: ctx,
    gizmos: ctx.gizmos,
    editorCamera: babylon.editorCamera,
  };
}
