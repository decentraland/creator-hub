import { fetch } from '/shared/fetch';

const MAX_NAME_LENGTH = 30;

export function truncateFileName(name: string) {
  if (name.length <= MAX_NAME_LENGTH) return name;
  const firstPart = name.substr(0, 4);
  const secondPart = name.substr(name.length - 5, name.length);
  return `${firstPart}...${secondPart}`;
}

export function getExtension(fileName: string) {
  const matches = /\.[0-9a-z]+$/i.exec(fileName);
  const extension = matches ? matches[0] : null;
  return extension;
}

/** Convert bytes to MB
 * @param bytes - size in bytes
 * @returns size in MB
 * @example toMB(1024 * 1024) // 1
 */
export function toMB(bytes: number): number {
  return bytes / 1024 / 1024;
}

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

export function formatSize(size: number) {
  if (size < KB) {
    return `${size.toFixed(2)} B`;
  }
  if (size < MB) {
    return `${(size / KB).toFixed(2)} KB`;
  }
  if (size < GB) {
    return `${(size / MB).toFixed(2)} MB`;
  }
  return `${(size / GB).toFixed(2)} GB`;
}

export async function getFileSize(src: string): Promise<number> {
  try {
    const response = await fetch(src);

    if (response.ok) {
      if (src.startsWith('blob')) {
        const blob = await response.blob();
        return blob.size || 0;
      }
      const fileSize = response.headers.get('Content-Length');
      return fileSize ? parseInt(fileSize, 10) : 0;
    }
  } catch (error) {
    console.error('[Renderer] Error retrieving file size:', error);
  }

  return 0;
}
