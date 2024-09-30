import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, type UUID } from 'node:crypto';
import type { Scene } from '@dcl/schemas';
import { shell } from 'electron';
import equal from 'fast-deep-equal';

import { SortBy, type Project } from '/shared/types/projects';
import type { Template, Workspace } from '/shared/types/workspace';
import { FileSystemStorage } from '/shared/types/storage';

import { getConfig, setConfig } from './config';
import { exists, writeFile as deepWriteFile } from './fs';
import { hasDependency } from './pkg';
import { getRowsAndCols, parseCoords } from './scene';
import { getEditorHome } from './editor';
import { invoke } from './invoke';
import { getScenesPath } from './settings';

import { DEFAULT_THUMBNAIL, NEW_SCENE_NAME, EMPTY_SCENE_TEMPLATE_REPO } from './constants';

/**
 * Get scene json
 */
function getScenePath(_path: string): string {
  return path.join(_path, 'scene.json');
}

export async function getScene(_path: string): Promise<Scene> {
  const scene = await fs.readFile(getScenePath(_path), 'utf8');
  return JSON.parse(scene);
}

export async function getProjectId(_path: string): Promise<UUID> {
  const projectInfoPath = path.join(await getEditorHome(_path), 'project.json');
  const projectInfo = new FileSystemStorage(projectInfoPath);
  const hasId = await projectInfo.has('id');
  if (!hasId) {
    const projectId = randomUUID();
    await projectInfo.set('id', projectId);
    return projectId;
  }
  return projectInfo.get<UUID>('id');
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

export async function getProjectThumbnailPath(_path: string) {
  const editorHomePath = await getEditorHome(_path);
  return path.join(editorHomePath, 'images', 'project-thumbnail.png');
}

export async function getProjectThumbnailAsBase64(
  projectPath: string,
  scene: Scene,
): Promise<string> {
  try {
    const thumbnailPath = path.join(projectPath, scene.display?.navmapThumbnail || '');
    return (await fs.readFile(thumbnailPath)).toString('base64');
  } catch (e) {
    try {
      // if there is no thumbnail defined in scene.json, use the auto-generated one from .editor directory
      const thumbnailPath = await getProjectThumbnailPath(projectPath);
      return (await fs.readFile(thumbnailPath)).toString('base64');
    } catch (_) {
      console.warn(`Could not get project thumbnail for project in ${projectPath}`, e);
      return DEFAULT_THUMBNAIL;
    }
  }
}

export async function getProject(_path: string): Promise<Project> {
  try {
    const id = await getProjectId(_path);
    const scene = await getScene(_path);
    const parcels = scene.scene.parcels.map($ => parseCoords($));

    const stat = await fs.stat(_path);

    return {
      id,
      path: _path,
      title: scene.display?.title || 'Untitled scene',
      description: scene.display?.description,
      thumbnail: await getProjectThumbnailAsBase64(_path, scene),
      layout: getRowsAndCols(parcels),
      createdAt: Number(stat.birthtime),
      updatedAt: Number(stat.mtime),
      size: stat.size,
      worldConfiguration: scene?.worldConfiguration,
    };
  } catch (error: any) {
    throw new Error(`Could not get scene.json info for project in "${_path}": ${error.message}`);
  }
}

export async function getPath() {
  const appHome = await getScenesPath();
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

/**
 * Fetches a list of templates and filters them by scene type.
 * @returns {Promise<Template[]>} A promise that resolves to an array of Template objects.
 * @throws {Error} If the fetch request fails or if the response is not in the expected format.
 */
export async function getTemplates(): Promise<Template[]> {
  try {
    const response = await fetch('https://studios.decentraland.org/api/get/resources');
    const templates: Template[] = (await response.json()) as Template[];
    return templates.filter($ => $.scene_type?.includes('Scene template'));
  } catch (e) {
    console.warn('[Preload] Could not get templates', e);
    return [];
  }
}

/**
 * Returns workspace info
 */
export async function getWorkspace(): Promise<Workspace> {
  const config = await getConfig();
  const [projects, missing] = await getProjects(config.workspace.paths);
  const templates = await getTemplates();

  return {
    sortBy: SortBy.NEWEST, // TODO: read from editor config file...
    projects,
    missing,
    templates,
  };
}

/**
 * Creates a new project with the given options.
 *
 * This function generates a new project folder with a unique name (if a project with the same name already exists)
 * and initializes it using a specified repository template. It also updates the project’s `scene.json` file and
 * adds the project path to the user's workspace configuration.
 *
 * @param {Object} [opts] - Options for creating the project.
 * @param {string} [opts.name] - The desired name for the project. Defaults to a new scene name.
 * @param {string} [opts.repo] - The repository to use as the template. Defaults to an empty scene template repository.
 * @returns {Promise<Project>} - A promise that resolves to the created project.
 */
export async function createProject(opts?: { name?: string; repo?: string }): Promise<Project> {
  const { name, repo } = {
    name: opts?.name ?? NEW_SCENE_NAME,
    repo: opts?.repo ?? EMPTY_SCENE_TEMPLATE_REPO,
  };

  let sceneName = name;
  let counter = 2;
  const homePath = await getPath();
  let projectPath = path.join(homePath, sceneName);
  while (await exists(projectPath)) {
    sceneName = `${name} ${counter++}`;
    projectPath = path.join(homePath, sceneName);
  }
  await fs.mkdir(projectPath);
  await invoke('cli.init', projectPath, repo);
  const scene = await getScene(projectPath);
  scene.display!.title = sceneName;
  // TODO: Fix: Remove worldConfiguration in the scene.json of the templates
  if (repo !== EMPTY_SCENE_TEMPLATE_REPO) {
    delete scene.worldConfiguration;
  }
  const sceneJsonPath = path.join(projectPath, 'scene.json');
  await fs.writeFile(sceneJsonPath, JSON.stringify(scene, null, 2));
  const project = await getProject(projectPath);
  await setConfig(config => config.workspace.paths.push(projectPath));
  return project;
}

/**
 * Updates the project's information in the scene.json file.
 *
 * @param {Project} project - The Project object containing the updated information.
 * @returns {Promise<Project>} A Promise that resolves to the updated Project object.
 * @throws {Error} An error if the scene.json file cannot be updated.
 */
export async function updateProject(project: Project): Promise<Project> {
  // TODO: Update all properties associated to a project in the scene.json
  try {
    const scene = await getScene(project.path);

    let updatedScene = JSON.parse(JSON.stringify(scene));

    // Clean up the property navmapThumbnail if the define path doesn't exists
    if (updatedScene.display?.navmapThumbnail) {
      const navmapThumbnail = path.join(project.path, updatedScene.display.navmapThumbnail);
      if (!(await exists(navmapThumbnail))) {
        updatedScene.display.navmapThumbnail = '';
      }
    }

    updatedScene = {
      ...updatedScene,
      ...(project?.worldConfiguration
        ? {
            worldConfiguration: {
              ...project.worldConfiguration,
            },
          }
        : {}),
    };

    if (!equal(updatedScene, scene)) {
      await deepWriteFile(getScenePath(project.path), JSON.stringify(updatedScene, null, 2), {
        encoding: 'utf8',
      });
    }

    return getProject(project.path);
  } catch (error: any) {
    throw new Error(
      `Could not update the scene.json info with project in "${project.path}": ${error.message}`,
    );
  }
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
  await unlistProjects([_path]);
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
  const config = await getConfig();
  const [projects] = await getProjects(config.workspace.paths);
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

/**
 * Saves a thumbnail image to a specified path.
 *
 * @param {Object} params - The parameters for the function.
 * @param {string} params.path - The path where the thumbnail will be saved.
 * @param {string} params.thumbnail - The base64-encoded string of the thumbnail image.
 * @returns {Promise<void>} A promise that resolves when the thumbnail has been saved.
 */
export async function saveThumbnail({
  path: _path,
  thumbnail,
}: {
  path: string;
  thumbnail: string;
}): Promise<void> {
  await deepWriteFile(await getProjectThumbnailPath(_path), thumbnail, { encoding: 'base64' });
}

export async function openFolder(_path: string) {
  const error = await shell.openPath(_path);
  if (error) {
    throw new Error(error);
  }
}
