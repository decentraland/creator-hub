import type { Catalog, AssetPack, Asset, AssetData } from '@dcl/asset-packs';
import * as _bundledCatalog from '@dcl/asset-packs/catalog.json';
import { CoreComponents } from '../sdk/components';
import { getConfig } from './config';

export type { Catalog, AssetPack, Asset, AssetData };

export type CustomAsset = AssetData & {
  resources: string[];
  thumbnail?: string;
};

// categories obtained from "builder-items.decentraland.org" catalog
export const CATEGORIES = [
  'ground',
  'utils',
  'buttons',
  'chests',
  'levers',
  'doors',
  'platforms',
  'social',
  'decorations',
  'structures',
  'vehicles',
  'furniture',
  'appliances',
  'nature',
  'tiles',
  'year of the pig',
  'health',
  'sounds',
  'primitives',
  'pillars',
  'other',
];

const CATALOG_FETCH_TIMEOUT_MS = 10_000;

// In-memory cache populated after fetchLatestCatalog() resolves.
// Kept as a mutable ref so synchronous helpers (getAssetByModel, getAssetById)
// remain usable after the initial load without requiring async callers.
let _catalog: AssetPack[] = [];

// Whether the catalog was loaded from the remote server or the bundled fallback.
let _catalogSource: 'remote' | 'bundled' | null = null;

// Promise-level cache so concurrent callers share a single in-flight request.
let _fetchPromise: Promise<AssetPack[]> | null = null;

export function getCatalogSource(): 'remote' | 'bundled' | null {
  return _catalogSource;
}

export function fetchLatestCatalog(): Promise<AssetPack[]> {
  if (_fetchPromise) return _fetchPromise;

  const config = getConfig();
  const url = `${config.contentUrl}/asset-packs/latest/catalog.json`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CATALOG_FETCH_TIMEOUT_MS);

  _fetchPromise = fetch(url, { signal: controller.signal })
    .then(async response => {
      if (!response.ok) throw new Error(`Failed to fetch catalog: ${response.status}`);
      const data: Catalog = await response.json();
      _catalog = data.assetPacks;
      _catalogSource = 'remote';
      return _catalog;
    })
    .finally(() => clearTimeout(timeoutId))
    .catch(err => {
      // Fall back to the bundled catalog so the app always resolves.
      // This covers: pre-merge branches (latest/catalog.json not yet on CDN),
      // offline environments, and e2e CI runs without a contentUrl override.
      console.warn('Failed to fetch latest catalog, falling back to bundled version:', err);
      _catalog = (_bundledCatalog as unknown as Catalog).assetPacks;
      _catalogSource = 'bundled';
      return _catalog;
    });

  return _fetchPromise;
}

export function getContentsUrl(hash: string) {
  const config = getConfig();
  return `${config.contentUrl}/contents/${hash}`;
}

export function getAssetsByCategory(assets: Asset[]) {
  const categories = new Map<Asset['category'], Asset[]>(CATEGORIES.map($ => [$, []]));
  for (const asset of assets) {
    const list = categories.get(asset.category);
    if (list) {
      list.push(asset);
    } else {
      if (asset.category) {
        categories.set(asset.category, [asset]);
      } else {
        categories.set('other', [asset]);
      }
    }
  }

  return categories;
}

export function isSmart(asset: Partial<Asset>) {
  const components = asset?.composite?.components ?? [];
  // when the item has more than one component, it is smart
  if (components.length > 1) {
    return true;
    // when the item has a single component but it's not a GltfContainer, then it's also smart
  } else if (components.length === 1 && components[0].name !== CoreComponents.GLTF_CONTAINER) {
    return true;
  }
  // when the item only has a GltfContainer then it's not smart
  return false;
}

export function isGround(asset: Partial<Asset>) {
  return asset.category === 'ground';
}

export function getAssetByModel(path: string) {
  // Validates the path is a model and cames from the catalog
  if (path.endsWith('.glb') && path.split('/').length === 4) {
    const [model, name, _] = path.split('/').reverse();
    for (const assetPack of _catalog) {
      for (const asset of assetPack.assets) {
        if (
          !!asset.contents[model] &&
          asset.name.trim().replaceAll(' ', '_').toLowerCase() === name.toLowerCase()
        ) {
          return asset;
        }
      }
    }
  }

  return null;
}

export function getAssetById(id: string) {
  for (const assetPack of _catalog) {
    for (const asset of assetPack.assets) {
      if (asset.id === id) {
        return asset;
      }
    }
  }

  return null;
}
