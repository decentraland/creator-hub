import log from 'electron-log/main';
import fs from 'node:fs/promises';
import { utilityProcess } from 'electron';
import path from 'path';
import treeKill from 'tree-kill';
import { future } from 'fp-future';
import isRunning from 'is-running';
import cmdShim from 'cmd-shim';
import { rimraf } from 'rimraf';
import semver from 'semver';
import { APP_UNPACKED_PATH, getBinPath, getNodeCmdPath, joinEnvPaths } from './path';

// the env $PATH
let PATH = process.env.PATH;

// install future
const installed = future<void>();

/**
 * Wait for node and npm binaries to be installed
 * @returns A promise that resolves when the installation is complete
 */
export async function waitForInstall() {
  return installed;
}

/**
 * Installs node and npm binaries
 */
export async function install() {
  try {
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
            log.info('Node binaries already installed');
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
        log.info(`Installed node bin linking from ${nodeCmdPath} to ${nodeBinPath}`);
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

      // install node_modules
      log.info('Current version:', import.meta.env.VITE_APP_VERSION);
      let version: string | null = null;
      let isFirstInstall = false;
      try {
        // keep track of the last version that was installed
        const versionPath = path.join(APP_UNPACKED_PATH, 'version.json');
        const versionJson: { version: string } = JSON.parse(await fs.readFile(versionPath, 'utf8'));
        version = versionJson.version;
        log.info('Last installed version:', version);
      } catch (_error) {
        // if there's no registry of the last version, we will assume it's the first install
        isFirstInstall = true;
        log.info('This is the first installation');
      }

      let workspace = APP_UNPACKED_PATH;
      // on the first installation, the node_modules only contain npm, so we'll move it to a temp folder so we can use it from there on a pristine environment
      if (isFirstInstall) {
        const nodeModulesPath = path.join(APP_UNPACKED_PATH, 'node_modules');
        const tempPath = path.join(APP_UNPACKED_PATH, 'temp');
        log.info('Creating temp folder');
        await fs.mkdir(tempPath);
        log.info('Moving node_modules to temp folder');
        await fs.rename(nodeModulesPath, path.join(tempPath, 'node_modules')).catch(() => {});
        workspace = tempPath;
      }

      // if the version is different from the current one, we will install the node_modules again in case there are new dependencies
      const shouldInstall = !version || semver.lt(version, import.meta.env.VITE_APP_VERSION);
      if (shouldInstall) {
        // install dependencies using npm
        log.info('Installing node_modules...');
        const npmInstall = run('npm', 'npm', {
          args: ['install'],
          cwd: APP_UNPACKED_PATH,
          workspace,
        });
        await npmInstall.wait();

        // save the current version to the registry
        log.info('Writing current version to the registry');
        await fs.writeFile(
          path.join(APP_UNPACKED_PATH, 'version.json'),
          JSON.stringify({ version: import.meta.env.VITE_APP_VERSION }),
        );
      } else {
        log.info('Skipping installation of node_modules because it is up to date');
      }

      // if this was the first installation, we can now remove the temp node_modules folder
      if (isFirstInstall) {
        log.info('Removing temp folder');
        await rimraf(workspace);
      }

      if (shouldInstall) {
        log.info('Installation complete!');
      }
    } else {
      // no need to install node and npm in dev mode since they should already be in the $PATH for dev environment to work
      log.info('Skipping installation of node and npm binaries in DEV mode');
    }
    installed.resolve();
  } catch (error: any) {
    installed.reject(error);
    throw error;
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
 * @param bin The command to run
 * @param options Options for the child process (args, cwd, env, workspace)
 * @returns Child
 */
export function run(pkg: string, bin: string, options: RunOptions = {}): Child {
  // status
  let isKilling = false;
  let alive = true;

  const promise = future<void>();
  const matchers: Matcher[] = [];

  const { workspace = APP_UNPACKED_PATH, cwd = APP_UNPACKED_PATH, args = [], env = {} } = options;

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

      // if child is being killed or already killed then return
      if (isKilling || !alive) return;
      isKilling = true;
      log.info(`Killing process "${name}" with pid=${pid}...`);

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
