import path from 'path';

const down = new Set<string>();

export function markRealmDown(projectPath: string): void {
  down.add(path.resolve(projectPath));
}

export function clearRealmDown(projectPath: string): void {
  down.delete(path.resolve(projectPath));
}

export function clearAllRealmDown(): void {
  down.clear();
}

export function isRealmDown(projectPath: string): boolean {
  return down.has(path.resolve(projectPath));
}
