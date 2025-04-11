import path from 'node:path';

import * as config from './config';
import * as fs from './fs';
import * as npm from './npm';
import * as ipc from './ipc';
import * as pkg from './pkg';
import * as project from './project';

export type Services = {
  config: typeof config;
  fs: typeof fs;
  npm: typeof npm;
  ipc: typeof ipc;
  path: typeof path;
  pkg: typeof pkg;
  project: typeof project;
};

export const getServices = (): Services => ({
  config,
  fs,
  npm,
  ipc,
  path,
  pkg,
  project,
});
