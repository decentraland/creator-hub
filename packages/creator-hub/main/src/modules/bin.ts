import path from 'path';
import fs from 'fs/promises';
import { promisify } from 'util';
import { exec as execSync } from 'child_process';
import log from 'electron-log/main';
import { utilityProcess, shell } from 'electron';
import treeKill from 'tree-kill';
import { future } from 'fp-future';
import isRunning from 'is-running';
import { type EditorConfig } from '/shared/types/config';

import { ErrorBase } from '/shared/types/error';
import { createCircularBuffer } from '/shared/circular-buffer';

import { CLIENT_NOT_INSTALLED_ERROR } from '/shared/utils';
import { getConfig } from './config';
import { APP_UNPACKED_PATH, getBinPath } from './path';
import { setupNodeBinary } from './setup-node';
import { track } from './analytics';

// Get the current PATH value
function getPath() {
  return process.env.PATH || '';
}

// exec async
const exec = promisify(execSync);

const MAX_BUFFER_SIZE = 2048;

export enum EditorType {
  VSCode = 'Visual Studio Code',
  Cursor = 'Cursor',
}

const EDITOR_PATHS = {
  win32: {
    [EditorType.VSCode]: (username: string) => [
      `C:\\Users\\${username}\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe`,
      'C:\\Program Files\\Microsoft VS Code\\Code.exe',
    ],
    [EditorType.Cursor]: (username: string) => [
      `C:\\Users\\${username}\\AppData\\Local\\Programs\\Cursor\\Cursor.exe`,
      'C:\\Program Files\\Cursor\\Cursor.exe',
    ],
  },
  darwin: {
    [EditorType.VSCode]: [
      '/Applications/Visual Studio Code.app',
      '~/Applications/Visual Studio Code.app',
    ],
    [EditorType.Cursor]: ['/Applications/Cursor.app', '~/Applications/Cursor.app'],
  },
};

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
      PATH: getPath(),
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
  const command = process.platform === 'win32' ? 'start' : 'open';
  try {
    await exec(`${command} decentraland://"${deepLink}"`);
  } catch (e) {
    throw new Error(CLIENT_NOT_INSTALLED_ERROR);
  }
}

export async function code(_path: string) {
  const normalizedPath = path.normalize(_path);
  log.info('Opening project at path:', normalizedPath);

  const config = await getConfig();
  const editors = (await config.get('editors')) || [];
  const defaultEditor = editors.find(editor => editor.isDefault);

  log.info('Available editors:', editors);
  log.info('Default editor:', defaultEditor);

  try {
    if (defaultEditor) {
      log.info('Opening with default editor:', defaultEditor.name, 'at path:', defaultEditor.path);
      let command: string;
      if (process.platform === 'darwin') {
        const macosPath = path.join(defaultEditor.path, 'Contents', 'MacOS');
        try {
          const files = await fs.readdir(macosPath);

          const executableFiles = await Promise.all(
            files.map(async file => {
              const filePath = path.join(macosPath, file);
              try {
                const stats = await fs.stat(filePath);

                return stats.isFile() && stats.mode & 0o111 ? file : null;
              } catch (error) {
                return null;
              }
            }),
          ).then(results => results.filter((file): file is string => file !== null));

          log.info('Found executable files:', executableFiles);

          if (executableFiles.length === 0) {
            throw new Error('No executable files found in MacOS directory');
          }

          let executableName: string;
          if (executableFiles.length === 1) {
            executableName = executableFiles[0];
          } else {
            const editorWords = defaultEditor.name.toLowerCase().split(/\s+/);
            executableName =
              executableFiles.find(file =>
                editorWords.some(word => file.toLowerCase().includes(word)),
              ) || executableFiles[0];
          }

          log.info('Found executable:', executableName, 'from options:', executableFiles);
          command = `"${defaultEditor.path}/Contents/MacOS/${executableName}" "${normalizedPath}"`;
        } catch (error) {
          log.error('Error reading MacOS directory:', error);

          command = `"${defaultEditor.path}/Contents/MacOS/${defaultEditor.name}" "${normalizedPath}"`;
        }
      } else {
        command = `"${defaultEditor.path}" "${normalizedPath}"`;
      }
      log.info('Executing command:', command);
      await exec(command, {
        env: { ...process.env, PATH: getPath() },
      });
      await track('Open Code', undefined);
    } else {
      log.info('No default editor found, trying VS Code');
      await exec(`code "${normalizedPath}"`, { env: { ...process.env, PATH: getPath() } });
      await track('Open Code', undefined);
    }
  } catch (error) {
    log.info(
      'Failed to open with configured editor, falling back to system default. Error:',
      error,
    );
    await shell.openPath(normalizedPath);
  }
}

