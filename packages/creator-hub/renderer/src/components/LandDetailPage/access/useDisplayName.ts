import { useSelector } from '#store';

import { shortenAddress } from './shortenAddress';

/** Names an account by its loaded profile name, else by its shortened address. */
export function useDisplayName() {
  const profiles = useSelector(state => state.profiles.data);
  return (address: string) => profiles[address]?.avatar?.name ?? shortenAddress(address);
}
