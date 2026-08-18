import path from 'path';
import { promisify } from 'util';
import { exec as execSync, spawn } from 'child_process';
import log from 'electron-log/main';
import { shell, utilityProcess } from 'electron';
import treeKill from 'tree-kill';
import { future, type IFuture } from 'fp-future';
import isRunning from 'is-running';
import { ErrorBase } from '/shared/types/error';
import { createCircularBuffer } from '/shared/circular-buffer';

import { CLIENT_NOT_INSTALLED_ERROR } from '/shared/types/client';
import { ClientError } from '/shared/types/client';
import { APP_UNPACKED_PATH, getBinPath, joinEnvPaths } from './path';
import { setupNodeBinary } from './setup-node';

// Registry to track all forked utility processes
const processes: Map<number, Child> = new Map();

// Get the current PATH value
function getPath() {
  return process.env.PATH || '';
}

// exec async
const exec = promisify(execSync);

const MAX_BUFFER_SIZE = 2048;

// Window for a child to exit gracefully before the kill escalates.
// On Windows, tree-kill already issues taskkill /F /T so a long graceful wait just delays
// NSIS-triggered update installs; 500 ms is sufficient for the process tree to collapse.
// The quit budget in index.ts is derived from this value and must stay above it.
export const FORCE_KILL_TIMEOUT_MS = process.platform === 'win32' ? 500 : 5000;

type Error = 'COMMAND_FAILED';

export class StreamError extends ErrorBase<Error> {
  constructor(
    type: Error,
    message: string,
    public stdout: Buffer,
    public stderr: Buffer,
  ) {
    super(type, message);
  }
}

export type StreamType = 'all' | 'stdout' | 'stderr';

export type EventOptions = {
  type?: StreamType;
  sanitize?: boolean;
};

/**
 * A Child is backed by an Electron utility process, or by a plain child process when the script
 * runs on a real Node binary instead. Both expose the surface below, so describing it
 * structurally saves narrowing a union at every call site.
 */
export type ChildProcessLike = {
  pid?: number;
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
  on(event: 'spawn' | 'exit', listener: (code: number | null) => void): unknown;
  once(event: 'exit', listener: () => void): unknown;
  off(event: 'exit', listener: () => void): unknown;
};

export type Child = {
  pkg: string;
  bin: string;
  args: string[];
  cwd: string;
  process: ChildProcessLike;
  on: (pattern: RegExp, handler: (data?: string) => void, opts?: EventOptions) => number;
  once: (pattern: RegExp, handler: (data?: string) => void, opts?: EventOptions) => number;
  off: (index: number) => void;
  wait: () => Promise<Buffer>;
  waitFor: (
    resolvePattern: RegExp,
    rejectPattern?: RegExp,
    opts?: { resolve?: StreamType; reject?: StreamType },
  ) => Promise<string>;
  kill: () => Promise<void>;
  alive: () => boolean;
  stdall: (opts?: EventOptions) => string[];
};

type Matcher = {
  pattern: RegExp;
  handler: (data: string) => void;
  enabled: boolean;
  opts?: EventOptions;
};

type RunOptions = {
  args?: string[]; // this are the arguments for the command
  cwd?: string; // this is the directory where the command should be executed, it defaults to the app path.
  env?: Record<string, string>; // this are the env vars that should be added to the command's env
  workspace?: string; // this is the path where the node_modules that should be used are located, it defaults to the app path.
  nodePath?: string | null; // a real Node binary to run the script on, instead of an Electron utility process
};

/**
 * Runs a javascript bin script in a child process, provides helpers to wait for the process to finish, listen for outputs, etc.
 * Uses an Electron utility process by default, or a real Node binary when `nodePath` is given.
 * @param pkg The npm package
 * @param bin The command to run
 * @param options Options for the child process (args, cwd, env, workspace, nodePath)
 * @returns Child
 */
