// Discriminator for a mixed-content segment stored inside an
// `asset-packs::UIBindings` row's optional `segments` list. A `literal`
// segment's `value` is the literal text; a `binding` segment's `value` is the
// name of a declared UI variable, resolved (and coerced to string) at render
// time.
//
// Lives in a standalone module (not in `enums.ts`) because
// `versioning/registry.ts` references `SegmentKind` at module-evaluation time
// inside `Schemas.EnumString`. `enums.ts` imports from `versioning/registry.ts`
// (for `getLatestVersionName`), so embedding this enum in `enums.ts` would
// produce a circular dependency where `registry.ts` sees `SegmentKind` as
// `undefined`. Mirrors `variable-enums.ts` and `trigger-enums.ts`.
export enum SegmentKind {
  LITERAL = 'literal',
  BINDING = 'binding',
}
