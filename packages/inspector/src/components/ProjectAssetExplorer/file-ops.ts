/**
 * Pure helpers for the Local Assets tab file operations (rename / duplicate / copy-paste).
 * Paths here are relative to the `assets/` directory, e.g. `my-pack/model.glb`.
 */

export function getBaseName(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? path : path.slice(idx + 1);
}

export function getParentPath(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.slice(0, idx);
}

export function joinPath(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

/** Splits `model.final.glb` into `{ base: 'model.final', ext: '.glb' }`. Folders pass `isFolder`. */
export function splitName(name: string, isFolder = false): { base: string; ext: string } {
  if (isFolder) return { base: name, ext: '' };
  const idx = name.lastIndexOf('.');
  if (idx <= 0) return { base: name, ext: '' };
  return { base: name.slice(0, idx), ext: name.slice(idx) };
}

/** Returns an error message when `name` can't be used as a file/folder name, otherwise undefined. */
export function validateName(name: string, siblings: Iterable<string>, current?: string) {
  const trimmed = name.trim();
  if (!trimmed) return 'The name cannot be empty';
  if (trimmed === '.' || trimmed === '..') return 'Invalid name';
  if (/[\\/:*?"<>|]/.test(trimmed)) return 'The name contains invalid characters';
  if (trimmed !== current) {
    for (const sibling of siblings) {
      if (sibling.toLowerCase() === trimmed.toLowerCase()) {
        return `"${trimmed}" already exists in this folder`;
      }
    }
  }
  return undefined;
}

/** `model.glb` -> `model copy.glb` -> `model copy 2.glb`, skipping any name in `siblings`. */
export function getUniqueCopyName(name: string, siblings: Iterable<string>, isFolder = false) {
  const taken = new Set(Array.from(siblings, $ => $.toLowerCase()));
  const { base, ext } = splitName(name, isFolder);
  let candidate = `${base} copy${ext}`;
  let i = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base} copy ${i}${ext}`;
    i++;
  }
  return candidate;
}

/**
 * Builds a function that maps a path inside `from` (the file itself or anything below it, when
 * it is a folder) to the equivalent path below `to`. Returns undefined for unrelated paths.
 */
export function createPathMapper(from: string, to: string) {
  return (path: string): string | undefined => {
    if (path === from) return to;
    if (path.startsWith(from + '/')) return to + path.slice(from.length);
    return undefined;
  };
}

const REFERENCE_KEYS = new Set(['src', 'audioClipUrl', 'path']);

/**
 * Deep-walks a component value replacing the string fields that hold asset paths
 * (`src`, `audioClipUrl`, `path`) through `map`. Returns the same reference when nothing changed.
 */
export function replaceAssetReferences<T>(value: T, map: (path: string) => string | undefined): T {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map(item => {
      const replaced = replaceAssetReferences(item, map);
      if (replaced !== item) changed = true;
      return replaced;
    });
    return (changed ? next : value) as T;
  }
  if (value && typeof value === 'object' && !(value instanceof Uint8Array)) {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      let replaced: unknown = child;
      if (REFERENCE_KEYS.has(key) && typeof child === 'string') {
        replaced = map(child) ?? child;
      } else {
        replaced = replaceAssetReferences(child, map);
      }
      if (replaced !== child) changed = true;
      next[key] = replaced;
    }
    return (changed ? next : value) as T;
  }
  return value;
}

export function guessMimeType(name: string): string {
  const ext = splitName(name).ext.toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    default:
      return 'application/octet-stream';
  }
}

/** Copies text to the clipboard, falling back to a hidden textarea where the async API is blocked. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}
