import fs from 'node:fs/promises';
import path from 'node:path';
import type {Scene} from '@dcl/schemas';

import type {Project} from '/shared/types/projects';
import type {Workspace} from '/shared/types/workspace';
import {hasDependency} from './pkg';
import {getRowsAndCols, parseCoords} from './scene';
import {ipc} from './ipc';

/**
 * Get scene json
 */
export async function getScene(_path: string): Promise<Scene> {
  const sceneJsonPath = path.join(_path, 'scene.json');
  const scene = await fs.readFile(sceneJsonPath, 'utf8');
  return JSON.parse(scene);
}

/**
 * Returns whether or not the provided directory is a decentraland project or not
 */
export async function isDCL(_path: string) {
  try {
    await getScene(_path);
    return hasDependency(_path, '@dcl/sdk');
  } catch (_) {
    return false;
  }
}

/**
 * Returns whether or not the provided directory is empty or not
 */
export async function isEmpty(_path: string) {
  try {
    const files = await fs.readdir(_path);
    return files.length === 0;
  } catch (_) {
    return false;
  }
}

/**
 * Return whether or not the provided directory has a node_modules directory
 */
export async function hasNodeModules(_path: string) {
  try {
    const nodeModulesPath = path.join(_path, 'node_modules');
    await fs.stat(nodeModulesPath);
  } catch (_) {
    return false;
  }
}

export async function getProject(_path: string) {
  try {
    const scene = await getScene(_path);
    const parcels = scene.scene.parcels.map($ => parseCoords($));

    return {
      path: _path,
      title: scene.display?.title,
      description: scene.display?.description,
      thumbnail: scene.display?.navmapThumbnail,
      isPublic: true,
      createdAt: new Date().toDateString(),
      updatedAt: new Date().toDateString(),
      layout: getRowsAndCols(parcels),
      isTemplate: false,
      video: null,
      templateStatus: null,
    };
  } catch (error: any) {
    throw new Error(`Could not get scene.json info for project in "${_path}": ${error.message}`);
  }
}

export async function getPath() {
  const home = await ipc.app.getPath('home');
  const path = `${home}/.decentraland`;
  try {
    await fs.stat(path);
  } catch (error) {
    await fs.mkdir(path);
  }
  return path;
}

/**
 * Returns all decentraland projects in the provided directory
 */
export async function getProjects(_path: string) {
  const promises: Promise<Project>[] = [];
  const files = await fs.readdir(_path);
  for (const dir of files) {
    try {
      const projectDir = path.join(_path, dir);
      if (await hasDependency(projectDir, '@dcl/sdk')) {
        promises.push(getProject(projectDir));
      }
      // eslint-disable-next-line no-empty
    } catch (_) {}
  }

  const scenes = await Promise.all(promises);
  return scenes;
}

/**
 * Returns workspace info
 */
export async function getWorkspace(): Promise<Workspace> {
  const path = await getPath();
  return {
    projects: await getProjects(path),
  };
}
