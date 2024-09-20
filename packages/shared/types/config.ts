import { type UPDATE_DEPENDENCIES_STRATEGY } from './settings';

export type Config = {
  version: number;
  workspace: {
    paths: string[];
  };
} & AppSettings;

export type AppSettings = {
  scenesPath?: string;
  updateDependenciesStrategy?: UPDATE_DEPENDENCIES_STRATEGY;
};
