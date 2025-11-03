import type { Avatar, Profile } from '@dcl/schemas';
import { config } from '/@/config';

export class Profiles {
  private url = config.get('PEER_URL');

  public async fetchProfile(address: string): Promise<Avatar | undefined> {
    try {
      const response = await fetch(`${this.url}/lambdas/profiles/${address}`);
      const profile = (await response.json()) as Profile;
      return profile.avatars[0];
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }
}

export default new Profiles();
