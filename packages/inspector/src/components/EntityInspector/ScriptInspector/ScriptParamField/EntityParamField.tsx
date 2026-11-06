import React, { useMemo } from 'react';
import type { Entity } from '@dcl/ecs';
import { VERSIONS_REGISTRY, getLatestVersionName } from '@dcl/asset-packs';

import { useSdk } from '../../../../hooks/sdk/useSdk';
import type { Component } from '../../../../lib/sdk/components';
import EntityField from '../../../ui/EntityField/EntityField';

type Props = {
  label: React.ReactNode;
  value: Entity;
  // Component names from the param's `@components` tag.
  components?: string[];
  onChange: (entity: Entity) => void;
};

// A versioned asset-packs component is named by its base name (`asset-packs::Actions`) and lives
// in the engine under its latest version's name.
const resolveComponentName = (name: string) =>
  VERSIONS_REGISTRY[name] ? getLatestVersionName(name) : name;

// An Entity param, narrowed to the entities carrying one of `components` when the script names
// any. A name the scene's engine doesn't know matches nothing, so the list is empty rather than
// falling back to every entity.
export function EntityParamField({ label, value, components, onChange }: Props) {
  const sdk = useSdk();
  const filter = useMemo(() => {
    if (!components?.length || !sdk) return undefined;
    return components.map(name =>
      sdk.engine.getComponentOrNull(resolveComponentName(name)),
    ) as Component[];
  }, [sdk, components?.join()]);

  return (
    <EntityField
      label={label}
      value={value}
      components={filter}
      onChange={e => onChange(Number(e.target.value) as Entity)}
    />
  );
}
