import type { AuthChain } from '@dcl/schemas';

/** The empty scene main built for a parcel: the id to sign and the time it was built at. */
export type EmptySceneDraft = {
  entityId: string;
  timestamp: number;
};

/** What main needs to rebuild that empty scene and deploy it with the renderer's signature. */
export type EmptySceneDeploy = {
  parcel: string;
  timestamp: number;
  authChain: AuthChain;
};
