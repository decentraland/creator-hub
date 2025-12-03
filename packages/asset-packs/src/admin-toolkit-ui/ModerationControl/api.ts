import type { Result } from '../fetch-utils';
import { getDomain, wrapSignedFetch } from '../fetch-utils';

const URLS = () => ({
  SCENE_ADMIN: `https://comms-gatekeeper.decentraland.${getDomain()}/scene-admin`,
  SCENE_BAN: `https://comms-gatekeeper.decentraland.${getDomain()}/scene-bans`,
});

type SceneAdminResponse = {
  id: string;
  name: string;
  admin: string;
  active: string;
  canBeRemoved: boolean;
};

export type SceneBanUser = {
  bannedAddress: string;
  name: string;
};

type SceneBansListResponse = {
  results: SceneBanUser[];
  total: number;
  page: number;
  pages: number;
  limit: number;
};

export async function getSceneAdmins(): Promise<Result<SceneAdminResponse[], string>> {
  return wrapSignedFetch<SceneAdminResponse[]>({ url: URLS().SCENE_ADMIN });
}

export async function postSceneAdmin<T = unknown>(adminData: { admin: string } | { name: string }) {
  return wrapSignedFetch<T>({
    url: URLS().SCENE_ADMIN,
    init: {
      method: 'POST',
      headers: {},
      body: JSON.stringify(adminData),
    },
  });
}

export async function deleteSceneAdmin<T = unknown>(address: string) {
  return wrapSignedFetch<T>({
    url: URLS().SCENE_ADMIN,
    init: {
      method: 'DELETE',
      headers: {},
      body: JSON.stringify({ admin: address }),
    },
  });
}

export async function postSceneBan<T = unknown>(
  banData: { banned_address: string } | { banned_name: string },
) {
  return wrapSignedFetch<T>({
    url: URLS().SCENE_BAN,
    init: {
      method: 'POST',
      headers: {},
      body: JSON.stringify(banData),
    },
  });
}

export async function getSceneBans(): Promise<Result<SceneBansListResponse, string>> {
  return wrapSignedFetch<SceneBansListResponse>({
    url: URLS().SCENE_BAN,
  });
}

export async function deleteSceneBan<T = unknown>(address: string) {
  return wrapSignedFetch<T>({
    url: URLS().SCENE_BAN,
    init: {
      method: 'DELETE',
      headers: {},
      body: JSON.stringify({ banned_address: address }),
    },
  });
}
