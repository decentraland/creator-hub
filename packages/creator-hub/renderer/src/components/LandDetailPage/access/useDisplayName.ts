import { useSelector } from '#store';

/** Names an account by its loaded profile name, else by its shortened address (`0x1234…7890`), as a plain string for labels and confirms. */
export function useDisplayName() {
  const profiles = useSelector(state => state.profiles.data);
  return (address: string) =>
    profiles[address]?.avatar?.name ?? `${address.slice(0, 6)}…${address.slice(-4)}`;
}
