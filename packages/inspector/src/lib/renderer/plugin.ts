import type { IEngine } from '@dcl/ecs';

import { connectReverseChannel } from './reverse-channel';
import type { ReverseChannelTarget } from './reverse-channel';
import type { IRenderer } from './types';

/**
 * The open renderer-registration API.
 *
 * A renderer author implements {@link IRenderer} (see docs/authoring-a-renderer.md)
 * and registers it with {@link registerRenderer}. The inspector then offers it in
 * the renderer picker and mounts it like the built-in Babylon renderer, which is
 * itself registered through this same API, with no special casing.
 *
 * The dependency on a concrete engine (Babylon, Unity, Bevy, …) is entirely the
 * plugin's; the inspector core knows only this descriptor and {@link IRenderer}.
 */

/** What a plugin's `mount` receives to bring its renderer up. */
export interface RendererMountContext {
  /**
   * The inspector's shared viewport canvas. An in-process renderer may render
   * into it directly, or create its own canvas inside `container` and leave
   * this one hidden. An out-of-process renderer typically ignores it and uses
   * an iframe in `container`.
   */
  canvas: HTMLCanvasElement;
  /** The viewport container element — attach extra canvases/iframes here. */
  container: HTMLElement;
  /** Load asset bytes (GLBs, textures) by scene path, via the data layer. */
  loadAsset(src: string): Promise<Uint8Array | null>;
  /**
   * Wire a renderer's reverse channel (pick/gizmo events) into the inspector's
   * ECS operations. Call this with the renderer's scene-engine surface so
   * viewport interactions become scene edits. Returns a disconnect fn — invoke
   * it in your `dispose`.
   */
  connectReverseChannel(target: ReverseChannelTarget): () => void;
}

/** What a plugin's `mount` returns. */
export interface MountedRenderer {
  renderer: IRenderer;
  /**
   * The renderer's `@dcl/ecs` engine — the inspector connects it to the CRDT
   * stream so the scene state flows in. Every renderer drives its scene from
   * its own engine fed by CRDT (see the Babylon SceneContext).
   */
  engine: IEngine;
  /** Tear everything down (renderer, reverse channel, any canvas/iframe). */
  dispose(): void;
}

/** A registerable renderer. */
export interface RendererPlugin {
  /** Stable unique id (e.g. 'babylon', 'my-org.my-renderer'). */
  id: string;
  /** Human label shown in the renderer picker. */
  label: string;
  /** Bring the renderer up. Called once when this renderer becomes active. */
  mount(ctx: RendererMountContext): MountedRenderer | Promise<MountedRenderer>;
}

const registry = new Map<string, RendererPlugin>();

/**
 * Register a renderer. Idempotent: re-registering the same plugin object (e.g.
 * via HMR) is silent, but replacing a *different* plugin under an existing id
 * warns — a likely id collision between renderers.
 */
export function registerRenderer(plugin: RendererPlugin): void {
  const existing = registry.get(plugin.id);
  if (existing && existing !== plugin) {
    // eslint-disable-next-line no-console
    console.warn(
      `[renderer] registerRenderer: replacing a different renderer already registered as "${plugin.id}". ` +
        'Renderer ids must be unique (e.g. "my-org.my-renderer").',
    );
  }
  registry.set(plugin.id, plugin);
}

/** All registered renderers, in registration order. */
export function getRegisteredRenderers(): RendererPlugin[] {
  return [...registry.values()];
}

/** Look up a plugin by id, or undefined if not registered. */
export function getRendererPlugin(id: string): RendererPlugin | undefined {
  return registry.get(id);
}

/** Re-exported so a plugin's mount can satisfy the reverse-channel surface. */
export type { ReverseChannelTarget };
export { connectReverseChannel };
