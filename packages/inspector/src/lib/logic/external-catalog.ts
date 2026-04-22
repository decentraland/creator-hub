import type { Asset, AssetPack } from '@dcl/asset-packs';

const EXTERNAL_CATALOG_URL = 'https://studio-api.dclregenesislabs.xyz/api/catalog';
const FETCH_TIMEOUT_MS = 15_000;

interface ExternalAsset {
  id: string;
  name: string;
  filename: string;
  url: string;
  collection: string;
  category: string;
  subcategory: string;
  tags: string[];
  source: string;
  description: string;
  width: number;
  height: number;
  depth: number;
  triangles: number;
  vertices: number;
  fileSize: number;
  thumbnailUrl: string;
  animations?: string[];
}

interface ExternalCatalog {
  collections: { name: string; source: string; assetCount: number }[];
  assets: ExternalAsset[];
}

const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  prop: 'Props',
  structure: 'Structures',
  decoration: 'Decorations',
  character: 'Characters',
  effect: 'Effects',
  signage: 'Signage',
  nature: 'Nature',
  appliance: 'Appliances',
  ground: 'Ground & Terrain',
  fixture: 'Fixtures',
  lighting: 'Lighting',
  vehicle: 'Vehicles',
  furniture: 'Furniture',
  uncategorized: 'Other',
};

function transformAsset(external: ExternalAsset): Asset {
  return {
    id: external.id,
    name: external.name,
    category: external.category === 'ground' ? 'terrain' : external.category || 'uncategorized',
    tags: external.tags || [],
    description: external.description,
    composite: {
      version: 1,
      components: [
        {
          name: 'core::GltfContainer',
          data: {
            '0': {
              json: {
                src: `{assetPath}/${external.filename}`,
              },
            },
          },
        },
      ],
    },
    contents: {
      [external.filename]: external.url,
      'thumbnail.png': external.thumbnailUrl,
    },
  };
}

let _fetchPromise: Promise<AssetPack[]> | null = null;
let _externalCatalog: AssetPack[] = [];

export function fetchExternalCatalog(): Promise<AssetPack[]> {
  if (_fetchPromise) return _fetchPromise;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  _fetchPromise = fetch(EXTERNAL_CATALOG_URL, { signal: controller.signal })
    .then(async response => {
      if (!response.ok) throw new Error(`Failed to fetch external catalog: ${response.status}`);
      const data: ExternalCatalog = await response.json();

      // Group assets by category
      const byCategory = new Map<string, Asset[]>();
      for (const ext of data.assets) {
        if (!ext.thumbnailUrl || !ext.url) continue;
        const asset = transformAsset(ext);
        const category = ext.category || 'uncategorized';
        const list = byCategory.get(category) ?? [];
        list.push(asset);
        byCategory.set(category, list);
      }

      // Create one pack per category, sorted by asset count descending
      _externalCatalog = Array.from(byCategory.entries())
        .sort(([, a], [, b]) => b.length - a.length)
        .map(([category, assets]) => ({
          id: `external-${category}`,
          name: CATEGORY_DISPLAY_NAMES[category] ?? category,
          thumbnail: assets[0]?.contents['thumbnail.png'] ?? '',
          assets,
        }));

      return _externalCatalog;
    })
    .finally(() => clearTimeout(timeoutId))
    .catch(err => {
      console.warn('Failed to fetch external catalog:', err);
      _externalCatalog = [];
      _fetchPromise = null;
      return _externalCatalog;
    });

  return _fetchPromise;
}
