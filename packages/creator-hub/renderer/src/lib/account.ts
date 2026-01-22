import { config } from '/@/config';

export type AccountHoldings = {
  owner: string;
  ownedLands: number;
  ownedNames: number;
  ownedMana: number;
  spaceAllowance: number;
};

export class Account {
  private nameStatsUrl = config.get('DCL_NAME_STATS_URL');

  public async fetchAccountHoldings(account: string) {
    try {
      const result = await fetch(`${this.nameStatsUrl}/account-holdings/${account}`, {
        method: 'POST',
      });
      if (result.ok) {
        const { data } = await result.json();
        return data as AccountHoldings;
      } else {
        return null;
      }
    } catch (e) {
      return null;
    }
  }
}

export const getMbsFromAccountHoldings = (accountHoldings: AccountHoldings) => {
  const manaMbs = Math.trunc(accountHoldings.ownedMana / 2000) * 100;
  const landMbs = accountHoldings.ownedLands * 100;
  const nameMbs = accountHoldings.ownedNames * 100;

  return {
    manaMbs,
    landMbs,
    nameMbs,
  };
};
