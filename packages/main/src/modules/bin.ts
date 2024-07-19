import log from 'electron-log/main';
import fs from 'node:fs/promises';
import { app, utilityProcess } from 'electron';
import path from 'path';
import treeKill from 'tree-kill';
import { future } from 'fp-future';
import isRunning from 'is-running';
import cmdShim from 'cmd-shim';
import { getBinPath, getNodeCmdPath, joinEnvPaths } from './path';

// the env $PATH
let PATH = process.env.PATH;

/**
 * Links node and npm binaries to the env $PATH
 */
export async function link() {
  const nodeCmdPath = getNodeCmdPath();
  const nodeBinPath = process.execPath;
  const npmBinPath = getBinPath('npm', 'npm');
  if (!import.meta.env.DEV) {
    let isLinked = false;
    try {
      // check if link exists
      const stat = await fs.stat(nodeCmdPath);
      // check if it is a symlink
      if (stat.isSymbolicLink()) {
        const link = await fs.readlink(nodeCmdPath);
        // check if link points to the right bin
        if (link === process.execPath) {
          // skip linking
          log.info('Node binaries already linked');
          isLinked = true;
        }
      } else {
        // if not a symlink delete
        await fs.rm(nodeCmdPath);
      }
    } catch (error) {
      // if link is not found, continue linking
    }
    if (!isLinked) {
      log.info(`Linking node bin from ${nodeCmdPath} to ${nodeBinPath}`);
      // on windows we use a cmd file
      if (process.platform === 'win32') {
        await cmdShim(
          nodeBinPath,
          // remove the .cmd part if present, since it will get added by cmdShim
          nodeCmdPath.endsWith('.cmd') ? nodeCmdPath.replace(/\.cmd$/, '') : nodeCmdPath,
        );
      } else {
        // otherwise we use a symlink
        await fs.symlink(nodeBinPath, nodeCmdPath);
      }
    }
    PATH = joinEnvPaths(process.env.PATH, path.dirname(nodeCmdPath), path.dirname(npmBinPath));
    log.info('node command:', nodeCmdPath);
    log.info('node bin:', nodeBinPath);
    log.info('npm bin: ', npmBinPath);
    log.info('$PATH', PATH);
  } else {
    // no need to link node and npm in dev mode since they should already be in the $PATH for dev environment to work
    log.info('Skip linking node and npm binaries in DEV mode');
  }
}

export type Child = {
  pkg: string;
  bin: string;
  args: string[];
  cwd: string;
  process: Electron.UtilityProcess;
  on: (pattern: RegExp, handler: (data?: string) => void) => number;
  once: (pattern: RegExp, handler: (data?: string) => void) => number;
  off: (index: number) => void;
  wait: () => Promise<void>;
  waitFor: (resolvePattern: RegExp, rejectPattern?: RegExp) => Promise<string>;
  kill: () => Promise<void>;
  alive: () => boolean;
};

type Matcher = {
  pattern: RegExp;
  handler: (data: string) => void;
  enabled: boolean;
};

type RunOptions = {
  args?: string[]; // this are the arguments for the command
  cwd?: string; // this is the directory where the command should be executed, it defaults to the app path.
  env?: Record<string, string>; // this are the env vars that should be added to the command's env
  workspace?: string; // this is the path where the node_modules that should be used are located, it defaults to the app path.
};

/**
 * Runs a javascript bin script in a utility child process, provides helpers to wait for the process to finish, listen for outputs, etc
 * @param pkg The npm package
 * @param command The command to run
 * @param args The arguments for the command
 * @param cwd The directory where the command should be executed, it defaults to the app path
 * @param options Options for the child process spawned
 * @returns SpanwedChild
 */
export function run(pkg: string, bin: string, options: RunOptions = {}): Child {
  // status
  let isKilling = false;
  let alive = true;

  const promise = future<void>();
  const matchers: Matcher[] = [];

  const { workspace = app.getAppPath(), cwd = app.getAppPath(), args = [], env = {} } = options;

  const binPath = getBinPath(pkg, bin, workspace);

  const forked = utilityProcess.fork(binPath, [...args], {
    cwd,
    stdio: 'pipe',
    env: {
      ...process.env,
      ...env,
      PATH,
    },
  });

  const ready = future<void>();

  const name = `${pkg} ${args.join(' ')}`.trim();
  forked.on('spawn', () => {
    log.info(`Running "${name}" using bin=${binPath} with pid=${forked.pid} in ${cwd}`);
    ready.resolve();
  });

  forked.on('exit', code => {
    if (!alive) return;
    alive = false;
    log.info(`Exiting "${name}" with pid=${forked.pid} and exit code=${code || 0}`);
    if (code !== 0 && code !== null) {
      promise.reject(
        new Error(`Error: process "${name}" with pid=${forked.pid} exited with code=${code}`),
      );
    } else {
      promise.resolve(void 0);
    }
  });

  function handleStream(stream: NodeJS.ReadableStream) {
    stream!.on('data', (data: Buffer) => handleData(data, matchers));
  }

  handleStream(forked.stdout!);
  handleStream(forked.stderr!);

  const child: Child = {
    pkg,
    bin,
    args,
    cwd,
    process: forked,
    on: (pattern, handler) => {
      if (alive) {
        return matchers.push({ pattern, handler, enabled: true }) - 1;
      }
      throw new Error('Process has been killed');
    },
    once: (pattern, handler) => {
      const index = child.on(pattern, data => {
        handler(data);
        child.off(index);
      });
      return index;
    },
    off: index => {
      if (matchers[index]) {
        matchers[index].enabled = false;
      }
    },
    wait: () => promise,
    waitFor: (resolvePattern, rejectPattern) =>
      new Promise((resolve, reject) => {
        child.once(resolvePattern, data => resolve(data!));
        if (rejectPattern) {
          child.once(rejectPattern, data => reject(new Error(data)));
        }
      }),
    kill: async () => {
      await ready;
      const pid = forked.pid!;
      log.info(`Killing process "${name}" with pid=${pid}...`);
      // if child is being killed or already killed then return
      if (isKilling || !alive) return;
      isKilling = true;

      // create promise to kill child
      const promise = future<void>();

      // kill child gracefully
      treeKill(pid);

      // child succesfully killed
      const die = (force: boolean = false) => {
        isKilling = false;
        alive = false;
        clearInterval(interval);
        clearTimeout(timeout);
        for (const matcher of matchers) {
          matcher.enabled = false;
        }
        if (force) {
          log.info(`Process "${name}" with pid=${pid} forcefully killed`);
          treeKill(pid!, 'SIGKILL');
        } else {
          log.info(`Process "${name}" with pid=${pid} gracefully killed`);
        }
        promise.resolve();
      };

      // interval to check if child still running and flag it as dead when is not running anymore
      const interval = setInterval(() => {
        if (!pid || !isRunning(pid)) {
          die();
        }
      }, 100);

      // timeout to stop checking if child still running, kill it with fire
      const timeout = setTimeout(() => {
        if (alive) {
          die(true);
        }
      }, 5000);

      // return promise
      return promise;
    },
    alive: () => alive,
  };

  return child;
}

async function handleData(buffer: Buffer, matchers: Matcher[]) {
  const data = buffer.toString('utf8');
  log.info(data); // pipe data to console
  for (const { pattern, handler, enabled } of matchers) {
    if (!enabled) continue;
    pattern.lastIndex = 0; // reset regexp
    if (pattern.test(data)) {
      handler(data);
    }
  }
}
