export type DebugLogEntry = { id: number; html: string };

const MAX_ENTRIES = 1000;

let entries: DebugLogEntry[] = [];
let nextId = 0;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function push(lines: string[]) {
  if (lines.length === 0) return;
  const newEntries = lines.map(html => ({ id: nextId++, html }));
  entries = entries.concat(newEntries);
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(-MAX_ENTRIES);
  }
  notify();
}

export function clear() {
  entries = [];
  notify();
}

export function getSnapshot(): DebugLogEntry[] {
  return entries;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
