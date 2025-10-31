import type { IEngine, OnChangeFunction } from '@dcl/ecs';

import type { DataLayerRpcServer, FileSystemInterface } from '../types';
import { readPreferencesFromFile, serializeInspectorPreferences } from '../../logic/preferences/io';
import type { AssetData } from '../../logic/catalog';
import type { InspectorPreferences } from '../../logic/preferences/types';
import { EditorComponentNames } from '../../sdk/components/types';
import {
  DIRECTORY,
  EXTENSIONS,
  getCurrentCompositePath,
  getFilesInDirectory,
  withAssetDir,
} from './fs-utils';
import type { FileOperation } from './undo-redo-provider';
import upsertAsset from './upsert-asset';
import { installBin } from './utils/install-bin';
import { StateManager } from './state-manager';
import { SceneProvider } from './scene-provider';
import { CompositeProvider } from './composite-provider';
import { UndoRedoProvider } from './undo-redo-provider';
import { createStream } from './stream';

const INSPECTOR_PREFERENCES_PATH = 'inspector-preferences.json';

function getIgnoredUndoRedoComponents() {
  return [EditorComponentNames.Selection, EditorComponentNames.TransformConfig];
}

export async function initRpcMethods(
  fs: FileSystemInterface,
  engine: IEngine,
  addEngineListener: (fn: OnChangeFunction) => void,
): Promise<DataLayerRpcServer & { engine: IEngine }> {
  const currentCompositeResourcePath = getCurrentCompositePath();
  let inspectorPreferences = await readPreferencesFromFile(fs, INSPECTOR_PREFERENCES_PATH);
  const getInspectorPreferences = () => inspectorPreferences;
  const setInspectorPreferences = (value: InspectorPreferences) => {
    inspectorPreferences = value;
    fs.writeFile(INSPECTOR_PREFERENCES_PATH, serializeInspectorPreferences(value));
  };
  const getComposite = () => stateManager.getComposite();

  const stateManager = new StateManager({
    fs,
    engine,
    getInspectorPreferences,
    compositePath: currentCompositeResourcePath,
  });

  addEngineListener(stateManager.createOnChangeHandler()); // register state manager to engine changes

  const sceneProvider = await SceneProvider.create(fs);
  const compositeProvider = await CompositeProvider.create(
    fs,
    engine,
    getInspectorPreferences,
    currentCompositeResourcePath,
  );
  const undoRedoProvider = await UndoRedoProvider.create(fs, engine, getComposite, {
    enableValidation: true,
    enableStateVerification: true,
    persistToStorage: false, // disabled for now
    ignoredComponents: getIgnoredUndoRedoComponents(),
  });

  // order here matters!!!!: undo-redo, scene, composite
  stateManager.registerProvider(undoRedoProvider);
  stateManager.registerProvider(sceneProvider);
  stateManager.registerProvider(compositeProvider);

  await installBin(fs);

  return {
    engine,
    async redo() {
      return stateManager.executeTransaction('redo', async () => {
        return undoRedoProvider.redo();
      });
    },

    async undo() {
      return stateManager.executeTransaction('undo', async () => {
        return undoRedoProvider.undo();
      });
    },

    async getUndoRedoState() {
      const historySize = undoRedoProvider.getHistorySize();
      return {
        canUndo: historySize.undoCount > 0,
        canRedo: historySize.redoCount > 0,
      };
    },

    crdtStream(iter) {
      return createStream(iter, { engine });
    },

    async getAssetData(req) {
      if (!req.path) throw new Error('Invalid path');
      if (await fs.existFile(req.path)) {
        return {
          data: await fs.readFile(req.path),
        };
      }
      throw new Error(`Couldn't find the asset ${req.path}`);
    },

    async getFiles({ path, ignore = [] }) {
      const filesInDir = await getFilesInDirectory(fs, path, [], true, ignore);
      const files = await Promise.all(
        filesInDir.map(async $ => ({
          path: $,
          content: await fs.readFile($),
        })),
      );
      return { files };
    },

    async getFilesSizes({ path, ignore = [] }) {
      const ignoredFiles = ['.git', 'node_modules', ...ignore];
      const filesInDir = await getFilesInDirectory(fs, path, [], true, ignoredFiles);
      const files = await Promise.all(
        filesInDir.map(async $ => {
          const content = await fs.readFile($);
          return { path: $, size: content.length };
        }),
      );
      return { files };
    },

    async removeFiles(req) {
      return stateManager.executeTransaction('external', async () => {
        const filePaths = req.filePaths;
        const success: string[] = [];
        const failed: string[] = [];
        for (const path of filePaths) {
          try {
            if (await fs.existFile(path)) {
              await fs.rm(path);
              success.push(path);
            } else {
              failed.push(path);
            }
          } catch (e) {
            console.error(`Failed to delete ${path}:`, e);
            failed.push(path);
          }
        }
        return { success, failed };
      });
    },

    async saveFile({ path, content }) {
      await fs.writeFile(path, Buffer.from(content));
      return {};
    },

    async getAssetCatalog() {
      const ignore = ['.git', 'node_modules'];
      const basePath = withAssetDir();

      const assets = (await getFilesInDirectory(fs, basePath, [], true, ignore)).filter(item => {
        const itemLower = item.toLowerCase();
        return EXTENSIONS.some(ext => itemLower.endsWith(ext));
      });

      return { basePath, assets: assets.map($ => ({ path: $ })) };
    },

    async importAsset({ assetPackageName, basePath, content }) {
      return stateManager.executeTransaction('external', async () => {
        const baseFolder = basePath.length ? basePath + '/' : '';
        const undoAcc: FileOperation[] = [];

        for (const [fileName, fileContent] of content) {
          const importName = assetPackageName ? `${assetPackageName}/${fileName}` : fileName;
          const filePath = (baseFolder + importName).replaceAll('//', '/');
          const prevValue = (await fs.existFile(filePath)) ? await fs.readFile(filePath) : null;
          undoAcc.push({ prevValue, newValue: fileContent, path: filePath });
          await upsertAsset(fs, filePath, fileContent);
        }

        if (undoAcc.length > 0) {
          undoRedoProvider.addUndoFile(undoAcc);
        }
        return {};
      });
    },

    async removeAsset(req) {
      return stateManager.executeTransaction('external', async () => {
        const filePath = req.path;
        if (await fs.existFile(filePath)) {
          const prevValue = await fs.readFile(filePath);
          await fs.rm(filePath);
          undoRedoProvider.addUndoFile([{ prevValue, newValue: null, path: filePath }]);
        }
        return {};
      });
    },

    async save() {
      await compositeProvider.saveComposite(true);
      return {};
    },

    async getInspectorPreferences() {
      return getInspectorPreferences();
    },

    async setInspectorPreferences(req) {
      setInspectorPreferences(req);
      return {};
    },

    async copyFile(req) {
      return stateManager.executeTransaction('external', async () => {
        const content = await fs.readFile(req.fromPath);
        const prevValue = (await fs.existFile(req.toPath)) ? await fs.readFile(req.toPath) : null;
        await fs.writeFile(req.toPath, content);

        undoRedoProvider.addUndoFile([{ prevValue, newValue: content, path: req.toPath }]);
        return {};
      });
    },

    async getFile(req) {
      const content = await fs.readFile(req.path);
      return { content };
    },

    async createCustomAsset(req) {
      return stateManager.executeTransaction('external', async () => {
        const { name, composite, resources, thumbnail } = req;

        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/(^_|_$)/g, '');

        const basePath = `${DIRECTORY.CUSTOM}`;
        let customAssetPath = `${basePath}/${slug}`;
        let counter = 1;
        while (await fs.existFile(`${customAssetPath}/data.json`)) {
          customAssetPath = `${basePath}/${slug}_${++counter}`;
        }

        const data: Omit<AssetData, 'composite'> = {
          id: crypto.randomUUID(),
          name,
          category: 'custom',
          tags: [],
        };

        await fs.writeFile(
          `${customAssetPath}/data.json`,
          Buffer.from(JSON.stringify(data, null, 2)) as Buffer,
        );
        await fs.writeFile(
          `${customAssetPath}/composite.json`,
          Buffer.from(JSON.stringify(JSON.parse(new TextDecoder().decode(composite)), null, 2)),
        );

        if (thumbnail) {
          const thumbnailBuffer = Buffer.from(thumbnail);
          await fs.writeFile(`${customAssetPath}/thumbnail.png`, thumbnailBuffer);
        }

        const undoAcc: FileOperation[] = [];
        for (const resourcePath of resources) {
          const fileName = resourcePath.split('/').pop()!;
          const targetPath = `${customAssetPath}/${fileName}`;
          const content = await fs.readFile(resourcePath);

          undoAcc.push({
            prevValue: null,
            newValue: content,
            path: targetPath,
          });
          await fs.writeFile(targetPath, content);
        }

        undoRedoProvider.addUndoFile([
          ...undoAcc,
          {
            prevValue: null,
            newValue: Buffer.from(JSON.stringify(data, null, 2)),
            path: `${customAssetPath}/data.json`,
          },
        ]);

        const asset: AssetData = {
          id: data.id,
          name: data.name,
          category: data.category,
          tags: data.tags,
          composite: JSON.parse(new TextDecoder().decode(composite)),
        };

        return { asset: { data: Buffer.from(JSON.stringify(asset)) } };
      });
    },

    async getCustomAssets() {
      const paths = await getFilesInDirectory(fs, `${DIRECTORY.CUSTOM}`, [], true);
      const folders = [...new Set(paths.map(path => path.split('/')[1]))];
      const assets = (
        await Promise.all(
          folders.map(async path => {
            try {
              const files = await getFilesInDirectory(fs, `${DIRECTORY.CUSTOM}/${path}`, [], true);
              let dataPath: string | null = null;
              let compositePath: string | null = null;
              let thumbnailPath: string | null = null;
              const resources: string[] = [];
              for (const file of files) {
                if (file.endsWith('data.json')) {
                  dataPath = file;
                } else if (file.endsWith('composite.json')) {
                  compositePath = file;
                } else if (file.endsWith('thumbnail.png')) {
                  thumbnailPath = file;
                } else {
                  resources.push(file);
                }
              }
              if (!dataPath || !compositePath) {
                return null;
              }
              const data = await fs.readFile(dataPath);
              const composite = await fs.readFile(compositePath);
              const parsedData = JSON.parse(new TextDecoder().decode(data));
              const result: AssetData & { thumbnail?: string } = {
                ...parsedData,
                composite: JSON.parse(new TextDecoder().decode(composite)),
                resources,
              };

              if (thumbnailPath) {
                const thumbnailData = await fs.readFile(thumbnailPath);
                const thumbnailBuffer = Buffer.from(thumbnailData);
                result.thumbnail = `data:image/png;base64,${thumbnailBuffer.toString('base64')}`;
              }

              return result;
            } catch {
              return null;
            }
          }),
        )
      ).filter((asset): asset is AssetData & { thumbnail?: string } => asset !== null);
      return { assets: assets.map(asset => ({ data: Buffer.from(JSON.stringify(asset)) })) };
    },

    async deleteCustomAsset(req) {
      return stateManager.executeTransaction('external', async () => {
        const { assetId } = req;
        const paths = await getFilesInDirectory(fs, `${DIRECTORY.CUSTOM}`, [], true);
        const folders = [...new Set(paths.map(path => path.split('/')[1]))];

        const undoAcc: FileOperation[] = [];

        for (const folder of folders) {
          const dataPath = `${DIRECTORY.CUSTOM}/${folder}/data.json`;

          if (await fs.existFile(dataPath)) {
            try {
              const data = await fs.readFile(dataPath);
              const parsedData = JSON.parse(new TextDecoder().decode(data));

              if (parsedData.id === assetId) {
                const folderPath = `${DIRECTORY.CUSTOM}/${folder}`;
                const files = await getFilesInDirectory(fs, folderPath, [], true);

                for (const file of files) {
                  const content = await fs.readFile(file);
                  undoAcc.push({
                    prevValue: content,
                    newValue: null,
                    path: file,
                  });
                  await fs.rm(file);
                }

                undoRedoProvider.addUndoFile(undoAcc);
                return {};
              }
            } catch (err) {
              continue;
            }
          }
        }

        throw new Error(`Custom asset with id ${assetId} not found`);
      });
    },

    async renameCustomAsset(req: { assetId: string; newName: string }) {
      return stateManager.executeTransaction('external', async () => {
        const { assetId, newName } = req;
        const paths = await getFilesInDirectory(fs, `${DIRECTORY.CUSTOM}`, [], true);
        const folders = [...new Set(paths.map(path => path.split('/')[1]))];

        const undoAcc: FileOperation[] = [];

        for (const folder of folders) {
          const dataPath = `${DIRECTORY.CUSTOM}/${folder}/data.json`;

          if (await fs.existFile(dataPath)) {
            try {
              const data = await fs.readFile(dataPath);
              const parsedData = JSON.parse(new TextDecoder().decode(data));

              if (parsedData.id === assetId) {
                const updatedData = { ...parsedData, name: newName };
                const newContent = Buffer.from(JSON.stringify(updatedData, null, 2));

                undoAcc.push({
                  prevValue: data,
                  newValue: newContent,
                  path: dataPath,
                });

                await fs.writeFile(dataPath, newContent);
                undoRedoProvider.addUndoFile(undoAcc);
                return {};
              }
            } catch (err) {
              continue;
            }
          }
        }

        throw new Error(`Custom asset with id ${assetId} not found`);
      });
    },
  };
}
