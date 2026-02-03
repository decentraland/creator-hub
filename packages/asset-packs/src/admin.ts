import { getSceneAdmins } from './admin-toolkit-ui/ModerationControl/api';
import { isPreview } from './admin-toolkit-ui/fetch-utils';
import { getUserData } from '~system/UserIdentity';

type SceneAdmin = {
  name: string;
  address: string;
  canBeRemoved: boolean;
};

let adminCache: SceneAdmin[] | null = null;

async function fetchAndCacheAdmins(): Promise<SceneAdmin[]> {
  const [error, response] = await getSceneAdmins();

  if (error) {
    console.error('Failed to fetch scene admins:', error);
    adminCache = [];
    return [];
  }

  const admins: SceneAdmin[] = (response ?? []).map(admin => ({
    name: admin.name,
    address: admin.admin.toLowerCase(),
    canBeRemoved: !!admin.canBeRemoved,
  }));

  adminCache = admins;
  return admins;
}

/**
 * Checks if the current player is a scene admin.
 *
 * This function can be called anywhere in scene code to determine if the current
 * player has admin privileges for the scene.
 *
 * @returns Promise<boolean> - Returns true if the player is an admin, false otherwise.
 *                             Always returns true in preview mode.
 *
 * @example
 * ```typescript
 * import { isAdmin } from '@dcl/asset-packs/dist/admin'
 *
 * async function onPlayerSpawn() {
 *   const isAdminUser = await isAdmin();
 *   if (isAdminUser) {
 *     // Show admin-only UI, teleport to stage, etc.
 *   }
 * }
 * ```
 */
export async function isAdmin(): Promise<boolean> {
  try {
    if (isPreview()) {
      return true;
    }

    const userData = await getUserData({});
    if (!userData.data?.userId) {
      return false;
    }

    const playerAddress = userData.data.userId.toLowerCase();

    const admins = adminCache ?? (await fetchAndCacheAdmins());

    return admins.some(admin => admin.address === playerAddress);
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}
