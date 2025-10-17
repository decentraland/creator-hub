const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
};

/** Get MIME type based on file extension */
export const getMimeType = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return MIME_TYPES[ext] || 'application/octet-stream';
};

/** Check if a URL is external (http/https) */
export const isExternalUrl = (url: string | undefined): boolean => {
  return !!url && (url.startsWith('http://') || url.startsWith('https://'));
};

/**
 * Normalizes and validates a relative file path to prevent directory traversal attacks.
 * Ensures the path stays within the scene folder.
 */
export const normalizePath = (path: string): string => {
  const normalizedParts = path
    .replace(/\\/g, '/') // Normalize backslashes to forward slashes
    .split('/') // Split into parts and filter out . and .. to prevent traversal
    .filter(part => part && part !== '.' && part !== '..');
  return normalizedParts.join('/');
};
