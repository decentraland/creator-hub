import { app } from 'electron';
import fs from 'fs';

// set default workspace to user's home directory for now
// later we should have a conf file and read it from there
let cwd: string = app.getPath('home');

/**
 * Set the path to the extension's directory in the filesystem
 * @param path Path to the extension
 */
export function setCwd(_path: string) {
  if (fs.statSync(_path).isDirectory()) {
    cwd = _path;
  }
  throw new Error(`setCwd(): Invalid path provided ${_path}`);
}

/**
 * Returns the path to the workspace's current working directory
 * @returns The path to the workspace's current working directory
 */
export function getCwd() {
  return cwd;
}
