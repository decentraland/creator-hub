/**
 * Back-compat re-exports. The id / mapping primitives now live in
 * `./mapping.ts`. New code should import from there directly; this module is
 * kept so existing consumers (and the `definitions.ts` barrel) keep working.
 */
export { COMPONENTS_WITH_ID, getCounterComponent, getNextId, requiresId } from './mapping';
