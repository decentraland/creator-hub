import { type DEPENDENCY_UPDATE_STRATEGY } from './settings';

export type Config = {
  version: number;
  workspace: {
    paths: string[];
  };
} & AppSettings;

export type AppSettings = {
  scenesPath?: string;
  updateDependenciesStrategy?: DEPENDENCY_UPDATE_STRATEGY;
};
