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

function findEditorExecutable(files: string[], editorName: string): string | null {
  // In Windows we look for .exe files, in Mac all files are potential executables
  const executables =
    process.platform === 'win32'
      ? files.filter(file => file.toLowerCase().endsWith('.exe'))
      : files;

  if (executables.length === 1) {
    return executables[0];
  }

  const editorWords = editorName.toLowerCase().split(/\s+/);
  const validExecutables = executables.filter(file => {
    const fileName = file.toLowerCase();
    if (fileName.includes('unins') || fileName.includes('setup')) return false;

    const hasElectron = fileName.includes('electron');
    const matchingWords = editorWords.filter(word => fileName.includes(word));

    return hasElectron || matchingWords.length > 0;
  });

  log.info(`[Editor Search] Found executable for ${editorName}:`, validExecutables[0] || 'none');
  return validExecutables[0] || null;
}

async function findMacEditors(): Promise<EditorConfig[]> {
  try {
    const { stdout: installedApps } = await exec(
      'system_profiler -detailLevel basic -json SPApplicationsDataType',
    );

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
        const macosPath = path.join(app.path, 'Contents', 'MacOS');
        log.info(`[Mac Search] Looking in MacOS directory: ${macosPath}`);

        try {
          const files = await fs.readdir(macosPath);
          log.info('[Mac Search] Found files in MacOS directory:', files);
          const executablePath = findEditorExecutable(files, editorName);

          if (executablePath) {
            const fullPath = path.join(macosPath, executablePath);
            log.info(`[Editor Found] ${editorName} at executable path: ${fullPath}`);
            installedEditorsFound.push({
              name: editorName,
              path: fullPath,
              isDefault: false,
            });
          } else {
            log.warn(`[Editor Search] Found ${editorName} but no valid executable in ${macosPath}`);
          }
        } catch (error) {
          log.error(`[Editor Search] Error reading directory: ${app.path}`, error);
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

    const apps = JSON.parse(installedApps);

    const installedEditorsFound: EditorConfig[] = [];
    const editorNames = Object.values(EditorType);

    for (const app of apps) {
      const installedEditors = editorNames.find(name => {
        const editorName = name.toLowerCase();
        const displayName = app.DisplayName?.toLowerCase() || '';
        const found = displayName.includes(editorName);

        return found;
      });

      if (installedEditors && app.InstallLocation) {
        try {
          const files = await fs.readdir(app.InstallLocation);
          log.info(
            `[Windows Search] Reading directory ${app.InstallLocation}. Found files:`,
            files,
          );
          log.info(`[Windows Search] Looking for editor ${installedEditors}`);

          const exePath = findEditorExecutable(files, installedEditors);

          if (exePath) {
            const fullPath = path.join(app.InstallLocation, exePath);
            try {
              await fs.stat(fullPath);
              log.info(`[Editor Found] ${installedEditors} at path: ${fullPath}`);
              installedEditorsFound.push({
                name: installedEditors,
                path: fullPath,
                isDefault: false,
              });
            } catch (error) {
              log.warn(
                `[Editor Search] Found ${installedEditors} but executable not found at ${fullPath}`,
              );
            }
          }
        } catch (error) {
          log.error(`[Windows Search] Error reading directory ${app.InstallLocation}:`, error);
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

export async function getEditors() {
  const config = await getConfigStorage();
  const editors = (await config.get('editors')) || [];
  log.info('[Editor Config] Current editors in config:', editors);

  const validEditors = [];
  let configNeedsUpdate = false;

  for (const editor of editors) {
    try {
      await fs.stat(editor.path);
      validEditors.push(editor);
    } catch {
      log.info(`[Editor Config] Removing ${editor.name} - Not found at ${editor.path}`);
      configNeedsUpdate = true;
    }
  }

  if (configNeedsUpdate) {
    log.info('[Editor Config] Updating config - Removed editors that no longer exist');
    await config.set('editors', validEditors);
  }

  return validEditors;
}

export async function addEditor(editorPath: string): Promise<EditorConfig[]> {
  let name: string;
  let executablePath: string;
  try {
    await fs.stat(editorPath);
  } catch {
    throw new Error('file_not_found');
  }

  if (process.platform === 'darwin') {
    const fileName = path.basename(editorPath);
    if (!fileName.endsWith('.app')) {
      throw new Error('invalid_app_extension');
    }

    const macosPath = path.join(editorPath, 'Contents', 'MacOS');
    const files = await fs.readdir(macosPath);
    try {
      const stats = await fs.stat(macosPath);
      if (!stats.isDirectory()) {
        throw new Error('invalid_app_bundle');
      }
    } catch {
      throw new Error('invalid_app_bundle');
    }

    const macExecutablePath = findEditorExecutable(files, fileName.replace('.app', ''));

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

  const existingIndex = editors.findIndex(e => e.name === name);

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

export async function removeEditor(editorPath: string): Promise<EditorConfig[]> {
  const config = await getConfigStorage();
  const editors = (await config.get('editors')) || [];

  const newEditors = editors.filter(editor => editor.path !== editorPath);
  await config.set('editors', newEditors);

  return newEditors;
}

export async function setDefaultEditor(editorPath: string): Promise<EditorConfig[]> {
  const config = await getConfigStorage();
  const editors = (await config.get('editors')) || [];

  const editorToSet = editors.find(editor => editor.path === editorPath);
  if (!editorToSet) {
    throw new Error('editor_not_found');
  }

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

export async function open(_path: string) {
  const normalizedPath = path.normalize(_path);
  const config = await getConfigStorage();
  const editors = (await config.get('editors')) || [];
  const defaultEditor = editors.find(editor => editor.isDefault);

  log.info('Default editor:', defaultEditor);

  try {
    if (defaultEditor) {
      log.info('Opening with default editor:', defaultEditor.name, 'at path:', defaultEditor.path);
      const command = `"${defaultEditor.path}" "${normalizedPath}"`;
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
