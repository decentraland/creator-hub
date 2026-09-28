export function imageToDataUri(img: HTMLImageElement, width: number, height: number) {
  // create an off-screen canvas
  const canvas: HTMLCanvasElement = document.createElement('canvas');
  const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');

  if (!ctx) return null;

  // set its dimension to target size
  canvas.width = width;
  canvas.height = height;

  // draw source image into the off-screen canvas:
  ctx.drawImage(img, 0, 0, width, height);

  // encode image to data-uri with base64 version of compressed image
  return canvas.toDataURL();
}

export function resizeImage(image: string, maxWidth: number, maxHeight: number) {
  return new Promise<string | null>(resolve => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      let ratio = 0;
      if (width > maxWidth) {
        ratio = maxWidth / width;
        width = maxWidth;
        height *= ratio;
      } else if (height > maxHeight) {
        ratio = maxHeight / height;
        width *= ratio;
        height = maxHeight;
      }
      const newDataUri = imageToDataUri(img, width, height);
      resolve(newDataUri);
    };
    // Never hang on a malformed image (e.g. a screenshot RPC that resolved with an
    // error string instead of a data URL — a renderer whose engine lacks the
    // screenshot command): resolve null so callers treat it as "no thumbnail".
    img.onerror = () => resolve(null);
    img.src = image;
  });
}

export const THUMBNAIL_ASPECT_RATIO = 16 / 9;
const THUMBNAIL_MAX_WIDTH = 1920;
const THUMBNAIL_WIDTH_STEP = 16;

export type CropRect = { x: number; y: number; width: number; height: number };

/** Largest centred rectangle of the given aspect ratio that fits inside the source. */
export function getCoverCrop(sourceWidth: number, sourceHeight: number, aspect: number): CropRect {
  if (sourceWidth / sourceHeight > aspect) {
    const width = Math.round(sourceHeight * aspect);
    return { x: Math.floor((sourceWidth - width) / 2), y: 0, width, height: sourceHeight };
  }
  const height = Math.round(sourceWidth / aspect);
  return { x: 0, y: Math.floor((sourceHeight - height) / 2), width: sourceWidth, height };
}

/**
 * Output size for a scene thumbnail: never upscaled, capped at the recommended
 * 1920 wide, and snapped to a multiple of 16 so the 9/16 height is a whole
 * number and the file is exactly 16:9.
 */
export function getThumbnailSize(cropWidth: number): { width: number; height: number } {
  const capped = Math.min(THUMBNAIL_MAX_WIDTH, cropWidth);
  const width = Math.max(
    THUMBNAIL_WIDTH_STEP,
    Math.floor(capped / THUMBNAIL_WIDTH_STEP) * THUMBNAIL_WIDTH_STEP,
  );
  return { width, height: (width / 16) * 9 };
}

/** Centre-crops a captured image to 16:9 and scales it to thumbnail size. */
export function cropImageToThumbnail(image: string) {
  return new Promise<string | null>(resolve => {
    const img = new Image();
    img.onload = () => {
      const crop = getCoverCrop(img.width, img.height, THUMBNAIL_ASPECT_RATIO);
      const { width, height } = getThumbnailSize(crop.width);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
      resolve(canvas.toDataURL());
    };
    img.onerror = () => resolve(null);
    img.src = image;
  });
}

export const BASE64_PREFIX = 'data:image/png;base64,';

export function addBase64ImagePrefix(base64: string) {
  if (base64.startsWith(BASE64_PREFIX)) return base64;
  return `${BASE64_PREFIX}${base64}`;
}

export function stripBase64ImagePrefix(base64: string) {
  return base64.replace(BASE64_PREFIX, '');
}
