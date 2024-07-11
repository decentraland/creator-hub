import fs from 'node:fs/promises';
import path from 'node:path';
import type { Scene } from '@dcl/schemas';

import type { Project } from '/shared/types/projects';
import type { Workspace } from '/shared/types/workspace';
import { hasDependency } from './pkg';
import { getRowsAndCols, parseCoords } from './scene';
import { invoke } from './invoke';
import { exists } from './fs';

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
  const nodeModulesPath = path.join(_path, 'node_modules');
  return exists(nodeModulesPath);
}

export async function getProjectThumbnail(
  projectPath: string,
  scene: Scene,
): Promise<string | undefined> {
  try {
    if (!scene.display?.navmapThumbnail) return undefined;
    const thumbnailPath = path.join(projectPath, scene.display.navmapThumbnail);
    return (await fs.readFile(thumbnailPath)).toString('base64');
  } catch (e) {
    console.log(`Could not get project thumbnail for project in ${projectPath}`, e);
    return undefined;
  }
}

export async function getProject(_path: string) {
  try {
    const scene = await getScene(_path);
    const parcels = scene.scene.parcels.map($ => parseCoords($));

    const stat = await fs.stat(_path);

    return {
      path: _path,
      title: scene.display?.title,
      description: scene.display?.description,
      thumbnail: await getProjectThumbnail(_path, scene),
      layout: getRowsAndCols(parcels),
      createdAt: Number(stat.birthtime),
      updatedAt: Number(stat.mtime),
    };
  } catch (error: any) {
    throw new Error(`Could not get scene.json info for project in "${_path}": ${error.message}`);
  }
}

export async function getPath() {
  const home = await invoke('electron.getHome');
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
      if (await isDCL(projectDir)) {
        promises.push(getProject(projectDir));
      }
      // eslint-disable-next-line no-empty
    } catch (_) {}
  }

  const projects = await Promise.all(promises);
  return projects;
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

export async function createProject(name: string): Promise<Project> {
  const slug = name.toLowerCase().replace(/\s/g, '_');
  const path = `${await getPath()}/${slug}`;
  if (await exists(path)) {
    throw new Error(`Project "${name}" already exists`);
  } else {
    await fs.mkdir(path);
    await invoke('cli.init', path);
    const scene = await getScene(path);
    scene.display!.title = name;
    await fs.writeFile(`${path}/scene.json`, JSON.stringify(scene, null, 2));
    const project = await getProject(path);
    return project;
  }
}

/**
 * Deletes a project directory and all its contents.
 *
 * @param _path - The path of the directory to be deleted.
 * @returns A Promise that resolves when the directory has been deleted.
 */
export async function deleteProject(_path: string): Promise<void> {
  await fs.rm(_path, { recursive: true, force: true });
}

/**
 * Duplicates a project directory, creating a copy with a modified title.
 *
 * @param _path - The path of the directory to be duplicated.
 * @returns A Promise that resolves to the duplicated Project.
 */
export async function duplicateProject(_path: string): Promise<Project> {
  const scene = await getScene(_path);
  const dupPath = path.join(await getPath(), `Copy of ${path.basename(_path)}`);
  await fs.cp(_path, dupPath, { recursive: true });
  scene.display = { ...scene.display, title: `Copy of ${scene.display?.title}` };
  await fs.writeFile(path.join(dupPath, 'scene.json'), JSON.stringify(scene, null, 2));
  const project = await getProject(dupPath);
  return project;
}
