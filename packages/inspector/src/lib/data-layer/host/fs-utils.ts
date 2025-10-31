import type { FileSystemInterface } from '../types';

/**
 * Checks if a filename should be ignored based on glob-like patterns.
 *
 * Supported patterns:
 * - Exact match: "node_modules" matches only "node_modules"
 * - Prefix match: "test*" matches "test.js", "testing.ts", "test-file.txt"
 * - Suffix match: "*.log" matches "error.log", "debug.log", "app.log"
 * - Contains match: "*temp*" matches "my-temp-file.txt", "temporary.js"
 * - Complex patterns: "test-*.log" matches "test-error.log", "test-debug.log"
 */
function shouldIgnore(name: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    // Exact match (no wildcards)
    if (!pattern.includes('*')) {
      return name === pattern;
    }

    // Convert glob pattern to regex. Escape special regex characters except *
    const regexPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(name);
  });
}

export async function getFilesInDirectory(
  fs: FileSystemInterface,
  dirPath: string,
  files: string[],
  recursive: boolean = true,
  ignore: string[] = [],
): Promise<string[]> {
  try {
    const currentDirFiles = await fs.readdir(dirPath);
    for (const currentPath of currentDirFiles) {
      if (shouldIgnore(currentPath.name, ignore)) continue;

      const slashIfRequire = (dirPath.length && !dirPath.endsWith('/') && '/') || '';
      const fullPath = dirPath + slashIfRequire + currentPath.name;

      if (currentPath.isDirectory && recursive) {
        await getFilesInDirectory(fs, fullPath, files, recursive, ignore);
      } else {
        files.push(fullPath);
      }
    }
    return files;
  } catch (_) {
    return [];
  }
}

export const DIRECTORY = {
  ASSETS: 'assets',
  SCENE: 'scene',
  THUMBNAILS: 'thumbnails',
  CUSTOM: 'custom',
  ASSET_PACKS: 'asset-packs',
};

export const EXTENSIONS = [
  '.glb',
  '.png',
  '.composite',
  '.composite.bin',
  '.gltf',
  '.jpg',
  '.mp3',
  '.ogg',
  '.wav',
  '.mp4',
];

export function withAssetDir(filePath: string = '') {
  return filePath ? `${DIRECTORY.ASSETS}/${filePath}` : DIRECTORY.ASSETS;
}

export function withAssetPacksDir(filePath: string) {
  return withAssetDir(`${DIRECTORY.ASSET_PACKS}/${filePath}`);
}

export function isFileInAssetDir(filePath: string = '') {
  return filePath.startsWith(DIRECTORY.ASSETS);
}

export function getCurrentCompositePath() {
  return withAssetDir(`${DIRECTORY.SCENE}/main.composite`);
}

export function transformBinaryToBase64Resource(content: Uint8Array): string {
  return `data:image/png;base64,${Buffer.from(content).toString('base64')}`;
}

export function transformBase64ResourceToBinary(base64Resource: string): Buffer {
  const header = 'data:image/png;base64,';
  return Buffer.from(base64Resource.slice(header.length), 'base64');
}
