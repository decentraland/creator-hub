import ignore from 'ignore';
import type { FileSystemInterface } from '../types';

/**
 * Recursively collects files from a directory, applying ignore patterns similar to dclignore.
 * This implementation uses the 'ignore' library to match the DCL ignore behavior exactly.
 *
 * @param fs - File system interface
 * @param dirPath - Directory path to scan
 * @param files - Array to accumulate file paths
 * @param recursive - Whether to recurse into subdirectories
 * @param ignorePatterns - Array of .gitignore-style patterns to ignore
 * @returns Promise resolving to array of file paths
 */
export async function getFilesInDirectory(
  fs: FileSystemInterface,
  dirPath: string,
  files: string[],
  recursive: boolean = true,
  ignorePatterns: string[] = [],
): Promise<string[]> {
  try {
    // Create an ignore instance with the patterns
    const ig = ignore().add(ignorePatterns);

    const currentDirFiles = await fs.readdir(dirPath);
    for (const currentPath of currentDirFiles) {
      const slashIfRequire = (dirPath.length && !dirPath.endsWith('/') && '/') || '';
      const fullPath = dirPath + slashIfRequire + currentPath.name;

      // Check if this path should be ignored using the ignore library
      // The ignore library expects paths relative to root, so use fullPath
      if (ig.ignores(fullPath)) continue;

      if (currentPath.isDirectory && recursive) {
        await getFilesInDirectory(fs, fullPath, files, recursive, ignorePatterns);
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
  '.ts',
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
