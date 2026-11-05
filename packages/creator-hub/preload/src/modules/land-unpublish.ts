import type { EmptySceneDeploy } from '/shared/types/land-unpublish';

import { invoke } from '../services/ipc';

export async function prepare(parcel: string) {
  return invoke('landUnpublish.prepare', parcel);
}

export async function deploy(request: EmptySceneDeploy) {
  return invoke('landUnpublish.deploy', request);
}
