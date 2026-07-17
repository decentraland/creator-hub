import type { Emitter } from 'mitt';
import { MessageTransport } from '@dcl/mini-rpc';
import type { ComponentDefinition, CrdtMessageType, Entity, IEngine } from '@dcl/ecs';

import {
  buildRenderer,
  getSelectedRenderer,
  registerBuiltInRenderers,
} from '../renderer/controller';
import type { RendererId } from '../renderer/controller';
import { asBabylonInternals } from '../renderer/babylon/register';
import type { IRenderer } from '../renderer/types';
import type { InspectorPreferences } from '../logic/preferences/types';
import { SceneMetricsServer } from '../../lib/rpc/scene-metrics/server';
import { SceneServer } from '../rpc/scene/server';
import { createIframeScene, getSceneClient } from '../rpc/scene';
import { getConfig } from '../logic/config';
import type { AssetPack } from '../logic/catalog';
import { store } from '../../redux/store';
import { setFeatureFlags } from '../../redux/feature-flags';
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

  /** The id of the renderer active this session (a registered plugin id). */
  currentRendererId: RendererId;
};

export async function createSdkContext(
  canvas: HTMLCanvasElement,
  catalog: AssetPack[],
  preferences: InspectorPreferences,
): Promise<SdkContextValue> {
  // create inspector engine context and components
  const { engine, components, events, dispose: disposeEngine } = createInspectorEngine();

  // Build the renderer chosen for this session through the open plugin registry.
  // The choice comes from the `renderer` config param (a host app like creator-hub
  // drives it), falling back to localStorage then the default — see
  // getSelectedRenderer. Each renderer owns its own canvas in the Renderer container.
  const container = canvas.parentElement ?? document.body;
  registerBuiltInRenderers(catalog, preferences);
  const built = await buildRenderer(getSelectedRenderer(), canvas, container, catalog, preferences);

  const dispose = () => {
    built.dispose();
    disposeEngine();
  };

  // Register both engines so the connect-stream saga wires them to the CRDT
  // stream (inspector + the active renderer's engine).
  store.dispatch(addEngines({ inspector: engine, babylon: built.engine }));

  // register some globals for debugging
  Object.assign(globalThis, { inspectorEngine: engine });

  // If embedded, initialize the scene RPC server. It handles both renderer-
  // agnostic host controls (feature flags, tab/panel toggles, debug console) and
  // Babylon-only ones (screenshots, camera). The agnostic half runs under ANY
  // renderer — without it the host's feature flags never reach the inspector
  // (e.g. the SceneMinimap flag, so the minimap never shows under Bevy). The
  // Babylon internals are passed only when available; screenshot/camera control
  // is then unavailable for non-Babylon renderers (warn so the gap is visible).
  // The metrics server stays Babylon-only (scene-graph introspection).
  const config = getConfig();
  if (config.dataLayerRpcParentUrl) {
    const transport = new MessageTransport(window, window.parent, config.dataLayerRpcParentUrl);
    const babylonInternals = asBabylonInternals(built.internals);
    new SceneServer(transport, store, babylonInternals?.babylon);

    // Ensure the scene-RPC CLIENT (host-bound) exists. It's normally set up by the
    // parent-window data-layer path, but a renderer whose data-layer is a WS (Bevy)
    // never takes that path — yet still has a parent-window scene-RPC channel. This
    // is idempotent, so it's a no-op when the data-layer path already created it.
    createIframeScene(config.dataLayerRpcParentUrl);

    // Pull the host's feature flags now that our scene server is up. The host
    // also PUSHES flags (set_feature_flags), but that push can land before this
    // server exists — building the renderer above is async, so the server can
    // come up after the host's initial push and the flags would be lost (→ e.g.
    // no SceneMinimap). Pulling on ready closes that race; the push still covers
    // flags that change afterwards.
    void getSceneClient()
      ?.getFeatureFlags()
      .then(({ flags }) => store.dispatch(setFeatureFlags(flags)))
      .catch(() => {
        // The host may not implement get_feature_flags (older creator-hub); the
        // push path still delivers flags, so this is a non-fatal best-effort pull.
      });

    if (babylonInternals) {
      new SceneMetricsServer(transport, store);
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        '[renderer] Scene RPC screenshots/camera + metrics are only available with the Babylon ' +
          `renderer; skipped for "${built.id}". Feature flags + host controls still work.`,
      );
    }
  }

  return {
    engine,
    components,
    events,
    dispose,
    operations: createOperations(engine),
    enumEntity: createEnumEntityId(engine),
    renderer: built.renderer,
    currentRendererId: built.id,
  };
}
