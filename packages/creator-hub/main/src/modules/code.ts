import path from 'path';
import fs from 'fs/promises';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import log from 'electron-log/main';
import { shell } from 'electron';

import { type EditorConfig } from '/shared/types/config';
import { EditorType } from '/shared/types/code';
import { track } from './analytics';
import { getConfigStorage } from './config';

const exec = promisify(execCallback);

function getPath() {
  return process.env.PATH || '';
}

interface MacAppInfo {
  _name: string;
  path: string;
  version: string;
}

interface MacSystemProfiler {
  SPApplicationsDataType: MacAppInfo[];
}

async function getMacOSExecutable(editor: { path: string; name: string }): Promise<string | null> {
  const macosPath = path.join(editor.path, 'Contents', 'MacOS');

  try {
    const files = await fs.readdir(macosPath);

    if (!files.length) {
      return null;
    }

    // Si hay un solo archivo, verificamos que sea ejecutable
    if (files.length === 1) {
      const executablePath = path.join(macosPath, files[0]);
      try {
        const stats = await fs.stat(executablePath);
        if (stats.isFile() && stats.mode & 0o111) {
          return executablePath;
        }
      } catch (error) {
        log.error(`Error checking file ${files[0]}:`, error);
      }
      return null;
    }

    const editorWords = editor.name.toLowerCase().split(/\s+/);
    let firstExecutable: string | null = null;
    let preferredExecutable: string | null = null;

    // Si hay múltiples archivos, buscamos el que mejor coincida
    for (const fileName of files) {
      const executablePath = path.join(macosPath, fileName);

      try {
        const stats = await fs.stat(executablePath);
        if (!stats.isFile() || !(stats.mode & 0o111)) continue;

        if (!firstExecutable) {
          firstExecutable = executablePath;
        }

        if (editorWords.some(word => fileName.toLowerCase().includes(word))) {
          preferredExecutable = executablePath;
          break;
        }
      } catch (error) {
        log.error(`Error checking file ${fileName}:`, error);
      }
    }

    return preferredExecutable || firstExecutable;
  } catch (error) {
    log.error(`Error reading MacOS directory: ${macosPath}`, error);
    return null;
  }
}

export async function open(_path: string) {
  const normalizedPath = path.normalize(_path);
  const config = await getConfigStorage();
  const editors = (await config.get('editors')) || [];
  const defaultEditor = editors.find(editor => editor.isDefault);

  log.info('Available editors:', editors);
  log.info('Default editor:', defaultEditor);

  try {
    if (defaultEditor) {
      log.info('Opening with default editor:', defaultEditor.name, 'at path:', defaultEditor.path);

      const command = `"${defaultEditor.path}" "${normalizedPath}"`;
      log.info('Executing command:', command);
      await exec(command, {
        env: { ...process.env, PATH: getPath() },
      });
      await track('Open Code', undefined);
    } else {
      log.info('No default editor found, falling back to system default');
      await shell.openPath(normalizedPath);
    }
  } catch (error) {
    log.info(
      'Failed to open with configured editor, falling back to system default. Error:',
      error,
    );
    await shell.openPath(normalizedPath);
  }
}

async function findMacEditors(): Promise<EditorConfig[]> {
  try {
    const { stdout: installedApps } = await exec(
      'system_profiler -detailLevel basic -json SPApplicationsDataType',
    );
    log.info('[MacOS] Command output:', installedApps);
    const data = JSON.parse(installedApps) as MacSystemProfiler;
    const apps = data.SPApplicationsDataType;

    const installedEditorsFound: EditorConfig[] = [];
    const editorNames = Object.values(EditorType);

    for (const app of apps) {
      const editorName = editorNames.find(
        name =>
          app._name.toLowerCase().includes(name.toLowerCase()) ||
          app.path.toLowerCase().includes(name.toLowerCase()),
      );

      if (editorName) {
        const executablePath = await getMacOSExecutable({
          path: app.path,
          name: editorName,
        });

        if (executablePath) {
          log.info(`[Editor Found] ${editorName} at executable path: ${executablePath}`);
          installedEditorsFound.push({
            name: editorName,
            path: executablePath,
            isDefault: false,
          });
        } else {
          log.warn(`[Editor Search] Found ${editorName} but no valid executable in ${app.path}`);
        }
      }
    }

    log.info(
      `[Editor Search] Found ${installedEditorsFound.length} editors with valid executables`,
    );
    return installedEditorsFound;
  } catch (error) {
    log.error('[Editor Search] Error executing system_profiler:', error);
    return [];
  }
}

