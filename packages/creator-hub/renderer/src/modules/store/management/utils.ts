import type { ParcelsPermission, WorldPermissionsState, WorldSettingsState } from './slice';

// World-wide permission is represented by a successfully fetched, empty parcels array.
export const hasWorldWidePermission = (parcelsPermission?: ParcelsPermission): boolean =>
  parcelsPermission?.status === 'succeeded' && parcelsPermission.parcels.length === 0;

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
