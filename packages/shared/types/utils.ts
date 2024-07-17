export type Tail<T extends any[]> = T extends [any, ...infer Rest] ? Rest : never;

export function isUrl(url: string) {
  const regex = new RegExp(
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()!@:%_+.~#?&//=]*)/gm,
  );
  return regex.test(url);
}
