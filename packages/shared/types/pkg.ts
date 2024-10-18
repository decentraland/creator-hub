export type PackageJson = {
  version: string;
  engines: {
    node: string;
  };
  bin?: { [command: string]: string };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export enum PACKAGES {
  SDK_PACKAGE = '@dcl/sdk',
}

export const PACKAGES_LIST = Object.values(PACKAGES);
