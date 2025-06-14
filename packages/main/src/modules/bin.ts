import fs from 'node:fs/promises';
import path from 'path';
import { promisify } from 'util';
import { exec as execSync } from 'child_process';
import log from 'electron-log/main';
import { app, utilityProcess, shell } from 'electron';
import treeKill from 'tree-kill';
import { future } from 'fp-future';
import isRunning from 'is-running';
import cmdShim from 'cmd-shim';
import { rimraf } from 'rimraf';
import semver from 'semver';

import { ErrorBase } from '/shared/types/error';
import { createCircularBuffer } from '/shared/circular-buffer';

import { CLIENT_NOT_INSTALLED_ERROR } from '/shared/utils';
import { APP_UNPACKED_PATH, getBinPath, getNodeCmdPath, joinEnvPaths } from './path';
import { track } from './analytics';

// the env $PATH
let PATH = process.env.PATH;

// install future
const installed = future<void>();

// exec async
const exec = promisify(execSync);

/**
 * Wait for node and npm binaries to be installed
 * @returns A promise that resolves when the installation is complete
 */
export async function waitForInstall() {
  return installed;
}

/**
 * Attempts to move the application to the Applications folder on macOS.
 * This function checks if the application is not already in the Applications folder
 * and if so, it initiates the move process.
 */
function moveAppToApplicationsFolder() {
  try {
    if (!import.meta.env.DEV && process.env.MODE !== 'test') {
      if (process.platform === 'darwin') {
        if (!app.isInApplicationsFolder()) {
          app.moveToApplicationsFolder();
        }
      }
    }
  } catch (error) {
    log.error('[Install] Failed to move app to applications folder:', error);
    throw new Error('MOVE_APP_FAILED', { cause: 'Failed to move app to applications folder' });
  }
}

/**
 * Installs node and npm binaries
 */
