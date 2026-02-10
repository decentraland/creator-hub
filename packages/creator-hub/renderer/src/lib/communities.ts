import type { AuthIdentity } from '@dcl/crypto';
import { localStorageGetIdentity } from '@dcl/single-sign-on-client';
import fetch from 'decentraland-crypto-fetch';
import { config } from '/@/config';

export type CommunityMinimal = {
  id: string;
  name: string;
  membersCount: number;
  privacy: string;
};

export type Community = CommunityMinimal & {
  description: string;
  ownerAddress: string;
  ownerName: string;
  visibility: string;
  active: boolean;
  thumbnails: Record<string, string>;
  role?: string;
};

export type CommunitiesResponse<T = Community> = {
  data: {
    results: T[];
    total: number;
    limit: number;
    offset: number;
    page: number;
    pages: number;
  };
};

const SOCIAL_API_URL = config.get('SOCIAL_API_URL');

export class Communities {
  private url = SOCIAL_API_URL;

  private withIdentity(address: string): AuthIdentity {
    const identity = localStorageGetIdentity(address);
    if (!identity) {
      throw new Error('No identity found');
    }
    return identity;
  }

  public async fetchCommunities(
    address: string,
    params?: {
      search?: string;
      minimal?: boolean;
      limit?: number;
      offset?: number;
    },
  ): Promise<CommunitiesResponse<CommunityMinimal> | null> {
    try {
      const urlParams = new URLSearchParams();

      if (params?.minimal) {
        urlParams.set('minimal', 'true');
      }
      if (params?.search) {
        urlParams.set('search', params.search);
      }
      if (params?.limit !== undefined) {
        urlParams.set('limit', params.limit.toString());
      }
      if (params?.offset !== undefined) {
        urlParams.set('offset', params.offset.toString());
      }

      const response = await fetch(`${this.url}/v1/communities?${urlParams.toString()}`, {
        identity: this.withIdentity(address),
      });

      if (response.ok) {
        const json = await response.json();
        return json as CommunitiesResponse<CommunityMinimal>;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error fetching communities:', error);
      return null;
    }
  }
}

export default new Communities();
