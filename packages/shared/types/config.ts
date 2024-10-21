import { type AppSettings } from './settings';

export type Config = {
  version: number;
  workspace: {
    paths: string[];
  };
  settings: AppSettings;
};
