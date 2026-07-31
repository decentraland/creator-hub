/**
 * Scene-code hot-reload bridge (#1419).
 *
 * `sdk-commands start` watches the project and, on any file change, broadcasts a
 * `{ type: 'SCENE_UPDATE' }` message over a WebSocket at the realm ROOT (`/`) —
 * the same signal the preview client uses to hot-reload. The Bevy editor loads
 * the scene from that realm, so we connect a plain WS to it and surface each
 * `SCENE_UPDATE` as a callback. The caller reloads the editor scene (via the
 * Stop/reset path) so a code edit shows up without a manual Stop→Play.
 *
 * IMPORTANT: in `--data-layer` mode (what the editor uses) the message carries NO
 * filename, and it ALSO fires when the data-layer rewrites `main.crdt` in response
 * to the inspector's OWN edits (a gizmo drag, etc.). So the caller MUST suppress
 * reloads that follow a local edit — otherwise every edit reloads the scene (the
 * #1391 regression). This bridge is pure transport; the suppression + debounce +
 * reset live in the caller (see register.ts).
 *
 * The WS lives at the realm root, NOT the `/data-layer` path the inspector's CRDT
 * uses — same host+port, different route.
 */

/** Minimal WebSocket surface (the real global, or a test fake). */
interface Socket {
  addEventListener(type: 'message', cb: (ev: { data: unknown }) => void): void;
  addEventListener(type: 'close' | 'error', cb: () => void): void;
  close(): void;
}

export interface HotReloadBridgeOptions {
  /**
   * The realm base URL the editor loads from (e.g. `http://localhost:8004`). The
   * SCENE_UPDATE socket is this host at the root path (`ws://localhost:8004/`).
   * Null/undefined → the bridge is inert (no realm, e.g. the conformance path).
   */
  realmUrl: string | null | undefined;
  /** Called when the server reports a scene file changed (a `SCENE_UPDATE`). */
  onSceneUpdate: () => void;
  /**
   * Test seam: open a socket for `wsUrl`. Defaults to a real `WebSocket`. The
   * fake lets tests drive `message`/`close` without a server.
   */
  connect?: (wsUrl: string) => Socket;
}

/** Derive the SCENE_UPDATE ws URL (realm root) from the realm's http(s) URL. */
export function sceneUpdateWsUrl(realmUrl: string): string {
  // http://host:port(/...) → ws://host:port/ ; https → wss. Drop any path.
  const u = new URL(realmUrl);
  const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProto}//${u.host}/`;
}

/** Is this a `SCENE_UPDATE` notification? The server sends a raw `UPDATE` string
 * first (ignored) then a JSON `{ type: 'SCENE_UPDATE', ... }`. */
function isSceneUpdate(data: unknown): boolean {
  if (typeof data !== 'string') return false;
  try {
    const msg = JSON.parse(data) as { type?: unknown };
    return msg.type === 'SCENE_UPDATE';
  } catch {
    return false; // the bare 'UPDATE' sentinel or a binary frame
  }
}

export function createHotReloadBridge(options: HotReloadBridgeOptions): () => void {
  const { realmUrl, onSceneUpdate } = options;
  if (!realmUrl) return () => {};

  const wsUrl = sceneUpdateWsUrl(realmUrl);
  const connect = options.connect ?? ((url: string) => new WebSocket(url) as unknown as Socket);

  let socket: Socket | null = null;
  let disposed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const open = () => {
    if (disposed) return;
    let s: Socket;
    try {
      s = connect(wsUrl);
    } catch {
      scheduleReconnect();
      return;
    }
    socket = s;
    s.addEventListener('message', (ev: { data: unknown }) => {
      if (isSceneUpdate(ev.data)) onSceneUpdate();
    });
    // The realm outlives the WS occasionally (server restart, transient drop) —
    // reconnect so hot-reload keeps working for the session.
    s.addEventListener('close', scheduleReconnect);
    s.addEventListener('error', () => {
      try {
        s.close();
      } catch {
        /* already closing */
      }
    });
  };

  const scheduleReconnect = () => {
    if (disposed || reconnectTimer !== null) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      open();
    }, 2000);
  };

  open();

  return () => {
    disposed = true;
    if (reconnectTimer !== null) clearTimeout(reconnectTimer);
    try {
      socket?.close();
    } catch {
      /* ignore */
    }
    socket = null;
  };
}
