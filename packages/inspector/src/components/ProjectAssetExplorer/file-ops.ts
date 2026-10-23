/**
 * Pure helpers for the Local Assets tab file operations (rename / duplicate / copy-paste).
 * Paths here are relative to the `assets/` directory, e.g. `my-pack/model.glb`.
 */

import { DIRECTORY } from '../../lib/data-layer/host/fs-utils';

/**
 * The scene's own folder (`assets/scene`, holding `main.composite`) is listed like any other
 * because `.composite` is a catalogued extension, but the build and the preview read it from
 * that fixed path: it must never be renamed, moved or deleted from the explorer.
 */
export function isProtectedPath(path: string): boolean {
  return path === DIRECTORY.SCENE || path.startsWith(DIRECTORY.SCENE + '/');
}

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

/**
 * Resolves `.` and `..` segments. Segments that climb above the start are kept (`../x`), so a
 * caller can tell that the path escapes the assets folder.
 */
export function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..' && parts.length && parts[parts.length - 1] !== '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

/**
 * The files a `.gltf` references by a relative URI (its buffers and images), relative to the
 * model's own folder. A `.glb` embeds them, and remote or inline data needs no file.
 */
export function getGltfResourceUris(content: Uint8Array): string[] {
  try {
    const json = JSON.parse(new TextDecoder().decode(content));
    const uris: unknown[] = [...(json.buffers ?? []), ...(json.images ?? [])].map(
      (item: { uri?: unknown }) => item?.uri,
    );
    return uris
      .filter((uri): uri is string => typeof uri === 'string' && !/^(data:|https?:)/i.test(uri))
      .map(uri => decodeURIComponent(uri));
  } catch {
    return [];
  }
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

// `scriptPath` is the CALL_SCRIPT_METHOD action's copy of a Script component `path`.
const REFERENCE_KEYS = new Set(['src', 'audioClipUrl', 'path', 'scriptPath']);
// asset-packs Actions keep their per-action payload as a JSON string; the paths are inside it.
const JSON_PAYLOAD_KEY = 'jsonPayload';

function parseJsonPayload(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    return undefined;
  }
}

/**
 * Deep-walks a component value replacing the string fields that hold asset paths
 * (`src`, `audioClipUrl`, `path`, `scriptPath`, also inside an Action's `jsonPayload`) through
 * `map`. Returns the same reference when nothing changed.
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
      } else if (key === JSON_PAYLOAD_KEY && typeof child === 'string') {
        const payload = parseJsonPayload(child);
        const replacedPayload = replaceAssetReferences(payload, map);
        if (payload !== undefined && replacedPayload !== payload) {
          replaced = JSON.stringify(replacedPayload);
        }
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

/** Every asset path a component value references, read from the same fields `replaceAssetReferences` rewrites. */
export function collectAssetReferences(value: unknown, into: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectAssetReferences(item, into);
  } else if (value && typeof value === 'object' && !(value instanceof Uint8Array)) {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (REFERENCE_KEYS.has(key) && typeof child === 'string') into.push(child);
      else if (key === JSON_PAYLOAD_KEY && typeof child === 'string') {
        collectAssetReferences(parseJsonPayload(child), into);
      } else collectAssetReferences(child, into);
    }
  }
  return into;
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

/** Drops the paths that are inside another path of the list: the ancestor already covers them. */
export function pruneNestedPaths(paths: string[]): string[] {
  const unique = Array.from(new Set(paths));
  return unique.filter(path => !unique.some($ => $ !== path && path.startsWith($ + '/')));
}

/** The items between `from` and `to` (both included) in `ordered`, in display order. */
export function getRange(ordered: string[], from: string, to: string): string[] {
  const start = ordered.indexOf(from);
  const end = ordered.indexOf(to);
  if (end === -1) return [];
  if (start === -1) return [to];
  return ordered.slice(Math.min(start, end), Math.max(start, end) + 1);
}
