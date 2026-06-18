import { readFileSync, readdirSync, existsSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join } from 'path';

import type { Page, Route } from 'playwright';

import type { Catalog } from '@dcl/asset-packs';

const require = createRequire(import.meta.url);
const CATALOG_PATH = require.resolve('@dcl/asset-packs/catalog.json');
const PACKS_DIR = join(dirname(CATALOG_PATH), 'packs');

/**
 * Builds a map from content hash to local file path by cross-referencing
 * the catalog.json (which has hash values) with the local pack directories
 * (which have the actual files).
 */
function buildContentHashMap(catalog: Catalog): Map<string, string> {
  const hashToFile = new Map<string, string>();

  // Build asset ID → catalog contents lookup
  const catalogById = new Map<string, Record<string, string>>();
  for (const pack of catalog.assetPacks) {
    for (const asset of pack.assets) {
      catalogById.set(asset.id, asset.contents);
    }
  }

  // Scan each pack's assets directory to match local files with catalog hashes
  for (const packDir of readdirSync(PACKS_DIR)) {
    const assetsDir = join(PACKS_DIR, packDir, 'assets');
    if (!existsSync(assetsDir)) continue;

    for (const assetDir of readdirSync(assetsDir)) {
      const dataJsonPath = join(assetsDir, assetDir, 'data.json');
      if (!existsSync(dataJsonPath)) continue;

      try {
        const data = JSON.parse(readFileSync(dataJsonPath, 'utf8'));
        const contents = catalogById.get(data.id);
        if (!contents) continue;

        for (const [filename, hash] of Object.entries(contents)) {
          const filePath = join(assetsDir, assetDir, filename);
          if (existsSync(filePath)) {
            hashToFile.set(hash, filePath);
          }
        }
      } catch (error) {
        console.warn(`Skipping malformed data.json: ${dataJsonPath}`, error);
      }
    }
  }

  return hashToFile;
}

function getContentType(filePath: string): string {
  if (filePath.endsWith('.json')) return 'application/json';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.glb')) return 'model/gltf-binary';
  return 'application/octet-stream';
}

/**
 * Intercepts all requests to the content URL domain using Playwright's route API,
 * serving the catalog and asset files from local disk instead of making real network requests.
 */
export async function mockContentRequests(page: Page, contentUrl: string): Promise<void> {
  const catalogContent = readFileSync(CATALOG_PATH);
  const catalog: Catalog = JSON.parse(catalogContent.toString('utf8'));
  const hashToFile = buildContentHashMap(catalog);

  console.log(
    `Mocking content requests to ${contentUrl} (${hashToFile.size} content hashes mapped)`,
  );

  await page.route(`${contentUrl}/**`, async (route: Route) => {
    const url = route.request().url();

    // Serve catalog
    if (url.includes('/asset-packs/latest/catalog.json')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: catalogContent,
      });
      return;
    }

    // Serve content by hash
    const hashMatch = url.match(/\/contents\/([^?]+)/);
    if (hashMatch) {
      const hash = hashMatch[1];
      const filePath = hashToFile.get(hash);
      if (filePath) {
        await route.fulfill({
          status: 200,
          contentType: getContentType(filePath),
          body: readFileSync(filePath),
        });
        return;
      }
    }

    // Unmapped requests get a 404
    await route.fulfill({ status: 404 });
  });
}