export function run(pkg: string, bin: string, options: RunOptions = {}): Child {
  let isKilling = false;
  let alive = true;
  let killPromise: IFuture<void> | null = null;

  const promise = future<Awaited<ReturnType<Child['wait']>>>();
  const matchers: Matcher[] = [];

  const {
    workspace = APP_UNPACKED_PATH,
    cwd = APP_UNPACKED_PATH,
    args = [],
    env = {},
    nodePath,
  } = options;

  const binPath = getBinPath(pkg, bin, workspace);

  const stdout = createCircularBuffer<Uint8Array>(MAX_BUFFER_SIZE);
  const stderr = createCircularBuffer<Uint8Array>(MAX_BUFFER_SIZE);
  const stdall = createCircularBuffer<Uint8Array>(MAX_BUFFER_SIZE); // ordered buffer of stdout and stderr

  // Running on a real Node binary matters for anything that spawns children of its own, which
  // otherwise inherit Electron's module ABI — one that native dependencies ship no builds for.
  //
  // Putting its directory first on PATH is not just belt-and-braces: descendants launched
  // through `npx` run their bin via a `#!/usr/bin/env node` shebang, which resolves `node` from
  // PATH rather than from `process.execPath`. Without this, that lookup finds the Electron link
  // setup-node.ts installs and lands back on the wrong ABI even though we spawned real Node.
  const childEnv: Record<string, string | undefined> = {
    ...process.env,
    ...env,
    PATH: nodePath ? joinEnvPaths(path.dirname(nodePath), getPath()) : getPath(),
  };

  // node-gyp-build treats this variable as "we are on Electron" regardless of the runtime it is
  // actually loading into, and then looks for builds tagged for Electron's ABI. Inheriting it
  // into a real Node process would recreate the very failure the nodePath branch avoids.
  if (nodePath) {
    delete childEnv.ELECTRON_RUN_AS_NODE;
  }

  const ready = future<void>();

  const forked: ChildProcessLike = nodePath
    ? spawn(nodePath, [binPath, ...args], { cwd, stdio: 'pipe', env: childEnv })
    : utilityProcess.fork(binPath, [...args], { cwd, stdio: 'pipe', env: childEnv });

  // A plain child process reports a failed launch through 'error', and no 'exit' follows
  // it; settle everything here so wait() and kill() never block on a process that never
  // ran. Electron utility processes only emit 'spawn'/'exit'.
  if (nodePath) {
    (forked as ReturnType<typeof spawn>).on('error', error => {
      if (!alive) return;
      alive = false;
      log.error(`[UtilityProcess] Process "${name}" failed to start:`, error);
      if (isKilling) {
        promise.resolve(Buffer.concat(stdout.getAll()));
      } else {
        promise.reject(
          new StreamError(
            'COMMAND_FAILED',
            `Error: process "${name}" failed to start: ${error.message}`,
            Buffer.concat(stdout.getAll()),
            Buffer.concat(stderr.getAll()),
          ),
        );
      }
      cleanup();
      ready.resolve();
      killPromise?.resolve();
    });
  }

  const cleanup = () => {
    for (const matcher of matchers) {
      matcher.enabled = false;
    }
    forked.stdout?.removeAllListeners('data');
    forked.stderr?.removeAllListeners('data');
    stdout.clear();
    stderr.clear();
    stdall.clear();
    matchers.length = 0;
  };

  forked.stdout!.on('data', (data: Buffer) => {
    handleData(data, matchers, 'stdout');
    stdout.push(Uint8Array.from(data));
    stdall.push(Uint8Array.from(data));
  });

  forked.stderr!.on('data', (data: Buffer) => {
    handleData(data, matchers, 'stderr');
    stderr.push(Uint8Array.from(data));
    stdall.push(Uint8Array.from(data));
  });

  const name = `${bin} ${args.join(' ')}`.trim();
  let spawnedPid: number | undefined;

  forked.on('spawn', () => {
    spawnedPid = forked.pid;
    log.info(
      `[UtilityProcess] Running "${name}" using bin=${binPath} with pid=${spawnedPid} in ${cwd}`,
    );
    ready.resolve();
  });

  forked.on('exit', code => {
    if (!alive) return;
    alive = false;
    if (spawnedPid) {
      processes.delete(spawnedPid);
    }
    const stdoutBuf = Buffer.concat(stdout.getAll());
    log.info(
      `[UtilityProcess] Exiting "${name}" with pid=${spawnedPid} and exit code=${code || 0}`,
    );

    // Only treat as error if process has actually spawned and process is not being killed intentionally.
    if (code !== 0 && code !== null && !ready.isPending && !isKilling) {
      const stderrBuf = Buffer.concat(stderr.getAll());
      promise.reject(
        new StreamError(
          'COMMAND_FAILED',
          `Error: process "${name}" with pid=${spawnedPid} exited with code=${code}`,
          stdoutBuf,
          stderrBuf,
        ),
      );
    } else {
      promise.resolve(stdoutBuf);
    }
    cleanup();
    // a spawn that never happened still needs kill() unblocked, and an exit landing
    // mid-kill() must settle the kill instead of leaving it to the pid poll, which
    // can stay truthy forever on Windows pid reuse
    ready.resolve();
    killPromise?.resolve();
  });

  const child: Child = {
    pkg,
    bin,
    args,
    cwd,
    process: forked,
    stdall: (opts: EventOptions = {}) => {
      const out: string[] = [];
      for (const buf of stdall.getAllIterator()) {
        const data = Buffer.from(buf).toString('utf8');
        out.push(processData(data, opts));
      }
      return out;
    },
    on: (pattern, handler, opts = {}) => {
      if (alive) {
        return (
          matchers.push({
            pattern,
            handler,
            enabled: true,
            opts: {
              type: opts.type ?? 'all',
              sanitize: opts.sanitize ?? true,
            },
          }) - 1
        );
      }
      throw new Error('Process has been killed');
    },
    once: (pattern, handler, opts = {}) => {
      const index = child.on(
        pattern,
        data => {
          handler(data);
          child.off(index);
        },
        opts,
      );
      return index;
    },
    off: index => {
      if (matchers[index]) {
        matchers[index].enabled = false;
      }
    },
    wait: () => promise,
    waitFor: (resolvePattern, rejectPattern, opts) =>
      new Promise((resolve, reject) => {
        child.once(resolvePattern, data => resolve(data!), { type: opts?.resolve });
        if (rejectPattern) {
          child.once(rejectPattern, data => reject(new Error(data)), { type: opts?.reject });
        }
      }),
    kill: async () => {
      // a repeat caller shares the in-flight kill instead of getting an instantly
      // resolved undefined that would let shutdown truncate the first one's cleanup
      if (killPromise) return killPromise;
      if (!alive) return;

      const pending = (killPromise = future<void>());
      isKilling = true;

      await ready;

      const pid = spawnedPid;
      if (!alive || !pid) {
        pending.resolve();
        return pending;
      }

      log.info(`[UtilityProcess] Killing process "${name}" with pid=${pid}...`);

      // kill child gracefully
      treeKill(pid);

      let forced = false;

      // child confirmed dead: settle wait() too — 'exit' early-returns once alive is
      // false, and may never fire at all after a forced tree kill
      const die = () => {
        if (!pending.isPending) return;
        alive = false;
        processes.delete(pid);
        log.info(
          `[UtilityProcess] Process "${name}" with pid=${pid} ${
            forced ? 'forcefully' : 'gracefully'
          } killed`,
        );
        promise.resolve(Buffer.concat(stdout.getAll()));
        cleanup();
        pending.resolve();
      };

      // interval to check if child still running and flag it as dead when is not running anymore
      const interval = setInterval(() => {
        if (!isRunning(pid)) {
          die();
        }
      }, 100);

      // timeout to stop waiting for a graceful exit, kill it with fire. The poll keeps
      // running afterwards: resolving right here would declare success while the tree
      // can still be alive holding the very files an NSIS update needs to replace.
      const timeout = setTimeout(() => {
        if (alive) {
          forced = true;
          treeKill(pid, 'SIGKILL');
        }
      }, FORCE_KILL_TIMEOUT_MS);

      // whether death is confirmed by the poll or by the 'exit' event, stop the timers
      void pending.then(() => {
        clearInterval(interval);
        clearTimeout(timeout);
      });

      return pending;
    },
    alive: () => alive,
  };

  // Register child in processes map after spawn (when pid is available)
  ready.then(() => {
    if (spawnedPid) {
      processes.set(spawnedPid, child);
    }
  });

  return child;
}

