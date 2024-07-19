import log from 'electron-log/main';
import fs from 'node:fs';
import { app, utilityProcess } from 'electron';
import path from 'path';
import treeKill from 'tree-kill';
import { future } from 'fp-future';
import isRunning from 'is-running';
import { getBinPath } from './path';

function getNodeBinPath() {
  const cmdPath = path.join(app.getAppPath(), 'node');
  log.info('cmdPath', cmdPath);
  let isLinked = false;
  try {
    const stat = fs.statSync(cmdPath);
    log.info('Node bin found', stat);
    if (stat.isSymbolicLink()) {
      const link = fs.readlinkSync(cmdPath);
      log.info(`Node is linked to ${link}`);
      if (link === process.execPath) {
        log.info('Is same as execPath');
        isLinked = true;
      } else {
        log.info(`Is different to execPath=${process.execPath}`);
      }
    } else {
      log.info('Node bin not linked');
      fs.rmSync(cmdPath);
    }
  } catch (error) {
    // do nothing
    log.info('Node bin not found');
  }
  if (!isLinked) {
    log.info(`Linking node bin from cmdPath=${cmdPath} to ${process.execPath}`);
    fs.symlinkSync(process.execPath, cmdPath);
  }
  return cmdPath;
}

export type Child = {
  pkg: string;
  bin: string;
  command: string;
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

type Options = {
  basePath?: string; // this is the path where the node_modules that should be used are located, it defaults to the app path.
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
export function run(
  pkg: string,
  bin: string,
  command: string,
  args: string[] = [],
  cwd: string = app.getAppPath(),
  options: Options = {},
): Child {
  // status
  let isKilling = false;
  let alive = true;

  const promise = future<void>();
  const matchers: Matcher[] = [];

  const { basePath = app.getAppPath() } = options;

  const binPath = getBinPath(pkg, bin, basePath);
  const PATH =
    process.env.PATH +
    ':' +
    path.dirname(getNodeBinPath()) +
    ':' +
    path.dirname(getBinPath('npm', 'npm'));
  log.info(`PATH=${PATH}`);
  const forked = utilityProcess.fork(binPath, [command, ...args], {
    cwd,
    stdio: 'pipe',
    env: {
      ...process.env,
      PATH,
    },
  });

  const ready = future<void>();

  const name = `${pkg} ${command} ${args.join(' ')}`;
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
    command,
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
