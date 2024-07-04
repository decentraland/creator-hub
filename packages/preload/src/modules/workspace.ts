import fs from 'node:fs';
import path from 'node:path';
import type {Scene} from '@dcl/schemas';

import type {Project} from '/shared/types/projects';
import type {Workspace} from '/shared/types/workspace';
import {hasDependency} from './pkg';
import {getRowsAndCols, parseCoords} from './scene';

/**
 * Get scene json
 */
export function getScene(_path: string): Scene {
  const sceneJsonPath = path.join(_path, 'scene.json');
  const scene = fs.readFileSync(sceneJsonPath, 'utf8');
  return JSON.parse(scene);
}

/**
 * Returns whether or not the provided directory is a decentraland project or not
 */
export function isDCL(_path: string): boolean {
  try {
    getScene(_path);
    return hasDependency(_path, '@dcl/sdk');
  } catch (_) {
    return false;
  }
}

/**
 * Returns whether or not the provided directory is empty or not
 */
export function isEmpty(_path: string): boolean {
  try {
    const files = fs.readdirSync(_path);
    return files.length === 0;
  } catch (_) {
    return false;
  }
}

/**
 * Return whether or not the provided directory has a node_modules directory
 */
export function hasNodeModules(_path: string): boolean {
  try {
    const nodeModulesPath = path.join(_path, 'node_modules');
    return fs.existsSync(nodeModulesPath);
  } catch (_) {
    return false;
  }
}

export function getProject(_path: string): Project {
  try {
    const scene = getScene(_path);
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

/**
 * Returns all decentraland projects in the provided directory
 */
export function getProjects(_path: string): Project[] {
  const scenes: Project[] = [];

  for (const dir of fs.readdirSync(_path)) {
    try {
      const projectDir = path.join(_path, dir);
      if (hasDependency(projectDir, '@dcl/sdk')) {
        scenes.push(getProject(projectDir));
      }
      // eslint-disable-next-line no-empty
    } catch (_) {}
  }

  return scenes;
}

// temp
const getCwd = () => '';

/**
 * Returns workspace info
 */
export async function getWorkspace(cwd = getCwd()): Promise<Workspace> {
  return {
    projects: getProjects(cwd),
  };
}
