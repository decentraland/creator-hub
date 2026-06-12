import type { IRenderer } from './types';
import { RemoteRenderer } from './remote/RemoteRenderer';
import { createIframeRendererTransport } from './remote/iframe-transport';
import type { IframeTransportOptions } from './remote/iframe-transport';

/**
 * How to bring up a renderer. The active renderer can be swapped at runtime by
 * disposing the current one and mounting the next from its descriptor.
 *
 *  - `in-process`: a JS renderer living in this context (Babylon today, Three.js
 *    later). The descriptor just carries a factory; nothing crosses a boundary.
 *  - `iframe`: an out-of-process renderer (Unity/Bevy) loaded in a child iframe.
 *    A {@link RemoteRenderer} over the iframe transport stands in for it locally,
 *    so the rest of the inspector sees a normal {@link IRenderer}.
 */
export type RendererDescriptor =
  | { id: string; kind: 'in-process'; create: () => IRenderer }
  | { id: string; kind: 'iframe'; iframe: IframeTransportOptions };

/**
 * Owns the currently-mounted renderer and swaps between descriptors.
 *
 * Every consumer reads `registry.current` (an {@link IRenderer}); whether that is
 * in-process Babylon or a RemoteRenderer proxying a Unity iframe is invisible to
 * them. Swapping disposes the old renderer (tearing down its iframe/transport if
 * any) before mounting the new one.
 */
export class RendererRegistry {
  #current: IRenderer | null = null;
  #currentId: string | null = null;

  get current(): IRenderer {
    if (!this.#current) throw new Error('No renderer is mounted');
    return this.#current;
  }

  get currentId(): string | null {
    return this.#currentId;
  }

  get isMounted(): boolean {
    return this.#current !== null;
  }

  /** Mount a renderer from its descriptor, disposing any current one first. */
  async mount(descriptor: RendererDescriptor): Promise<IRenderer> {
    this.unmount();

    let renderer: IRenderer;
    if (descriptor.kind === 'in-process') {
      renderer = descriptor.create();
    } else {
      const transport = await createIframeRendererTransport(descriptor.iframe);
      renderer = new RemoteRenderer(transport);
    }

    this.#current = renderer;
    this.#currentId = descriptor.id;
    return renderer;
  }

  /** Dispose and clear the current renderer (no-op if none). */
  unmount(): void {
    if (this.#current) {
      this.#current.dispose();
      this.#current = null;
      this.#currentId = null;
    }
  }
}
