/**
 * Public API for authoring and registering inspector renderers.
 *
 * The inspector is renderer-agnostic: it owns the scene as `@dcl/ecs` state and
 * talks to whatever draws it through {@link IRenderer}. To add a renderer
 * (Three.js, Unity, Bevy, …) implement `IRenderer` and {@link registerRenderer}
 * it. Built-in Babylon and Three.js use this exact API.
 *
 * See `docs/authoring-a-renderer.md` for the contract semantics and a worked
 * example, and {@link createRendererConformanceSuite} (in `./conformance`) to
 * verify an implementation.
 */

// The contract every renderer implements.
export type {
  IRenderer,
  RendererCamera,
  RendererGizmos,
  RendererMetrics,
  RendererViewport,
  SpawnPointController,
  SpawnPointTarget,
  RendererDebug,
  RendererAnimation,
  RendererEvents,
  EventSubscriber,
  PickTarget,
  PickModifiers,
  GroundPlane,
  Unsubscribe,
} from './types';

// Open registration API.
export {
  registerRenderer,
  getRegisteredRenderers,
  getRendererPlugin,
  connectReverseChannel,
} from './plugin';
export type { RendererPlugin, RendererMountContext, MountedRenderer } from './plugin';
export type { ReverseChannelTarget } from './reverse-channel';

// Conformance kit — verify an IRenderer implementation against the contract.
export { createRendererConformanceSuite } from './conformance';
export type {
  RendererConformanceOptions,
  RendererConformanceSetup,
  ConformanceHarness,
  ConformanceMatchers,
} from './conformance';

// Out-of-process (iframe/worker) renderer support: run inside the renderer
// document, bridge it to the inspector over postMessage RPC.
export { startRendererIframe } from './remote/iframe-entry';
export type {
  RendererIframeOptions,
  RendererIframeHandle,
  RemoteAssetLoader,
  RequestInspector,
} from './remote/iframe-entry';
export type {
  RendererSnapshot,
  RendererCommand,
  RendererOutbound,
  AssetProvider,
} from './remote/protocol';
