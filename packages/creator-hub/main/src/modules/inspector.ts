import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { app, type WebContents } from 'electron';
import { createServer } from 'http-server';
import log from 'electron-log';

import type { Child } from './bin';
import * as cache from './cache';
import { getAvailablePort } from './port';

// One debugger per preview (keyed by scene path), fanning its output out to every window
// that attached — the main window's inline console AND the detached console window (#1272)
// can both be subscribed at once, so this tracks a set of targets rather than a single one.
type DebuggerState = {
  preview: Child;
  listener: number;
  exitHandler: () => void;
  targets: Set<WebContents>;
};

const debuggers: Map<string, DebuggerState> = new Map();

function sendToTargets(state: DebuggerState, eventName: string, data: string) {
  for (const wc of state.targets) {
    if (!wc.isDestroyed()) wc.send(eventName, data);
  }
}

let inspectorServer: ReturnType<typeof createServer> | null = null;

export function killInspectorServer() {
  if (!inspectorServer) {
    return;
  }

  try {
    // Close the server and handle any errors
    inspectorServer.close(err => {
      if (err) {
        log.error('Error closing inspector server:', err);
      } else {
        log.info('Inspector server closed successfully');
      }
    });

    // Clear the reference
    inspectorServer = null;
  } catch (error) {
    log.error('Error killing inspector server:', error);
  }
}

export async function start() {
  if (inspectorServer) {
    killInspectorServer();
  }

  const port = await getAvailablePort();
  let inspectorPath = '';

  if (import.meta.env.DEV) {
    inspectorPath = resolve(app.getAppPath(), '..', '..', 'packages', 'inspector', 'public');
  } else {
    inspectorPath = resolve(app.getAppPath(), 'node_modules', '@dcl', 'inspector', 'public');
  }

  const origin = `localhost:${port}`;

  inspectorServer = createServer({
    root: inspectorPath,
    // Cross-origin isolation headers. The Bevy engine (served same-origin from the
    // inspector's public/bevy-engine) needs SharedArrayBuffer, which browsers only
    // grant to a cross-origin-isolated context. These mirror what the inspector's
    // dev build proxy sets (build.js) and what the engine's own service worker
    // targets — COEP is `credentialless` (NOT `require-corp`) so the engine's own
    // subresource loads aren't blocked. Harmless for the Babylon renderer, which
    // doesn't rely on them.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
    before: [serveBevyAgentAbout(inspectorPath, origin)],
  });
  inspectorServer.listen(port, () => {
    log.info(`Inspector running at http://localhost:${port}`);
  });

  return port;
}

// The Bevy editor-agent scene ships as a static realm at public/bevy-agent
// (exported by the inspector build's copy-bevy-agent). Its realm manifest
// (`bevy-agent/about`) bakes a `__ORIGIN__` placeholder into the scene's baseUrl,
// because the server's port is only known at launch. Rewrite that one file's
// placeholder to this server's origin on the fly; every other file is
// content-addressed and served as-is. The agent realm is reached at
// `/bevy-agent/bevy-agent/about` (the export nests `<realmName>/about` under the
// served `/bevy-agent/` dir).
const AGENT_ABOUT_PATH = '/bevy-agent/bevy-agent/about';

function serveBevyAgentAbout(inspectorPath: string, origin: string) {
  const aboutFile = resolve(inspectorPath, 'bevy-agent', 'bevy-agent', 'about');
  return (req: any, res: any) => {
    const url = (req.url || '').split('?')[0];
    if (url !== AGENT_ABOUT_PATH) {
      res.emit('next');
      return;
    }
    readFile(aboutFile, 'utf8')
      .then(contents => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(contents.replaceAll('__ORIGIN__', origin));
      })
      .catch(() => {
        // Not exported (e.g. Bevy never built) — fall through to the static handler,
        // which will 404 like any missing file.
        res.emit('next');
      });
  };
}

function getDebuggerChannel(path: string) {
  return `debugger://${path}`;
}

function teardownDebugger(state: DebuggerState) {
  state.preview.off(state.listener);
  state.preview.process.off('exit', state.exitHandler);
}

// Subscribe `sender` (the requesting window's webContents) to a preview's output. Multiple
// windows can attach to the same preview — the first attach wires the child listener, later
// ones just join the target set. Each caller gets the current backlog on attach.
export async function attachSceneDebugger(sender: WebContents, path: string): Promise<string> {
  const preview = cache.getPreview(path);

  if (!preview || !preview.child.alive()) {
    throw new Error(`Preview not found for path: ${path}`);
  }

  const eventName = getDebuggerChannel(path);
  const { child } = preview;

  // A stale entry for a previous run of this scene points at a dead child — replace it.
  const stale = debuggers.get(path);
  if (stale && stale.preview !== child) {
    teardownDebugger(stale);
    debuggers.delete(path);
  }

  let state = debuggers.get(path);
  if (!state) {
    const created: DebuggerState = {
      preview: child,
      listener: 0,
      exitHandler: () => {},
      targets: new Set<WebContents>(),
    };
    created.listener = child.on(
      /(.*)/i,
      (data?: string) => {
        if (data) sendToTargets(created, eventName, data);
      },
      { sanitize: false },
    );
    created.exitHandler = () => {
      sendToTargets(created, eventName, '\n--- Process exited ---\n');
      teardownDebugger(created);
      debuggers.delete(path);
    };
    child.process.once('exit', created.exitHandler);
    debuggers.set(path, created);
    state = created;
  }

  state.targets.add(sender);
  // Prune a window that goes away without an explicit detach (e.g. the detached console
  // window is closed), tearing the whole debugger down once nobody is left listening.
  sender.once('destroyed', () => detachSceneDebugger(sender, path));

  // Send this subscriber the logs so far (each window gets the backlog on join).
  const stdall = child.stdall({ sanitize: false });
  if (stdall.length > 0 && !sender.isDestroyed()) {
    sender.send(eventName, stdall);
  }

  return eventName;
}

export function detachSceneDebugger(sender: WebContents, path: string): void {
  const existing = debuggers.get(path);
  if (!existing) return;
  existing.targets.delete(sender);
  if (existing.targets.size === 0) {
    teardownDebugger(existing);
    debuggers.delete(path);
  }
}
