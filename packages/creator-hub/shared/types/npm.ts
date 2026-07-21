export type Outdated = {
  [key: string]: {
    current: string;
    latest: string;
  };
};

/**
 * The npm dist-tags of a package (e.g. `{ latest: "7.24.2", "auth-server": "7.24.3-...commit-..." }`),
 * as returned by `npm view <pkg> dist-tags --json`.
 */
export type DistTags = Record<string, string>;
