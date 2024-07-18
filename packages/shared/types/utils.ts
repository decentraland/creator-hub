export type Tail<T extends any[]> = T extends [any, ...infer Rest] ? Rest : never;

export function isUrl(url: string) {
  try {
    new URL(url);
    return true;
  } catch (_error) {
    return false;
  }
}
