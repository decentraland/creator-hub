# Component Versioning Framework

A generic framework for defining, versioning, and migrating ECS components. Any package that needs versioned component definitions with automatic migration can use it.

## Overview

The framework provides a `createComponentFramework` factory that takes a schema registry and produces everything needed to manage versioned components: version resolution, engine registration, and automatic migration of entities from old versions to the latest.

## Core Concepts

### Schema Registry

A schema registry is a plain `as const` object mapping component base names to arrays of schema **diffs**. Each array element contains only the **new fields** introduced by that version. The framework merges them cumulatively at runtime (V0, V0+V1, V0+V1+V2, etc.):

```typescript
import { Schemas } from '@dcl/ecs';

const COMPONENT_REGISTRY = {
  'my-package::Health': [
    // V0 — base fields
    { value: Schemas.Int },
    // V1 — only the new fields added in this version
    { maxValue: Schemas.Int },
  ],
  'my-package::Inventory': [
    // V0 — only version
    { slots: Schemas.Array(Schemas.String) },
  ],
} as const;
// At runtime, Health V0 = { value }, Health V1 = { value, maxValue }
```

### Version Naming Convention

Version names are derived automatically from the array index:

| Array Index | Registered Name                         |
| ----------- | --------------------------------------- |
| 0           | Base name (`my-package::Health`)        |
| 1           | `my-package::Health-v1`                 |
| 2           | `my-package::Health-v2`                 |
| N           | `${baseName}-v${N}`                     |

### Factory

`createComponentFramework(registry)` returns:

| Export                  | Description                                                  |
| ----------------------- | ------------------------------------------------------------ |
| `VERSIONS_REGISTRY`    | Resolved map of base names to `VersionedComponent[]`         |
| `getLatestVersionName` | Returns the latest version name for a given base name        |
| `defineAllComponents`  | Defines all versions on an engine, returns latest components |
| `migrateAll`           | Migrates all entities from old versions to the latest        |

```typescript
import { createComponentFramework } from '@dcl/asset-packs';

const { VERSIONS_REGISTRY, getLatestVersionName, defineAllComponents, migrateAll } =
  createComponentFramework(COMPONENT_REGISTRY);
```

### Type Safety

The `VersionedComponents<T>` generic merges all diffs in each version array and derives TypeScript types from the combined result:

```typescript
import type { VersionedComponents } from '@dcl/asset-packs';

type MyComponents = VersionedComponents<typeof COMPONENT_REGISTRY>;
// {
//   'my-package::Health': LastWriteWinElementSetComponentDefinition<{ value: number; maxValue: number }>,
//   'my-package::Inventory': LastWriteWinElementSetComponentDefinition<{ slots: string[] }>,
// }
```

Since `defineAllComponents` returns `Record<string, any>` at runtime (generic type inference has limitations with `MapResult` from `@dcl/ecs`), cast the result at the call site:

```typescript
const components = defineAllComponents(engine) as MyComponents;
```

### Migration

When `migrateAll(engine)` runs, for each component it:

1. Finds all engine components matching the base name or `${baseName}-v*`
2. Skips the latest version
3. For each entity on an old version: copies its value to the latest version, then deletes the old

`migrateVersionedComponent(engine, baseName, versions)` is also exported for migrating a single component.

## Usage

### Setting Up a New Package

**1. Create a registry file:**

```typescript
// src/versioning/registry.ts
import { Schemas } from '@dcl/ecs';
import { createComponentFramework, type VersionedComponents } from '@dcl/asset-packs';

const COMPONENT_REGISTRY = {
  'my-package::Health': [
    { value: Schemas.Int },
  ],
} as const;

export type MyVersionedComponents = VersionedComponents<typeof COMPONENT_REGISTRY>;

export const { VERSIONS_REGISTRY, getLatestVersionName, defineAllComponents, migrateAll } =
  createComponentFramework(COMPONENT_REGISTRY);

export { COMPONENT_REGISTRY };
```

**2. Define components on an engine:**

```typescript
import { defineAllComponents, type MyVersionedComponents } from './versioning/registry';

const components = defineAllComponents(engine) as MyVersionedComponents;
const health = components['my-package::Health'];
```

**3. Run migrations during scene load:**

```typescript
import { migrateAll } from './versioning/registry';

migrateAll(engine);
```

### Adding a New Component

Add an entry to the `COMPONENT_REGISTRY` in the registry file:

```typescript
const COMPONENT_REGISTRY = {
  // ... existing components
  'my-package::Armor': [
    { defense: Schemas.Int, durability: Schemas.Float },
  ],
} as const;
```

No other files need to change for the framework to pick it up. Depending on how the package exposes components, you may also need to update the public API surface (constants, exports, etc.).

### Adding a New Version

Append a new object containing **only the new fields** for that version. The framework merges all previous diffs automatically:

```typescript
const COMPONENT_REGISTRY = {
  'my-package::Health': [
    // V0 — base fields
    { value: Schemas.Int },
    // V1 — only the new fields
    { maxValue: Schemas.Int },
  ],
} as const;
```

At runtime, V0 is registered with `{ value }` and V1 with `{ value, maxValue }`. Entities on V0 are automatically migrated to V1 on the next `migrateAll` call.

## Current Usages

### `@dcl/asset-packs`

- **Registry:** `packages/asset-packs/src/versioning/registry.ts` (12 components)
- **Base names:** `packages/asset-packs/src/constants.ts` (`BaseComponentNames`)
- **Resolved names:** `packages/asset-packs/src/enums.ts` (`ComponentName`, uses `getLatestVersionName`)
- **Engine init:** `packages/asset-packs/src/definitions.ts` (`createComponents`)

### `inspector`

- **Registry:** `packages/inspector/src/lib/sdk/components/versioning/registry.ts` (11 components, including multi-version `SceneMetadata`)
- **Base names:** `packages/inspector/src/lib/sdk/components/versioning/base-names.ts`
- **Typed wrapper:** `packages/inspector/src/lib/sdk/components/versioning/constants.ts` (`defineAllVersionedComponents`)

## API Reference

### `createComponentFramework<T>(registry: T)`

Factory function. Takes a schema registry, returns `{ VERSIONS_REGISTRY, getLatestVersionName, defineAllComponents, migrateAll }`.

### `migrateVersionedComponent(engine, baseName, versions)`

Migrates all entities on old versions of a single component to its latest version.

### `VersionedComponents<T>`

Generic type that maps a registry to its typed component definitions. Merges all diffs in each version array to derive the final type.

### `VersionedComponent`

```typescript
type VersionedComponent = {
  versionName: string;
  component: Record<string, ISchema>;
};
```
