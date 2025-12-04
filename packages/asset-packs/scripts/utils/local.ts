import { hashV1 } from '@dcl/hashing';
import type { AssetData, AssetPackData, Catalog } from '../../src/types';
import {
  isAssetData,
  isAssetDataWithoutComposite,
  isAssetPackData,
  isLegacyAssetData,
} from '../../src/types';
import {
  createDirectory,
  exists,
  getFiles,
  getSubfolders,
  readBuffer,
  readJson,
  writeFile,
} from './fs';
import { slug } from './string';
import type { BuilderApiAsset, BuilderApiAssetPack } from './builder/types';

export class LocalFileSystem {
  constructor(public cwd: string) {}

  getAssetPackPath(assetPackName: string) {
    return `${this.cwd}/${slug(assetPackName)}`;
  }

  async writeAssetPack(assetPack: BuilderApiAssetPack) {
    const assetPackPath = `${this.cwd}/${slug(assetPack.title)}`;
    const alreadyExists = await exists(assetPackPath);
    if (!alreadyExists) {
      await createDirectory(assetPackPath);
    }
    const data: AssetPackData = {
      id: assetPack.id,
      name: assetPack.title,
    };
    await writeFile(`${assetPackPath}/data.json`, JSON.stringify(data, null, 2));
  }

  async getAssetPack(path: string) {
    const dataPath = `${path}/data.json`;
    const data = await readJson(dataPath);
    if (!isAssetPackData(data)) {
      throw new Error(`Invalid data in "${dataPath}", ${JSON.stringify(data)}`);
    }
    const thumbnailPath = `${path}/thumbnail.png`;
    const thumbnail = await readBuffer(thumbnailPath);
    const hash = await hashV1(thumbnail);
    return { ...data, thumbnail: hash };
  }

  getAssetsPath(assetPackName: string) {
    return `${this.getAssetPackPath(assetPackName)}/assets`;
  }

  getAssetPath(assetPackName: string, assetName: string) {
    return `${this.getAssetsPath(assetPackName)}/${slug(assetName)}`;
  }

  isAdminToolkitAsset(filePath: string): boolean {
    return filePath.includes('/admin_toolkit/assets/');
  }

  async getAsset(path: string, catalog: boolean = false) {
    const dataPath = `${path}/data.json`;
    const dataWithoutComposite = await readJson(dataPath);
    if (isLegacyAssetData(dataWithoutComposite)) {
      throw new Error(
        `Asset "${dataWithoutComposite.name}" is using the legacy data format. Please run the migration script.`,
      );
    }
    if (isAssetData(dataWithoutComposite)) {
      throw new Error(
        `Asset "${dataPath}" has the composite stored inside. Please run migration script.`,
      );
    }
    if (!isAssetDataWithoutComposite(dataWithoutComposite)) {
      throw new Error(`Invalid data in "${dataPath}"`);
    }

    const compositePath = `${path}/composite.json`;
    const composite = await readJson(compositePath);

    const contents: Record<string, string> = {};
    const paths = await getFiles(path);
    for (const filePath of paths) {
      const file = filePath.slice(path.length + 1);
      if (file === 'data.json') {
        continue;
      }
      if (catalog && this.isAdminToolkitAsset(filePath)) {
        continue;
      }
      const buffer = await readBuffer(filePath);
      contents[file] = await hashV1(buffer);
    }
    const data: AssetData = { ...dataWithoutComposite, composite };
    return { ...data, contents, path, composite };
  }

  async isTaken(path: string, asset: BuilderApiAsset) {
    const alreadyExists = await exists(path);
    if (!alreadyExists) {
      return false;
    }
    try {
      const data = await this.getAsset(path);
      return data.id !== asset.id;
    } catch (error) {
      return true;
    }
  }

  async getAvailableAssetPath(assetPack: BuilderApiAssetPack, asset: BuilderApiAsset) {
    const baseAssetPath = this.getAssetPath(assetPack.title, asset.name);
    let assetPath = baseAssetPath;
    let attempts = 1;
    while (await this.isTaken(assetPath, asset)) {
      assetPath = `${baseAssetPath}_${++attempts}`;
    }
    return assetPath;
  }

  async writeAsset(assetPack: BuilderApiAssetPack, asset: BuilderApiAsset) {
    const assetsPath = this.getAssetsPath(assetPack.title);
    await createDirectory(assetsPath);
    const assetPath = await this.getAvailableAssetPath(assetPack, asset);
    const { id, name, category, model, tags } = asset;
    const data: AssetData = {
      id,
      name,
      category,
      tags,
      composite: {
        version: 1,
        components: [
          {
            name: 'core::GltfContainer',
            data: {
              '0': {
                json: {
                  src: `${assetPath}/${model}`,
                },
              },
            },
          },
        ],
      },
    };
    await createDirectory(assetPath);
    await writeFile(`${assetPath}/data.json`, JSON.stringify(data, null, 2));
    return assetPath;
  }

  async getAssetPacks() {
    const folders = await getSubfolders(this.cwd);
    return Promise.all(folders.map(this.getAssetPack));
  }

  async getAssets(path: string, catalog: boolean = false) {
    const folders = await getSubfolders(path);
    return Promise.all(
      folders.map(folder =>
        this.getAsset(folder, catalog).catch(error => {
          throw new Error(`Invalid asset at ${folder}: ${error.message}`);
        }),
      ),
    );
  }

  async getCatalog() {
    const catalog: Catalog = {
      assetPacks: [],
    };
    const assetPacks = await this.getAssetPacks();
    for (const assetPack of assetPacks) {
      const assetsPath = this.getAssetsPath(assetPack.name);
      const assets = await this.getAssets(assetsPath, true);
      catalog.assetPacks.push({
        ...assetPack,
        assets: assets.map(({ path: _path, ...asset }) => asset),
      });
    }
    return catalog;
  }
}