export async function install() {
  setupNodeBinary();
}

async function handleData(buffer: Buffer, matchers: Matcher[], type: StreamType) {
  const data = buffer.toString('utf8');
  log.info(`[UtilityProcess] ${data}`); // pipe data to console
  for (const { pattern, handler, enabled, opts } of matchers) {
    if (!enabled) continue;
    if (opts?.type !== 'all' && opts?.type !== type) continue;
    pattern.lastIndex = 0; // reset regexp
    if (pattern.test(data)) {
      handler(processData(data, opts));
    }
  }
}

function processData(data: string, opts: EventOptions | undefined) {
  const { sanitize = true } = opts ?? {};
  // remove control characters from data
  const text = sanitize
    ? data.replace(
        // eslint-disable-next-line no-control-regex
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
        '',
      )
    : data;
  return text;
}
export async function dclDeepLink(deepLink: string) {
  // On Windows, launching a protocol with `start` won't fail even if there is no handler.
  // Check for a registered protocol handler in the registry. If none is registered, CLIENT_NOT_INSTALLED_ERROR is thrown.
  try {
    if (process.platform === 'win32') {
      await exec('reg query "HKEY_CLASSES_ROOT\\decentraland"');
    }

    await shell.openExternal(`decentraland://${deepLink}`);
  } catch (e) {
    throw new ClientError('CLIENT_NOT_INSTALLED', CLIENT_NOT_INSTALLED_ERROR);
  }
}

/**
 * Kill all tracked utility processes.
 * This should be called during app shutdown to ensure all forked processes are properly terminated.
 */
export async function killAllUtilityProcesses() {
  if (processes.size === 0) return;

  log.info(`[UtilityProcess] Killing ${processes.size} utility processes...`);
  const killPromises = Array.from(processes.values()).map(child => child.kill());
  await Promise.all(killPromises);
  processes.clear();
  log.info('[UtilityProcess] All utility processes killed');
}
