export type Tail<T extends any[]> = T extends [any, ...infer Rest]
  ? Rest
  : never;
