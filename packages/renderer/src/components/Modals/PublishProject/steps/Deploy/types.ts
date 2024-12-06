export type File = {
  name: string;
  size: number;
};

export type Info = {
  baseParcel: string;
  debug: boolean;
  description: string;
  isPortableExperience: boolean;
  isWorld: boolean;
  parcels: string[];
  rootCID: string;
  skipValidations: boolean;
  title: string;
};

export type Status = 'idle' | 'pending' | 'success' | 'failed';

export type DeploymentStatus = {
  catalyst: Status;
  assetBundle: Status;
  lods: Status;
};
