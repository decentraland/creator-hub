import type { WorldPermissionsState, WorldSettingsState } from './slice';

export const getThumbnailUrlFromDeployment = (
  deployment:
    | {
        metadata?: { display: { navmapThumbnail: string } };
        content: { file: string; hash: string }[];
      }
    | undefined,
  getContentSrcUrl: (hash: string) => string,
) => {
  if (!deployment?.metadata?.display.navmapThumbnail) return '';
  const thumbnailFileName = deployment.metadata.display.navmapThumbnail;
  const thumbnailContent = deployment.content.find(item => item.file === thumbnailFileName);
  if (thumbnailContent) return getContentSrcUrl(thumbnailContent.hash);
  return '';
};

export const getWorldSettingsInitialState = (): WorldSettingsState => ({
  worldName: '',
  settings: {},
  scenes: [],
  status: 'idle',
  error: null,
});

export const getWorldPermissionsInitialState = (): WorldPermissionsState => ({
  worldName: '',
  owner: '',
  permissions: null,
  summary: {},
  parcels: {},
  loadingNewUser: false,
  status: 'idle',
  error: null,
});
