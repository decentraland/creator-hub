let lastEditAt = Number.NEGATIVE_INFINITY;

export function markLocalEdit(): void {
  lastEditAt = performance.now();
}

export function hasRecentLocalEdit(withinMs: number): boolean {
  return performance.now() - lastEditAt < withinMs;
}
