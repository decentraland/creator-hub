import type { Scene } from '@babylonjs/core';
import type { Emitter } from 'mitt';
import { MessageTransport } from '@dcl/mini-rpc';
import type { ComponentDefinition, CrdtMessageType, Entity, IEngine } from '@dcl/ecs';

import type { SceneContext } from '../babylon/decentraland/SceneContext';
import { buildRenderer, getSelectedRenderer } from '../renderer/controller';
import type { RendererId } from '../renderer/controller';
import type { IRenderer } from '../renderer/types';
import type { Gizmos } from '../babylon/decentraland/GizmoManager';
import type { CameraManager } from '../babylon/decentraland/camera';
import type { InspectorPreferences } from '../logic/preferences/types';
import { SceneMetricsServer } from '../../lib/rpc/scene-metrics/server';
import { SceneServer } from '../rpc/scene/server';
import { getConfig } from '../logic/config';
import type { AssetPack } from '../logic/catalog';
import { store } from '../../redux/store';
import { addEngines } from '../../redux/sdk';
import { createOperations } from './operations';
import { createInspectorEngine } from './inspector-engine';
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
   * whatever is drawing the scene. New code goes through here. See
   * `lib/renderer/types.ts`.
   */
  renderer: IRenderer;

  /** Which renderer is active this session ('babylon' | 'three'). */
  currentRendererId: RendererId;

  /**
   * @deprecated Raw Babylon handles for the few not-yet-migrated consumers
   * (GLTF introspection in Action/Animator inspectors, getDropPosition, the
   * addEngines debug hook). Present only when the Babylon renderer is active;
   * the not-yet-migrated inspectors are Babylon-only for now. Do not add new
   * usages — migrate to `renderer`.
   */
  scene: Scene;
  /** @deprecated Use `renderer.*`. Babylon-only. */
  sceneContext: SceneContext;
  /** @deprecated Use `renderer.gizmos`. Babylon-only. */
  gizmos: Gizmos;
  /** @deprecated Use `renderer.camera`. Babylon-only. */
  editorCamera: CameraManager;
};

export async function createSdkContext(
  canvas: HTMLCanvasElement,
  catalog: AssetPack[],
  preferences: InspectorPreferences,
): Promise<SdkContextValue> {
  // create inspector engine context and components
  const { engine, components, events, dispose: disposeEngine } = createInspectorEngine();

  // Build the renderer chosen for this session (persisted; switching it reloads
  // the inspector — see RendererPicker). Each renderer owns its own canvas in
  // the Renderer container.
  const container = canvas.parentElement ?? document.body;
  const built = buildRenderer(getSelectedRenderer(), canvas, container, catalog, preferences);

  const dispose = () => {
    built.dispose();
    disposeEngine();
  };

  // Register both engines so the connect-stream saga wires them to the CRDT
  // stream (inspector + the active renderer's engine).
  store.dispatch(addEngines({ inspector: engine, babylon: built.engine }));

  // register some globals for debugging
  Object.assign(globalThis, { inspectorEngine: engine });

  // if there is a parent, initialize rpc servers. The scene RPC server uses the
  // raw Babylon setup bundle (screenshots/camera); only wired for Babylon.
  const config = getConfig();
  if (config.dataLayerRpcParentUrl && built.babylon) {
    const transport = new MessageTransport(window, window.parent, config.dataLayerRpcParentUrl);
    new SceneServer(transport, store, built.babylon);
    new SceneMetricsServer(transport, store);
  }

  // The deprecated Babylon-only handles. When the three renderer is active these
  // are absent; the not-yet-migrated inspectors that read them are Babylon-only.
  const babylonOnly = {
    scene: built.babylon?.scene as Scene,
    sceneContext: built.sceneContext as SceneContext,
    gizmos: built.sceneContext?.gizmos as Gizmos,
    editorCamera: built.babylon?.editorCamera as CameraManager,
  };

  return {
    engine,
    components,
    events,
    dispose,
    operations: createOperations(engine),
    enumEntity: createEnumEntityId(engine),
    renderer: built.renderer,
    currentRendererId: built.id,
    ...babylonOnly,
  };
}
