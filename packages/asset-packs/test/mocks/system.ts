// No-op stubs for the SDK host `~system/*` modules that `actions.ts` imports at eval time. The
// damage-chain test never invokes these code paths; they exist only so the module graph loads.

const noop = async () => ({});

export const movePlayerTo = noop;
export const triggerEmote = noop;
export const triggerSceneEmote = noop;
export const openExternalUrl = noop;
export const teleportTo = noop;
export const changeRealm = noop;
export const signedFetch = noop;
export const getRealm = noop;
