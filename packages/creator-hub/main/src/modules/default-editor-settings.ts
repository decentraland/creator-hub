import path from 'path';
import fs from 'fs/promises';
import log from 'electron-log/main';
import { type EditorConfig } from '/shared/types/config';
import { getConfig } from './config';

export enum EditorType {
  VSCode = 'Visual Studio Code',
  Cursor = 'Cursor',
}

const EDITOR_PATHS = {
  win32: {
    [EditorType.VSCode]: (username: string) => [
      `C:\\Users\\${username}\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe`,
      'C:\\Program Files\\Microsoft VS Code\\Code.exe',
    ],
    [EditorType.Cursor]: (username: string) => [
      `C:\\Users\\${username}\\AppData\\Local\\Programs\\Cursor\\Cursor.exe`,
      'C:\\Program Files\\Cursor\\Cursor.exe',
    ],
  },
  darwin: {
    [EditorType.VSCode]: [
      '/Applications/Visual Studio Code.app',
      '~/Applications/Visual Studio Code.app',
    ],
    [EditorType.Cursor]: ['/Applications/Cursor.app', '~/Applications/Cursor.app'],
  },
};

async function validateEditor(editor: EditorConfig): Promise<boolean> {
  try {
    if (process.platform === 'darwin') {
      const macosPath = path.join(editor.path, 'Contents', 'MacOS');
      await fs.stat(macosPath);
    } else {
      await fs.stat(editor.path);
    }
    return true;
  } catch {
    return false;
  }
}

export async function getEditors() {
  const config = await getConfig();
  const editors = (await config.get('editors')) || [];

  const validEditors = [];
  let defaultFound = false;

  for (const editor of editors) {
    if (await validateEditor(editor)) {
      validEditors.push(editor);
      if (editor.isDefault) {
        defaultFound = true;
      }
    } else {
      log.info(`Editor ${editor.name} at ${editor.path} no longer exists, removing from config`);
    }
  }

  if (!defaultFound && validEditors.length > 0) {
    validEditors[0].isDefault = true;
  }

  if (validEditors.length !== editors.length) {
    await config.set('editors', validEditors);
  }

  return validEditors;
}

export async function setDefaultEditor(editorPath: string) {
  const config = await getConfig();
  const editors = (await config.get('editors')) || [];

  let name: string;
  if (process.platform === 'darwin') {
    const fileName = editorPath.split('/').pop() || '';
    if (!fileName.endsWith('.app')) {
      throw new Error('Invalid application selected. Please select a valid .app bundle.');
    }

    const macosPath = path.join(editorPath, 'Contents', 'MacOS');
    try {
      await fs.stat(macosPath);
    } catch {
      throw new Error('Invalid application bundle structure. Missing Contents/MacOS directory.');
    }
    name = fileName.replace('.app', '');
  } else {
    name = editorPath.split('\\').pop()?.replace('.exe', '') || 'Custom Editor';
  }

  const existingIndex = editors.findIndex(e => e.name === name);
  const updatedEditors = editors.map(editor => ({
    ...editor,
    isDefault: false,
  }));

  if (existingIndex >= 0) {
    updatedEditors[existingIndex] = {
      ...updatedEditors[existingIndex],
      path: editorPath,
      isDefault: true,
    };
  } else {
    updatedEditors.push({
      name,
      path: editorPath,
      isDefault: true,
    });
  }

  await config.set('editors', updatedEditors);
  return updatedEditors;
}

export async function addEditorsPathsToConfig() {
  const config = await getConfig();
  const existingEditors = (await config.get('editors')) || [];
  const platform = process.platform as 'win32' | 'darwin';
  const username = platform === 'win32' ? process.env.USERNAME || '' : '';

  const findEditorPath = async (type: EditorType): Promise<string | null> => {
    const paths =
      platform === 'win32' ? EDITOR_PATHS.win32[type](username) : EDITOR_PATHS.darwin[type];

    for (const path of paths) {
      try {
        await fs.stat(path);
        return path;
      } catch {
        return null;
      }
    }
    return null;
  };

  const foundEditors: EditorConfig[] = [];
  const vscodePath = await findEditorPath(EditorType.VSCode);
  if (vscodePath) {
    foundEditors.push({
      name: EditorType.VSCode,
      path: vscodePath,
      isDefault: true,
    });
  }

  const cursorPath = await findEditorPath(EditorType.Cursor);
  if (cursorPath) {
    foundEditors.push({
      name: EditorType.Cursor,
      path: cursorPath,
      isDefault: !vscodePath,
    });
  }

  const newEditors = foundEditors.filter(
    editor => !existingEditors.find(existing => existing.name === editor.name),
  );

  if (newEditors.length > 0) {
    const allEditors = [...existingEditors, ...newEditors];
    await config.set('editors', allEditors);
  }
}
