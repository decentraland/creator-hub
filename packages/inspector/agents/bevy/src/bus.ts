/**
 * Same-origin BroadcastChannel bus between this super-user agent scene and the
 * inspector host page. `to:'page'` = agent→inspector (pick/gizmo results),
 * `to:'scene'` = inspector→agent (selection). BroadcastChannel is exposed to the
 * super-user sandbox by upstream bevy-explorer and spans the iframe/worker
 * boundary same-origin.
 *
 * The message shapes are the SHARED protocol package
 * (`@dcl/inspector-bevy-protocol`, a file: dep) — the single source of truth
 * both sides depend on, so they can't drift. It's pure types + a const, so it
 * resolves + bundles fine in the sdk-commands build.
 */
import {
  EDITOR_BUS_CHANNEL,
  type AgentToPage,
  type PageToScene,
  type BusEnvelope,
} from '@dcl/inspector-bevy-protocol';

export type { AgentToPage, PageToScene };

// BroadcastChannel isn't in the scene's TS lib — declare the minimal surface.
declare const BroadcastChannel: {
  new (name: string): {
    postMessage(msg: unknown): void;
    onmessage: ((ev: { data: unknown }) => void) | null;
  };
};

class Bus {
  #channel = new BroadcastChannel(EDITOR_BUS_CHANNEL);
  #sceneHandlers = new Set<(msg: PageToScene) => void>();

  constructor() {
    this.#channel.onmessage = (ev: { data: unknown }) => {
      const env = ev.data as BusEnvelope;
      if (!env || env.to !== 'scene' || !env.msg) return;
      for (const h of this.#sceneHandlers) h(env.msg as PageToScene);
    };
  }

  postToPage(msg: AgentToPage): void {
    this.#channel.postMessage({ to: 'page', msg });
  }

  onSceneMessage(handler: (msg: PageToScene) => void): () => void {
    this.#sceneHandlers.add(handler);
    return () => this.#sceneHandlers.delete(handler);
  }
}

export const bus = new Bus();
