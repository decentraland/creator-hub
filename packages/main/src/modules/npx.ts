import path from 'path';
import treeKill from 'tree-kill';
import {future} from 'fp-future';
import isRunning from 'is-running';
import {createRequire} from 'node:module';
import {utilityProcess} from 'electron';

export type Command = {
  pkg: string;
  args: string[];
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

/**
 * Runs any command in a spanwed child process, provides helpers to wait for the process to finish, listen for outputs, send reponses, etc
 * @param command The command
 * @param args The arguments for the command
 * @param options Options for the child process spawned
 * @returns SpanwedChild
 */
export function npx(pkg: string, args: string[] = [], cwd: string): Command {
  // status
  let isKilling = false;
  let alive = true;

  const promise = future<void>();
  const matchers: Matcher[] = [];

  // run npx as a utility process on a given cwd
  const require = createRequire(import.meta.url);
  const npmPath = require.resolve('npm');
  const npxPath = path.join(path.dirname(npmPath), '../.bin/npx');
  console.log(`npxPath: ${npxPath}`);
  const child = utilityProcess.fork(npxPath, [pkg, ...args], {cwd, stdio: 'pipe'});

  const name = `npx ${pkg} ${args.join(' ')}`;
  child.on('spawn', () => {
    console.log(`Running "${name}" with pid=${child.pid} in ${cwd}...`);
  });

  child.on('exit', code => {
    if (!alive) return;
    alive = false;
    console.log(`Exiting "${name}" with pid=${child.pid} and exit code=${code || 0}`);
    if (code !== 0 && code !== null) {
      promise.reject(
        new Error(`Error: process "${name}" with pid=${child.pid} exited with code=${code}`),
      );
    } else {
      promise.resolve(void 0);
    }
  });

  function handleStream(stream: NodeJS.ReadableStream) {
    stream!.on('data', (data: Buffer) => handleData(data, matchers));
  }

  handleStream(child.stdout!);
  handleStream(child.stderr!);

  const command: Command = {
    pkg,
    args,
    process: child,
    on: (pattern, handler) => {
      if (alive) {
        return matchers.push({pattern, handler, enabled: true}) - 1;
      }
      throw new Error('Process has been killed');
    },
    once: (pattern, handler) => {
      const index = command.on(pattern, data => {
        handler(data);
        command.off(index);
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
        command.once(resolvePattern, data => resolve(data!));
        if (rejectPattern) {
          command.once(rejectPattern, data => reject(new Error(data)));
        }
      }),
    kill: async () => {
      console.log(`Killing process "${name}" with pid=${child.pid}...`);
      // if child is being killed or already killed then return
      if (isKilling || !alive) return;
      isKilling = true;

      // create promise to kill child
      const promise = future<void>();

      // kill child gracefully
      treeKill(child.pid!);

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
          console.log(`Process "${name}" with pid=${child.pid} forcefully killed`);
          treeKill(child.pid!, 'SIGKILL');
        } else {
          console.log(`Process "${name}" with pid=${child.pid} gracefully killed`);
        }
        promise.resolve();
      };

      // interval to check if child still running and flag it as dead when is not running anymore
      const interval = setInterval(() => {
        if (!child.pid || !isRunning(child.pid)) {
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

  return command;
}

async function handleData(buffer: Buffer, matchers: Matcher[]) {
  const data = buffer.toString('utf8');
  console.log(data);
  for (const {pattern, handler, enabled} of matchers) {
    if (!enabled) continue;
    pattern.lastIndex = 0; // reset regexp
    if (pattern.test(data)) {
      handler(data);
    }
  }
}
