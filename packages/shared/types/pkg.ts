export type PackageJson = {
  version: string;
  engines: {
    node: string;
  };
  bin?: { [command: string]: string };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export const SDK_PACKAGE = '@dcl/sdk';
