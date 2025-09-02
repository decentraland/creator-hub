import path from 'path';
import fs from 'fs/promises';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import log from 'electron-log/main';
import { type EditorConfig } from '/shared/types/config';

import { getConfig } from './config';

const exec = promisify(execCallback);

export enum EditorType {
  VSCode = 'Visual Studio Code',
  Cursor = 'Cursor',
  Notepad = 'Notepad++',
  Sublime = 'Sublime Text',
  Eclipse = 'Eclipse',
}

interface MacAppInfo {
  _name: string;
  path: string;
  version: string;
}

interface MacSystemProfiler {
  SPApplicationsDataType: MacAppInfo[];
}

async function findMacEditors(): Promise<EditorConfig[]> {
  try {
    const { stdout: installedApps } = await exec(
      'system_profiler -detailLevel basic -json SPApplicationsDataType',
    );
    console.log('[MacOS] Command output:', installedApps);
    const data = JSON.parse(installedApps) as MacSystemProfiler;
    const apps = data.SPApplicationsDataType;

    const installedEditorsConfig: EditorConfig[] = [];
    const editorNames = Object.values(EditorType);

    for (const app of apps) {
      const installedEditors = editorNames.find(
        name =>
          app._name.toLowerCase().includes(name.toLowerCase()) ||
          app.path.toLowerCase().includes(name.toLowerCase()),
      );

      if (installedEditors) {
        installedEditorsConfig.push({
          name: installedEditors,
          path: app.path,
          isDefault: false,
        });
      }
    }

    log.info(`[Editor Search] Found ${installedEditorsConfig.length} editors`);
    return installedEditorsConfig;
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
    console.log('[Windows] Command output:', installedApps);
    console.log('[Windows] Parsed apps:', JSON.parse(installedApps));

    const apps = JSON.parse(installedApps);

    const foundEditors: EditorConfig[] = [];
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
              foundEditors.push({
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

    log.info(`[Editor Search] Found ${foundEditors.length} editors`);
    return foundEditors;
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
  const config = await getConfig();
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

export async function addEditorsPathsToConfig() {
  const config = await getConfig();
  const existingEditors = (await config.get('editors')) || [];
  log.info('Existing editors:', existingEditors);

  const foundEditors =
    process.platform === 'darwin' ? await findMacEditors() : await findWindowsEditors();

  log.info('Found editors:', foundEditors);

  const newEditors = foundEditors.filter(
    editor => !existingEditors.find(existing => existing.name === editor.name),
  );

  log.info(' New editors to add:', newEditors);

  if (newEditors.length > 0 || !existingEditors.length) {
    const allEditors = [...existingEditors];

    for (const editor of newEditors) {
      const existingEditor = existingEditors.find(e => e.name === editor.name);
      if (existingEditor) {
        existingEditor.path = editor.path;
      } else {
        allEditors.push(editor);
      }
    }

    const hasDefault = allEditors.some(editor => editor.isDefault);
    if (!hasDefault) {
      const vscode = allEditors.find(editor => editor.name === EditorType.VSCode);
      if (vscode) {
        vscode.isDefault = true;
        log.info('[Editor Discovery] Set VS Code as default editor');
      } else if (allEditors.length > 0) {
        allEditors[0].isDefault = true;
        log.info(`[Editor Discovery] Set ${allEditors[0].name} as default editor`);
      }
    }

    await config.set('editors', allEditors);
    log.info('[Editor Discovery] Updated config with editors:', allEditors);
  }
}