async function validateEditor(editor: EditorConfig): Promise<boolean> {
  try {
    if (process.platform === 'darwin') {
      const macosPath = path.join(editor.path, 'Contents', 'MacOS');
      await fs.stat(macosPath);
    } else {
      await fs.stat(editor.path);
    }
    return true;
  } catch {
    return false;
  }
}

export async function getEditors() {
  const config = await getConfig();
  const editors = (await config.get('editors')) || [];

  const validEditors = [];
  let defaultFound = false;

  for (const editor of editors) {
    if (await validateEditor(editor)) {
      validEditors.push(editor);
      if (editor.isDefault) {
        defaultFound = true;
      }
    } else {
      log.info(`Editor ${editor.name} at ${editor.path} no longer exists, removing from config`);
    }
  }

  if (!defaultFound && validEditors.length > 0) {
    validEditors[0].isDefault = true;
  }

  if (validEditors.length !== editors.length) {
    await config.set('editors', validEditors);
  }

  return validEditors;
}

export async function setDefaultEditor(editorPath: string) {
  const config = await getConfig();
  const editors = (await config.get('editors')) || [];

  let name: string;
  if (process.platform === 'darwin') {
    const fileName = editorPath.split('/').pop() || '';
    if (!fileName.endsWith('.app')) {
      throw new Error('Invalid application selected. Please select a valid .app bundle.');
    }

    const macosPath = path.join(editorPath, 'Contents', 'MacOS');
    try {
      await fs.stat(macosPath);
    } catch {
      throw new Error('Invalid application bundle structure. Missing Contents/MacOS directory.');
    }
    name = fileName.replace('.app', '');
  } else {
    name = editorPath.split('\\').pop()?.replace('.exe', '') || 'Custom Editor';
  }

  const existingIndex = editors.findIndex(e => e.name === name);
  const updatedEditors = editors.map(editor => ({
    ...editor,
    isDefault: false,
  }));

  if (existingIndex >= 0) {
    updatedEditors[existingIndex] = {
      ...updatedEditors[existingIndex],
      path: editorPath,
      isDefault: true,
    };
  } else {
    updatedEditors.push({
      name,
      path: editorPath,
      isDefault: true,
    });
  }

  await config.set('editors', updatedEditors);
  return updatedEditors;
}

export async function addEditorPathsToConfig() {
  const config = await getConfig();
  const existingEditors = (await config.get('editors')) || [];
  const platform = process.platform as 'win32' | 'darwin';
  const username = platform === 'win32' ? process.env.USERNAME || '' : '';

  const findEditorPath = async (type: EditorType): Promise<string | null> => {
    const paths =
      platform === 'win32' ? EDITOR_PATHS.win32[type](username) : EDITOR_PATHS.darwin[type];

    for (const path of paths) {
      try {
        await fs.stat(path);
        return path;
      } catch {
        return null;
      }
    }
    return null;
  };

  const foundEditors: EditorConfig[] = [];
  const vscodePath = await findEditorPath(EditorType.VSCode);
  if (vscodePath) {
    foundEditors.push({
      name: EditorType.VSCode,
      path: vscodePath,
      isDefault: true,
    });
  }

  const cursorPath = await findEditorPath(EditorType.Cursor);
  if (cursorPath) {
    foundEditors.push({
      name: EditorType.Cursor,
      path: cursorPath,
      isDefault: !vscodePath,
    });
  }

  const newEditors = foundEditors.filter(
    editor => !existingEditors.find(existing => existing.name === editor.name),
  );

  if (newEditors.length > 0) {
    const allEditors = [...existingEditors, ...newEditors];
    await config.set('editors', allEditors);
  }
}
