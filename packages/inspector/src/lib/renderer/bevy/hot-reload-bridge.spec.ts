import { createHotReloadBridge, sceneUpdateWsUrl } from './hot-reload-bridge';

/**
 * The hot-reload bridge (#1419) connects to the realm-root WS and fires
 * onSceneUpdate for each `{ type: 'SCENE_UPDATE' }` message sdk-commands
 * broadcasts on a file change. Driven with a fake socket.
 */
describe('sceneUpdateWsUrl', () => {
  it('should map an http realm URL to the ws root (dropping any path)', () => {
    expect(sceneUpdateWsUrl('http://localhost:8004')).toBe('ws://localhost:8004/');
    expect(sceneUpdateWsUrl('http://localhost:8004/some/path')).toBe('ws://localhost:8004/');
  });

  it('should map https to wss', () => {
    expect(sceneUpdateWsUrl('https://realm.example:443')).toBe('wss://realm.example/');
  });
});

describe('createHotReloadBridge', () => {
  type Listener = (ev: { data: unknown }) => void;
  let listeners: Record<string, Listener[]>;
  let closed: boolean;
  let connectedUrl: string | null;
  let updates: number;
  let disconnect: () => void;

  const fakeConnect = (url: string) => {
    connectedUrl = url;
    return {
      addEventListener: (type: string, cb: Listener) => {
        (listeners[type] ??= []).push(cb);
      },
      close: () => {
        closed = true;
      },
    } as never;
  };

  const emit = (type: string, data?: unknown) => {
    for (const cb of listeners[type] ?? []) cb({ data } as { data: unknown });
  };

  beforeEach(() => {
    listeners = {};
    closed = false;
    connectedUrl = null;
    updates = 0;
  });

  afterEach(() => disconnect?.());

  it('should connect to the realm-root ws and fire onSceneUpdate on a SCENE_UPDATE', () => {
    disconnect = createHotReloadBridge({
      realmUrl: 'http://localhost:8004',
      onSceneUpdate: () => updates++,
      connect: fakeConnect,
    });
    expect(connectedUrl).toBe('ws://localhost:8004/');

    emit('message', JSON.stringify({ type: 'SCENE_UPDATE', payload: { sceneId: 'b64-x' } }));
    expect(updates).toBe(1);
  });

  it('should ignore the bare UPDATE sentinel and non-update messages', () => {
    disconnect = createHotReloadBridge({
      realmUrl: 'http://localhost:8004',
      onSceneUpdate: () => updates++,
      connect: fakeConnect,
    });
    emit('message', 'UPDATE'); // raw sentinel the server sends first
    emit('message', JSON.stringify({ type: 'SOMETHING_ELSE' }));
    emit('message', new ArrayBuffer(4)); // a binary frame
    expect(updates).toBe(0);
  });

  it('should be inert (no connect) when the realm URL is null', () => {
    disconnect = createHotReloadBridge({
      realmUrl: null,
      onSceneUpdate: () => updates++,
      connect: fakeConnect,
    });
    expect(connectedUrl).toBeNull();
  });

  it('should close the socket on disconnect', () => {
    disconnect = createHotReloadBridge({
      realmUrl: 'http://localhost:8004',
      onSceneUpdate: () => updates++,
      connect: fakeConnect,
    });
    disconnect();
    expect(closed).toBe(true);
  });
});
