import { config } from '/@/config';
import { fetch } from '/shared/fetch';

export type CommunityMinimal = {
  id: string;
  name: string;
  membersCount: number;
  privacy: string;
};

export type CommunitiesResponse = {
  communities: CommunityMinimal[];
  total: number;
};

const SOCIAL_SERVICE_URL = config.get('SOCIAL_SERVICE_URL');

export class Communities {
  private url = SOCIAL_SERVICE_URL;

  public async fetchCommunities(params?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<CommunitiesResponse | null> {
    try {
      const urlParams = new URLSearchParams({ minimal: 'true' });

      if (params?.search) {
        urlParams.set('search', params.search);
      }
      if (params?.limit !== undefined) {
        urlParams.set('limit', params.limit.toString());
      }
      if (params?.offset !== undefined) {
        urlParams.set('offset', params.offset.toString());
      }

      const response = await fetch(`${this.url}/v1/communities?${urlParams.toString()}`);

      if (response.ok) {
        const json = await response.json();
        return json as CommunitiesResponse;
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
