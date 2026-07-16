/**
 * Public API for authoring and registering inspector renderers.
 *
 * The inspector is renderer-agnostic: it owns the scene as `@dcl/ecs` state and
 * talks to whatever draws it through {@link IRenderer}. To add a renderer
 * (Unity, Bevy, a custom WebGL/WebGPU engine, …) implement `IRenderer` and
 * {@link registerRenderer} it. The built-in Babylon renderer uses this exact API.
 *
 * See `docs/authoring-a-renderer.md` for the contract semantics, and
 * {@link createRendererConformanceSuite} (in `./conformance`) to verify an
 * implementation.
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

// Out-of-process (iframe/worker) renderer support. These are an *intentionally
// public* part of the author contract: a renderer that runs in an iframe
// (Unity, Bevy, …) calls `startRendererIframe` from inside its document and may
// reference the protocol/snapshot types. In-process renderer authors don't need
// them. (If this surface grows, consider a `@dcl/inspector/remote` subpath.)
export { startRendererIframe } from './remote/iframe-entry';
export { PROTOCOL_VERSION } from './remote/protocol';
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
