/**
 * Same-origin BroadcastChannel bus between this super-user agent scene and the
 * inspector host page. `to:'page'` = agent→inspector (pick/gizmo results),
 * `to:'scene'` = inspector→agent (selection). BroadcastChannel is exposed to the
 * super-user sandbox by upstream bevy-explorer and spans the iframe/worker
 * boundary same-origin. Kept in sync with the inspector's pick-bridge /
 * selection-bridge message shapes.
 */

// BroadcastChannel isn't in the scene's TS lib — declare the minimal surface.
declare const BroadcastChannel: {
  new (name: string): {
    postMessage(msg: unknown): void;
    onmessage: ((ev: { data: unknown }) => void) | null;
  };
};

const EDITOR_BUS_CHANNEL = 'dcl-editor-bus';

/** agent → inspector. */
export type AgentToPage =
  | { kind: 'pick'; entity: number; shift: boolean; ctrl: boolean }
  | {
      kind: 'gizmoCommit';
      transforms: { entity: number; position?: { x: number; y: number; z: number } }[];
    }
  | { kind: 'gizmoCommitEnd' };

/** inspector → agent. Position is the entity's world position (the agent can't
 * read the inspected scene's Transform from its own engine, so the inspector
 * supplies where to place the gizmo). */
export type PageToScene = {
  kind: 'set-selection';
  entity: number | null;
  position: { x: number; y: number; z: number } | null;
};

interface Envelope {
  to: 'page' | 'scene';
  msg: unknown;
}

class Bus {
  #channel = new BroadcastChannel(EDITOR_BUS_CHANNEL);
  #sceneHandlers = new Set<(msg: PageToScene) => void>();

  constructor() {
    this.#channel.onmessage = (ev: { data: unknown }) => {
      const env = ev.data as Envelope;
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
