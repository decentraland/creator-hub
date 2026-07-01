// Defined values used by the UI Designer's Variables panel — declared on the
// `asset-packs::UI` marker as the type of each variable. Tags are the storage
// form (lowercased, hyphenated for compound) used in the registry schema.
//
// Lives in a standalone module (not in `enums.ts`) because `versioning/registry.ts`
// references `VariableType` at module-evaluation time. `enums.ts` imports from
// `versioning/registry.ts` (for `getLatestVersionName`), so embedding this enum
// in `enums.ts` produces a circular dependency where `registry.ts` sees
// `VariableType` as `undefined` at evaluation time. Mirrors the same pattern as
// `trigger-enums.ts`.
export enum VariableType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  COLOR = 'color',
  STRING_ARRAY = 'string-array',
  CALLBACK = 'callback',
}
