import { mockBackoffice } from './mockBackoffice';

export * from './contract';
export * from './cycles';
export * from './metrics';
export * from './places';
export * from './program';
export * from './preferences';
export { mockControls, SimulatedCreator, TERMS_VERSION } from './mockBackoffice';
export type { CreatorFundApi } from './mockBackoffice';

/** The only client the app uses. Point it at a fetch-backed `CreatorFundApi` to go live. */
export const creatorFundApi = mockBackoffice;
