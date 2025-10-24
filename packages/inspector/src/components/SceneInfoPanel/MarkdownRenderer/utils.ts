const ALLOWED_EXTERNAL_IFRAME_ORIGINS = new Set<string>([
  'https://www.youtube.com',
  'https://youtube.com',
  'https://player.vimeo.com',
]);

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
export const isExternalUrl = (url: any): boolean => {
  return (
    !!url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))
  );
};

/**
 * Normalizes and validates a relative file path to prevent directory traversal attacks.
 * Ensures the path stays within the scene folder.
 */
export const normalizePath = (path: string): string => {
  const normalizedParts = `${path}` // Ensure it's a string
    .replace(/\\/g, '/') // Normalize backslashes to forward slashes
    .split('/') // Split into parts and filter out . and .. to prevent traversal
    .filter(part => part && part !== '.' && part !== '..');
  return normalizedParts.join('/');
};

/** Check if an external URL is allowed to be embedded in an iframe */
export const isAllowedExternalIframeOrigin = (url: string): boolean => {
  try {
    const { origin } = new URL(url);
    return ALLOWED_EXTERNAL_IFRAME_ORIGINS.has(origin);
  } catch {
    return false;
  }
};
