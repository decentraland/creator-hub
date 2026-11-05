import { config } from '/@/config';
import { ManagedProjectType } from '/shared/types/manage';

const WORLDS_STORAGE_SERVICE_URL = config.get('WORLDS_STORAGE_SERVICE_URL');

/**
 * Build a link to the storage service UI. Worlds pass the realm name; the page
 * lets the user pick a scene from there. Lands pass the parcel coords directly.
 */
export const getStorageUrl = (type: ManagedProjectType, id: string) => {
  if (type === ManagedProjectType.WORLD) {
    return `${WORLDS_STORAGE_SERVICE_URL}/env?realm=${encodeURIComponent(id)}`;
  }
  return `${WORLDS_STORAGE_SERVICE_URL}/env?position=${encodeURIComponent(id)}`;
};