async function findWindowsEditors(): Promise<EditorConfig[]> {
  log.info('[Editor Search] Starting Windows editor discovery');
  try {
    const command =
      'Get-ItemProperty "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*","HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*","HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" | Where-Object InstallLocation | Select-Object DisplayName,InstallLocation | ConvertTo-Json';

    const { stdout: installedApps } = await exec(
      `powershell.exe -Command "${command.replace(/"/g, '\\"')}"`,
    );
    log.info('[Windows] Command output:', installedApps);
    log.info('[Windows] Parsed apps:', JSON.parse(installedApps));

    const apps = JSON.parse(installedApps);

    const installedEditorsFound: EditorConfig[] = [];
    const editorNames = Object.values(EditorType);

    for (const app of apps) {
      const installedEditors = editorNames.find(name =>
        app.DisplayName?.toLowerCase().includes(name.toLowerCase()),
      );

      if (installedEditors && app.InstallLocation) {
        try {
          const files = await fs.readdir(app.InstallLocation);
          const executables = files.filter(file => {
            const lowerFile = file.toLowerCase();
            const editorName = installedEditors.toLowerCase().replace(/[^a-z0-9]/gi, '');
            return (
              lowerFile.endsWith('.exe') &&
              lowerFile.includes(editorName) &&
              !lowerFile.includes('uninstall')
            );
          });

          let exePath = '';
          if (executables.length === 1) {
            exePath = path.join(app.InstallLocation, executables[0]);
          } else if (executables.length > 1) {
            const editorName = installedEditors.toLowerCase().replace(/[^a-z0-9]/gi, '');
            const bestMatch = executables.reduce((best, current) => {
              const currentLower = current.toLowerCase();
              const bestLower = best.toLowerCase();

              if (currentLower === editorName + '.exe') return current;
              if (bestLower === editorName + '.exe') return best;

              return currentLower.length < bestLower.length ? current : best;
            });
            exePath = path.join(app.InstallLocation, bestMatch);
          }

          if (exePath) {
            try {
              await fs.stat(exePath);
              log.info(`[Editor Found] ${installedEditors} at path: ${exePath}`);
              installedEditorsFound.push({
                name: installedEditors,
                path: exePath,
                isDefault: false,
              });
            } catch (error) {
              log.warn(
                `[Editor Search] Found ${installedEditors} but executable not found at ${exePath}`,
              );
            }
          }
        } catch (error) {
          log.error(`[Editor Search] Error reading directory ${app.InstallLocation}:`, error);
        }
      }
    }

    log.info(`[Editor Search] Found ${installedEditorsFound.length} editors`);
    return installedEditorsFound;
  } catch (error) {
    log.error('[Editor Search] Error executing PowerShell command:', error);
    return [];
  }
}

async function editorStillInstalled(editor: EditorConfig): Promise<boolean> {
  try {
    await fs.stat(editor.path);
    log.info(`[Editor Validation] Editor ${editor.path} validation successful`);
    return true;
  } catch {
    log.info(`[Editor Validation] Editor ${editor.path} validation failed - path does not exist`);
    return false;
  }
}

export async function getEditors() {
  const config = await getConfigStorage();
  const editors = (await config.get('editors')) || [];
  log.info('[Editor Config] Current editors in config:', editors);

  const validEditors: EditorConfig[] = [];

  for (const editor of editors) {
    if (await editorStillInstalled(editor)) {
      validEditors.push(editor);
    } else {
      log.info(
        `[Editor Config] Editor ${editor.name} at ${editor.path} no longer exists, removing from config`,
      );
    }
  }

  if (validEditors.length !== editors.length) {
    await config.set('editors', validEditors);
    log.info('[Editor Config] Updated config with valid editors:', validEditors);
  }

  return validEditors;
}