export async function install() {
  try {
    moveAppToApplicationsFolder();
    const nodeModulesPath = path.join(APP_UNPACKED_PATH, 'node_modules');
    const tempPath = path.join(APP_UNPACKED_PATH, 'temp');
    /** Fix a previously interruped install */
    try {
      // If the temp folder exists, delete node_modules and move temp back to node_modules
      await fs.stat(tempPath);
      log.info('[Install] Found temp folder, moving node_modules back');
      try {
        await rimraf(nodeModulesPath);
        await fs.rename(path.join(tempPath, 'node_modules'), nodeModulesPath);
        await rimraf(tempPath);
      } catch (error: any) {
        log.error('[Install] Failed to move node_modules back:', error.message);
      }
    } catch (error) {
      // If temp folder doesn't exist, continue with regular install
    }
    const nodeCmdPath = getNodeCmdPath();
    const nodeBinPath = process.execPath;
    const npmBinPath = getBinPath('npm', 'npm');
    if (!import.meta.env.DEV) {
      let isInstalled = false;
      try {
        // check if link exists
        const stat = await fs.stat(nodeCmdPath);
        // check if it is a symlink
        if (stat.isSymbolicLink()) {
          const link = await fs.readlink(nodeCmdPath);
          // check if link points to the right bin
          if (link === process.execPath) {
            // skip linking
            log.info('[Install] Node binaries already installed');
            isInstalled = true;
          }
        } else {
          // if not a symlink delete
          await fs.rm(nodeCmdPath);
        }
      } catch (error) {
        // if link is not found, continue installing
      }
      if (!isInstalled) {
        log.info(`[Install] Installed node bin linking from ${nodeCmdPath} to ${nodeBinPath}`);
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
      PATH = joinEnvPaths(path.dirname(nodeCmdPath), path.dirname(npmBinPath), process.env.PATH);
      if (process.platform !== 'win32') {
        // on unix systems we need to install the path to the local bin folder for the Open in VSCode feature to work
        PATH = joinEnvPaths(PATH, '/usr/local/bin');
      }
      log.info('[Install] node command:', nodeCmdPath);
      log.info('[Install] node bin:', nodeBinPath);
      log.info('[Install] npm bin: ', npmBinPath);
      log.info('[Install] $PATH', PATH);

      // install node_modules
      log.info('[Install] Current version:', app.getVersion());
      let version: string | null = null;
      let isFirstInstall = false;
      try {
        // keep track of the last version that was installed
        const versionPath = path.join(APP_UNPACKED_PATH, 'version.json');
        const versionJson: { version: string } = JSON.parse(await fs.readFile(versionPath, 'utf8'));
        version = versionJson.version;
        log.info('[Install] Last installed version:', version);
      } catch (_error) {
        // if there's no registry of the last version, we will assume it's the first install
        isFirstInstall = true;
        log.info('[Install] This is the first installation');
      }

      let workspace = APP_UNPACKED_PATH;
      // on the first installation, the node_modules only contain npm, so we'll move it to a temp folder so we can use it from there on a pristine environment
      if (isFirstInstall) {
        log.info('[Install] Creating temp folder');
        await fs.mkdir(tempPath);
        log.info('[Install] Moving node_modules to temp folder');
        await fs.rename(nodeModulesPath, path.join(tempPath, 'node_modules')).catch(() => {});
        workspace = tempPath;
      }

      // if the version is different from the current one, we will install the node_modules again in case there are new dependencies
      const shouldInstall = !version || semver.lt(version, app.getVersion());
      if (shouldInstall) {
        // install dependencies using npm
        log.info('[Install] Installing node_modules...');
        const npmInstall = run('npm', 'npm', {
          args: ['install', '--loglevel', 'error'],
          cwd: APP_UNPACKED_PATH,
          workspace,
        });
        await npmInstall.waitFor(/added \d+ package|up to date/); // wait for successs message, because when the user quits the app while installing, npm exits gracefully with an exit code=0;

        // save the current version to the registry
        log.info('[Install] Writing current version to the registry');
        await fs.writeFile(
          path.join(APP_UNPACKED_PATH, 'version.json'),
          JSON.stringify({ version: app.getVersion() }),
        );
      } else {
        log.info('[Install] Skipping installation of node_modules because it is up to date');
      }

      // if this was the first installation, we can now remove the temp node_modules folder
      if (isFirstInstall) {
        log.info('[Install] Removing temp folder');
        await rimraf(workspace);
      }

      if (shouldInstall) {
        log.info('[Install] Installation complete!');
        await track('Install Editor', { version: app.getVersion() });
      }
    } else {
      // no need to install node and npm in dev mode since they should already be in the $PATH for dev environment to work
      log.info('[Install] Skipping installation of node and npm binaries in DEV mode');
    }
    installed.resolve();
  } catch (error: any) {
    log.error('[Install] Failed to install node and npm binaries:', error.message);
    installed.reject(error);
    throw error;
  }
}

const MAX_BUFFER_SIZE = 2048;

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

export type Child = {
  pkg: string;
  bin: string;
  args: string[];
  cwd: string;
  process: Electron.UtilityProcess;
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
};

/**
 * Runs a javascript bin script in a utility child process, provides helpers to wait for the process to finish, listen for outputs, etc
 * @param pkg The npm package
 * @param bin The command to run
 * @param options Options for the child process (args, cwd, env, workspace)
 * @returns Child
 */
export function run(pkg: string, bin: string, options: RunOptions = {}): Child {
  let isKilling = false;
  let alive = true;

  const promise = future<Awaited<ReturnType<Child['wait']>>>();
  const matchers: Matcher[] = [];

  const { workspace = APP_UNPACKED_PATH, cwd = APP_UNPACKED_PATH, args = [], env = {} } = options;

  const binPath = getBinPath(pkg, bin, workspace);

  const stdout = createCircularBuffer<Uint8Array>(MAX_BUFFER_SIZE);
  const stderr = createCircularBuffer<Uint8Array>(MAX_BUFFER_SIZE);
  const stdall = createCircularBuffer<Uint8Array>(MAX_BUFFER_SIZE); // ordered buffer of stdout and stderr

  const forked = utilityProcess.fork(binPath, [...args], {
    cwd,
    stdio: 'pipe',
    env: {
      ...process.env,
      ...env,
      PATH,
    },
  });

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

  const ready = future<void>();

  const name = `${bin} ${args.join(' ')}`.trim();
  forked.on('spawn', () => {
    log.info(
      `[UtilityProcess] Running "${name}" using bin=${binPath} with pid=${forked.pid} in ${cwd}`,
    );
    ready.resolve();
  });

  forked.on('exit', code => {
    if (!alive) return;
    alive = false;
    const stdoutBuf = Buffer.concat(stdout.getAll());
    log.info(
      `[UtilityProcess] Exiting "${name}" with pid=${forked.pid} and exit code=${code || 0}`,
    );
    if (code !== 0 && code !== null) {
      const stderrBuf = Buffer.concat(stderr.getAll());
      promise.reject(
        new StreamError(
          'COMMAND_FAILED',
          `Error: process "${name}" with pid=${forked.pid} exited with code=${code}`,
          stdoutBuf,
          stderrBuf,
        ),
      );
    } else {
      promise.resolve(stdoutBuf);
    }
    cleanup();
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
      await ready;
      const pid = forked.pid!;

      // if child is being killed or already killed then return
      if (isKilling || !alive) return;
      isKilling = true;
      log.info(`[UtilityProcess] Killing process "${name}" with pid=${pid}...`);

      // create promise to kill child
      const killPromise = future<void>();

      // kill child gracefully
      treeKill(pid);

      // child successfully killed
      const die = (force: boolean = false) => {
        isKilling = false;
        alive = false;
        cleanup();
        if (force) {
          log.info(`[UtilityProcess] Process "${name}" with pid=${pid} forcefully killed`);
          treeKill(pid!, 'SIGKILL');
        } else {
          log.info(`[UtilityProcess] Process "${name}" with pid=${pid} gracefully killed`);
        }
        clearInterval(interval);
        clearTimeout(timeout);
        killPromise.resolve();
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
      return killPromise;
    },
    alive: () => alive,
  };

  return child;
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
  const command = process.platform === 'win32' ? 'start' : 'open';
  try {
    await exec(`${command} decentraland://"${deepLink}"`);
  } catch (e) {
    throw new Error(CLIENT_NOT_INSTALLED_ERROR);
  }
}

export async function code(_path: string) {
  const normalizedPath = path.normalize(_path);
  try {
    await exec(`code "${normalizedPath}"`, { env: { ...process.env, PATH } });
  } catch (_) {
    const error = await shell.openPath(normalizedPath);
    if (error) {
      throw new Error(error);
    }
  }
}
