import fs from 'node:fs/promises';
import path from 'node:path';
import type { Scene } from '@dcl/schemas';

import { SortBy, type Project } from '/shared/types/projects';
import type { Workspace } from '/shared/types/workspace';

import { hasDependency } from './pkg';
import { getRowsAndCols, parseCoords } from './scene';
import { invoke } from './invoke';
import { exists, writeFile as deepWriteFile } from './fs';
import { getConfig, setConfig } from './config';

import { DEFAULT_THUMBNAIL, NEW_SCENE_NAME, EMPTY_SCENE_TEMPLATE_REPO } from './constants';

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

export async function getProjectThumbnail(projectPath: string, scene: Scene): Promise<string> {
  try {
    if (!scene.display?.navmapThumbnail) return DEFAULT_THUMBNAIL;
    const thumbnailPath = path.join(projectPath, scene.display.navmapThumbnail);
    return (await fs.readFile(thumbnailPath)).toString('base64');
  } catch (e) {
    console.warn(`Could not get project thumbnail for project in ${projectPath}`, e);
    return DEFAULT_THUMBNAIL;
  }
}

export async function getProject(_path: string): Promise<Project> {
  try {
    const scene = await getScene(_path);
    const parcels = scene.scene.parcels.map($ => parseCoords($));

    const stat = await fs.stat(_path);

    return {
      path: _path,
      title: scene.display?.title || 'Untitled scene',
      description: scene.display?.description,
      thumbnail: await getProjectThumbnail(_path, scene),
      layout: getRowsAndCols(parcels),
      createdAt: Number(stat.birthtime),
      updatedAt: Number(stat.mtime),
      size: stat.size,
    };
  } catch (error: any) {
    throw new Error(`Could not get scene.json info for project in "${_path}": ${error.message}`);
  }
}

export async function getPath() {
  const appHome = await invoke('electron.getAppHome');
  try {
    await fs.stat(appHome);
  } catch (error) {
    await fs.mkdir(appHome);
  }
  return appHome;
}

/**
 * Returns all decentraland projects in the provided directories (or the default one if no provided)
 */
export async function getProjects(paths: string | string[]): Promise<[Project[], string[]]> {
  paths = Array.isArray(paths) ? paths : [paths];
  if (!paths.length) return [[], []];

  const promises: Promise<Project>[] = [];
  const missing: string[] = [];

  for (const _path of paths) {
    if (!(await exists(_path))) {
      // _path doesn't exist
      missing.push(_path);
    } else if (await isDCL(_path)) {
      // _path is a project
      promises.push(getProject(_path));
    } else {
      // _path is a directory with projects
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
    }
  }

  const projects = await Promise.all(promises);
  return [projects, missing];
}

export async function getWorkspacePaths(): Promise<string[]> {
  const [home, config] = await Promise.all([getPath(), getConfig()]);
  return [home, ...config.workspace.paths];
}

/**
 * Returns workspace info
 */
export async function getWorkspace(): Promise<Workspace> {
  const paths = await getWorkspacePaths();
  const [projects, missing] = await getProjects(paths);

  return {
    sortBy: SortBy.NEWEST, // TODO: read from editor config file...
    projects,
    missing,
  };
}

export async function createProject(name = NEW_SCENE_NAME): Promise<Project> {
  let sceneName = name;
  let counter = 2;
  const homePath = await getPath();
  let scenePath = path.join(homePath, sceneName);
  while (await exists(scenePath)) {
    sceneName = `${name} ${counter++}`;
    scenePath = path.join(homePath, sceneName);
  }
  await fs.mkdir(scenePath);
  await invoke('cli.init', scenePath, EMPTY_SCENE_TEMPLATE_REPO);
  const scene = await getScene(scenePath);
  scene.display!.title = sceneName;
  const sceneJsonPath = path.join(scenePath, 'scene.json');
  await fs.writeFile(sceneJsonPath, JSON.stringify(scene, null, 2));
  const project = await getProject(scenePath);
  return project;
}

/**
 * Unlists a project directory from config.
 *
 * @param paths - The path or paths of the directories to be unlisted.
 * @returns A Promise that resolves when the directories have been unlisted.
 */
export async function unlistProjects(paths: string[]): Promise<void> {
  const pathSet = new Set(paths);
  await setConfig(
    ({ workspace }) => (workspace.paths = workspace.paths.filter($ => !pathSet.has($))),
  );
}

/**
 * Deletes a project directory and all its contents.
 *
 * @param _path - The path of the directory to be deleted.
 * @returns A Promise that resolves when the directory has been deleted.
 */
export async function deleteProject(_path: string): Promise<void> {
  await Promise.all([fs.rm(_path, { recursive: true, force: true }), unlistProjects([_path])]);
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

/**
 * Imports a project by allowing the user to select a directory.
 *
 * @returns A Promise that resolves to the imported project path.
 * @throws An error if the selected directory is not a valid project.
 */
export async function importProject(): Promise<Project | undefined> {
  const [projectPath] = await invoke('electron.showOpenDialog', {
    title: 'Import project',
    properties: ['openDirectory'],
  });

  const cancelled = !projectPath;

  if (cancelled) return undefined;

  const pathBaseName = path.basename(projectPath);
  const paths = await getWorkspacePaths();
  const [projects] = await getProjects(paths);
  const projectAlreadyExists = projects.find($ => $.path === projectPath);

  if (projectAlreadyExists) {
    throw new Error(`"${pathBaseName}" is already on the projects library`);
  }

  if (!(await isDCL(projectPath))) {
    throw new Error(`"${pathBaseName}" is not a valid project`);
  }

  // update workspace on config file with new path
  await setConfig(config => config.workspace.paths.push(projectPath));

  const project = getProject(projectPath);
  return project;
}

/**
 * Reimports a project by allowing the user to select a new directory for a project whose path was deleted or renamed.
 *
 * @param _path - The current path of the project that needs to be reimported.
 * @returns A Promise that resolves to the reimported Project object.
 * @throws An error if the selected directory is not a valid project.
 */
export async function reimportProject(_path: string): Promise<Project | undefined> {
  const project = await importProject();
  if (project) await unlistProjects([_path]);
  return project;
}

export async function saveThumbnail({
  path: _path,
  thumbnail,
}: {
  path: string;
  thumbnail: string;
}): Promise<void> {
  const scene = await getScene(_path);
  const relativePath = path.join('images', 'scene-thumbnail.png');
  const fullPath = path.join(_path, relativePath);
  scene.display = { ...scene.display, navmapThumbnail: relativePath };
  await Promise.all([
    deepWriteFile(fullPath, thumbnail, { encoding: 'base64' }),
    fs.writeFile(path.join(_path, 'scene.json'), JSON.stringify(scene, null, 2)),
  ]);
}