export async function addEditor(editorPath: string): Promise<EditorConfig[]> {
  let name: string;
  let executablePath: string;

  // First validate that the path exists
  try {
    await fs.stat(editorPath);
  } catch {
    throw new Error('file_not_found');
  }

  // Validate and get the executable path based on platform
  if (process.platform === 'darwin') {
    const fileName = path.basename(editorPath);
    if (!fileName.endsWith('.app')) {
      throw new Error('invalid_app_extension');
    }

    // Check if it's a valid app bundle
    const macosPath = path.join(editorPath, 'Contents', 'MacOS');
    try {
      const stats = await fs.stat(macosPath);
      if (!stats.isDirectory()) {
        throw new Error('invalid_app_bundle');
      }
    } catch {
      throw new Error('invalid_app_bundle');
    }

    const macExecutablePath = await getMacOSExecutable({
      path: editorPath,
      name: fileName.replace('.app', ''),
    });

    if (!macExecutablePath) {
      throw new Error('invalid_app_bundle');
    }

    executablePath = macExecutablePath;
    name = fileName.replace('.app', '');
  } else {
    const fileName = path.basename(editorPath);
    if (!fileName.endsWith('.exe')) {
      throw new Error('invalid_exe_file');
    }

    executablePath = editorPath;
    name = fileName.replace('.exe', '') || 'Custom Editor';
  }

  const config = await getConfigStorage();
  const editors = (await config.get('editors')) || [];

  // Update editors list
  const existingIndex = editors.findIndex(e => e.name === name);

  // Set all editors to non-default
  editors.forEach(editor => {
    editor.isDefault = false;
  });

  if (existingIndex >= 0) {
    editors[existingIndex].path = executablePath;
    editors[existingIndex].isDefault = true;
  } else {
    editors.push({
      name,
      path: executablePath,
      isDefault: true,
    });
  }

  await config.set('editors', editors);
  return editors;
}

export async function setDefaultEditor(editorPath: string): Promise<EditorConfig[]> {
  const config = await getConfigStorage();
  const editors = (await config.get('editors')) || [];

  // Find editor by path
  const editorToSet = editors.find(editor => editor.path === editorPath);
  if (!editorToSet) {
    throw new Error('editor_not_found');
  }

  // Update default status
  editors.forEach(editor => {
    editor.isDefault = editor.path === editorPath;
  });

  await config.set('editors', editors);
  return editors;
}

export async function addEditorsPathsToConfig() {
  const config = await getConfigStorage();
  const currentEditorsConfig = (await config.get('editors')) || [];
  log.info('Existing editors:', currentEditorsConfig);

  const installedEditorsFound =
    process.platform === 'darwin' ? await findMacEditors() : await findWindowsEditors();

  log.info('Found editors:', installedEditorsFound);

  const newEditors = installedEditorsFound.filter(
    editor => !currentEditorsConfig.find(existing => existing.name === editor.name),
  );

  log.info(' New editors to add:', newEditors);

  if (newEditors.length > 0 || !currentEditorsConfig.length) {
    const allEditors = [...currentEditorsConfig];

    for (const editor of newEditors) {
      const existingEditor = currentEditorsConfig.find(e => e.name === editor.name);
      if (existingEditor) {
        existingEditor.path = editor.path;
      } else {
        allEditors.push(editor);
      }
    }

    const hasDefaultEditor = allEditors.some(editor => editor.isDefault);

    if (!hasDefaultEditor) {
      const vscode = allEditors.find(editor => editor.name === EditorType.VSCode);
      if (vscode) {
        // Set VS Code as default editor if it exists
        vscode.isDefault = true;
        log.info('[Editor Discovery] Set VS Code as default editor');
      } else if (allEditors.length > 0) {
        // Set the first editor as default editor if no default editor is found
        allEditors[0].isDefault = true;
        log.info(`[Editor Discovery] Set ${allEditors[0].name} as default editor`);
      }
    }

    await config.set('editors', allEditors);
    log.info('[Editor Discovery] Updated config with editors:', allEditors);
  }
}
