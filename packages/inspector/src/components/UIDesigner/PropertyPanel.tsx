import React, { useCallback, useMemo, useState } from 'react';
import type { Entity, IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { UIBindings, UISegment } from '@dcl/asset-packs';
import { ComponentName } from '@dcl/asset-packs';

import { useChange } from '../../hooks/sdk/useChange';
import { useSdk } from '../../hooks/sdk/useSdk';
import { useAppSelector } from '../../redux/hooks';
import { getSelectedNode, getSelectedRoot } from '../../redux/ui-designer';
import { Block } from '../Block';
import { Container } from '../Container';
import { TextField } from '../ui';
import { RgbaColorField } from '../ui/RgbaColorField';
import { debounce } from '../../lib/utils/debounce';
import { measureParentBox, axisForPath, convertLength } from './measure';
import { classifyNode, getComponentBag, type UINodeType } from './tree-model';
import { BindableField } from './BindableField';
import { BindableSubField } from './BindableSubField';
import { MixedContentField } from './MixedContentField';
import { seedSegments } from './MixedContentField/segments';
import {
  buildLayoutGroup,
  BORDER_GROUP,
  EFFECTS_GROUP,
  NODE_FIELD_CONFIGS,
  NODE_GROUP,
  UI_ROOT_GROUP,
  type FieldConfig,
} from './field-configs';

import './PropertyPanel.css';

// YGUnit numeric mapping (verified in ui_transform.gen.d.ts).
const YGU_UNDEFINED = 0;
const YGU_POINT = 1;
const YGU_PERCENT = 2;

type Color4 = { r: number; g: number; b: number; a?: number };

// PB `repeated` and required scalar fields must be present on the serialized
// object — leaving them undefined crashes the generated encoder ("uvs is not
// iterable"). We apply these defaults whenever we createOrReplace a fresh
// component on an entity from the property panel.
const COMPONENT_DEFAULTS: Record<string, Record<string, unknown>> = {
  'core::UiBackground': {
    textureMode: 0, // BackgroundTextureMode.NINE_SLICES
    uvs: [0, 0, 0, 1, 1, 0, 1, 0], // proto default winding from ui_background.proto
  },
  'core::UiInput': {
    placeholder: '',
    disabled: false,
  },
  'core::UiDropdown': {
    acceptEmpty: false,
    disabled: false,
    options: [],
    selectedIndex: 0,
  },
};

function resolveComponent(
  engine: IEngine,
  componentId: string,
): LastWriteWinElementSetComponentDefinition<Record<string, unknown>> | null {
  return engine.getComponentOrNull(componentId) as LastWriteWinElementSetComponentDefinition<
    Record<string, unknown>
  > | null;
}

function clampNumber(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

// For a `writeAll` field, replicate a single value across all target paths.
// When `withUnit` is given, also writes each path's `${path}Unit` companion.
function expandWriteAll(
  paths: string[],
  value: unknown,
  withUnit?: { unit: number },
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const p of paths) {
    patch[p] = value;
    if (withUnit) patch[`${p}Unit`] = withUnit.unit;
  }
  return patch;
}

const PropertyPanelComponent: React.FC = () => {
  const sdk = useSdk();
  const selected = useAppSelector(getSelectedNode);
  const selectedRoot = useAppSelector(getSelectedRoot);
  // Bump on engine change to re-read component values without rebuilding the tree.
  const [tick, setTick] = useState(0);
  const debouncedBump = useMemo(() => debounce(() => setTick(t => t + 1), 10), []);
  useChange(debouncedBump, []);

  const type: UINodeType | null = useMemo(() => {
    if (!sdk || selected === null) return null;
    const bag = getComponentBag(sdk.engine);
    if (!bag.UiTransform || !bag.UiTransform.has(selected as Entity)) return null;
    // `tick` (in the dep array) re-runs this when components are added/removed on the entity.
    return classifyNode(bag, selected as Entity);
  }, [sdk, selected, tick]);

  // True when the selected entity carries the `asset-packs::UI` marker —
  // i.e. it's a UI root, not a child node. We expose Name + Visible at the
  // top of the panel only in that case.
  const isUIRoot = useMemo(() => {
    if (!sdk || selected === null) return false;
    const UI = sdk.engine.getComponentOrNull('asset-packs::UI');
    return !!UI && UI.has(selected as Entity);
  }, [sdk, selected, tick]);

  // Read `asset-packs::UIBindings` on the selected entity and build a map
  // from `componentId.fieldPath` to bound variable name. Re-runs on engine
  // change via the existing `tick` from `useChange + debouncedBump`.
  const bindingsByField = useMemo<Record<string, string>>(() => {
    if (!sdk || selected === null) return {};
    const Bindings = sdk.engine.getComponentOrNull(
      ComponentName.UI_BINDINGS,
    ) as LastWriteWinElementSetComponentDefinition<UIBindings> | null;
    if (!Bindings) return {};
    const value = Bindings.getOrNull(selected as Entity);
    if (!value) return {};
    return Object.fromEntries(
      value.value.filter(b => !b.segments?.length).map(b => [b.field, b.variable]),
    );
  }, [sdk, selected, tick]);

  // Mixed-content rows live in the same `UIBindings` component (rows carrying a
  // non-empty `segments` list). Map `componentId.fieldPath` -> segment list.
  const mixedByField = useMemo<Record<string, UISegment[]>>(() => {
    if (!sdk || selected === null) return {};
    const Bindings = sdk.engine.getComponentOrNull(
      ComponentName.UI_BINDINGS,
    ) as LastWriteWinElementSetComponentDefinition<UIBindings> | null;
    if (!Bindings) return {};
    const value = Bindings.getOrNull(selected as Entity);
    if (!value) return {};
    return Object.fromEntries(
      value.value.filter(b => b.segments?.length).map(b => [b.field, b.segments as UISegment[]]),
    );
  }, [sdk, selected, tick]);

  const writeAndDispatch = useCallback(
    (componentId: string, patch: Record<string, unknown>) => {
      if (!sdk || selected === null) return;
      const component = resolveComponent(sdk.engine, componentId);
      if (!component) return;
      const entity = selected as Entity;
      const current = component.getOrNull(entity);
      if (current === null) {
        // Component not yet on the entity — create with required-field
        // defaults merged in so the PB serializer doesn't crash on missing
        // repeated/required scalars (e.g. UiBackground.uvs, UiInput.disabled).
        const defaults = COMPONENT_DEFAULTS[componentId] ?? {};
        component.createOrReplace(entity, { ...defaults, ...patch });
      } else {
        sdk.operations.updateValue(component, entity, patch);
      }
      void sdk.operations.dispatch();
    },
    [sdk, selected],
  );

  if (!sdk || selected === null || type === null) {
    return (
      <div className="ui-designer-property-panel-empty">
        <p>Select a node to edit its properties.</p>
      </div>
    );
  }

  const config = NODE_FIELD_CONFIGS[type];
  // Build the Layout group dynamically:
  //   - Visible (boolean) lives at the top of Layout only for UI roots.
  //   - Display / Flex direction / Justify / Align items are
  //     CONTAINER-only fields (UiEntity); leaves don't need them.
  //   - Size / Position type / Position / Padding / Margin always show.
  // Naming group on top:
  //   - Roots get UI (Name) — letting creators name e.g. "MainHUD".
  //   - Child nodes get Node (Name) — feeds the auto-generated
  //     `entity-names.ts` for scene code (`SceneEntityNames.ScoreText`, …).
  const layoutGroup = buildLayoutGroup(isUIRoot, type === 'UiEntity');
  const groups = isUIRoot
    ? [UI_ROOT_GROUP, layoutGroup, ...config.groups, EFFECTS_GROUP, BORDER_GROUP]
    : [NODE_GROUP, layoutGroup, ...config.groups, EFFECTS_GROUP, BORDER_GROUP];

  return (
    <div className="ui-designer-property-panel">
      {groups.map(group => (
        <Container
          key={group.title}
          label={group.title}
        >
          {group.fields.map(field => {
            const component = resolveComponent(sdk.engine, field.componentId);
            const value = component?.getOrNull(selected as Entity) ?? null;
            return (
              <FieldRow
                key={`${field.componentId}:${field.path}:${field.label}`}
                field={field}
                componentValue={value as Record<string, unknown> | null}
                entity={selected as Entity}
                selectedRoot={(selectedRoot ?? selected) as Entity}
                bound={bindingsByField[`${field.componentId}.${field.path}`]}
                bindings={bindingsByField}
                mixed={mixedByField[`${field.componentId}.${field.path}`]}
                onPatch={patch => writeAndDispatch(field.componentId, patch)}
              />
            );
          })}
        </Container>
      ))}
    </div>
  );
};

interface FieldRowProps {
  field: FieldConfig;
  componentValue: Record<string, unknown> | null;
  entity: Entity;
  selectedRoot: Entity;
  bound?: string;
  bindings?: Record<string, string>;
  mixed?: UISegment[];
  onPatch: (patch: Record<string, unknown>) => void;
}

const FieldRow: React.FC<FieldRowProps> = ({
  field,
  componentValue,
  entity,
  selectedRoot,
  bound,
  bindings,
  mixed,
  onPatch,
}) => {
  const boundProp = bound ? { variable: bound } : undefined;
  const raw = componentValue?.[field.path];
  const fieldDisabled =
    field.disabledWhen?.((componentValue ?? {}) as Record<string, unknown>) ?? false;

  switch (field.kind) {
    case 'string': {
      if (field.mixable) {
        return (
          <Block
            label={field.label}
            info={field.info}
          >
            <MixedContentField
              field={field}
              entity={entity}
              selectedRoot={selectedRoot}
              segments={seedSegments(raw, mixed, bound)}
              onPatch={onPatch}
            />
          </Block>
        );
      }
      const v = (raw as string | undefined) ?? '';
      return (
        <BindableField
          field={field}
          entity={entity}
          selectedRoot={selectedRoot}
          bound={boundProp}
        >
          <TextField
            value={v}
            onChange={e => {
              const next = e.target.value;
              if (field.path === 'src' && next.includes('..')) return;
              onPatch({ [field.path]: next });
            }}
          />
        </BindableField>
      );
    }
    case 'number': {
      const v = (raw as number | undefined) ?? 0;
      return (
        <BindableField
          field={field}
          entity={entity}
          selectedRoot={selectedRoot}
          bound={boundProp}
        >
          <TextField
            type="number"
            value={String(v)}
            onChange={e => onPatch({ [field.path]: clampNumber(e.target.value) })}
          />
        </BindableField>
      );
    }
    case 'boolean': {
      // Inline `Label  [checkbox]` — saves vertical space when there are
      // many toggles (e.g. Visible / Disabled / etc.) and uses the wide
      // horizontal area of the right rail.
      const v = !!raw;
      return (
        <BindableField
          field={field}
          entity={entity}
          selectedRoot={selectedRoot}
          bound={boundProp}
        >
          <input
            type="checkbox"
            checked={v}
            onChange={e => onPatch({ [field.path]: e.target.checked })}
          />
        </BindableField>
      );
    }
    case 'enum': {
      // Inline `Label  [dropdown]` — see boolean above for rationale.
      const v = (raw as number | undefined) ?? 0;
      return (
        <BindableField
          field={field}
          entity={entity}
          selectedRoot={selectedRoot}
          bound={boundProp}
        >
          <select
            value={String(v)}
            onChange={e => onPatch({ [field.path]: Number(e.target.value) })}
          >
            {field.options?.map(opt => (
              <option
                key={opt.value}
                value={String(opt.value)}
              >
                {opt.label}
              </option>
            ))}
          </select>
        </BindableField>
      );
    }
    case 'length': {
      // Flat-PB shape: `(value: number, valueUnit: YGUnit)` pair as siblings.
      const unitKey = `${field.path}Unit`;
      const numeric = (componentValue?.[field.path] as number | undefined) ?? 0;
      const unitRaw = (componentValue?.[unitKey] as number | undefined) ?? YGU_UNDEFINED;
      // `YGU_UNDEFINED` is the proto default for never-written fields; surface
      // it in the UI as `pixel` since that's the most common authoring intent.
      const unit = unitRaw === YGU_UNDEFINED ? YGU_POINT : unitRaw;
      return (
        <BindableField
          field={field}
          entity={entity}
          selectedRoot={selectedRoot}
          bound={boundProp}
        >
          <div className="ui-designer-length-row">
            <TextField
              type="number"
              value={String(numeric)}
              onChange={e =>
                onPatch(
                  field.writeAll
                    ? expandWriteAll(field.writeAll, clampNumber(e.target.value), { unit })
                    : { [field.path]: clampNumber(e.target.value), [unitKey]: unit },
                )
              }
            />
            <select
              value={String(unit)}
              onChange={e => {
                const nextUnit = Number(e.target.value);
                const parent = measureParentBox(entity as unknown as number);
                const dim = parent ? parent[axisForPath(field.path)] : 0;
                const nextValue = convertLength(numeric, unit, nextUnit, dim);
                onPatch(
                  field.writeAll
                    ? expandWriteAll(field.writeAll, nextValue, { unit: nextUnit })
                    : { [field.path]: nextValue, [unitKey]: nextUnit },
                );
              }}
            >
              <option value={String(YGU_POINT)}>px</option>
              <option value={String(YGU_PERCENT)}>%</option>
            </select>
          </div>
        </BindableField>
      );
    }
    case 'length-vec': {
      // Vec group — TextFields stack vertically inside the Block, matching
      // how `TransformInspector` lays out Position/Rotation/Scale (X/Y/Z).
      // Each sub-field writes a `(path, pathUnit)` pair. Shared unit selector
      // sits at the bottom of the group.
      const subs = field.subFields ?? [];
      const firstUnitKey = subs[0] ? `${subs[0].path}Unit` : '';
      const firstUnitRaw = (componentValue?.[firstUnitKey] as number | undefined) ?? YGU_UNDEFINED;
      const unit = firstUnitRaw === YGU_UNDEFINED ? YGU_POINT : firstUnitRaw;
      return (
        <BindableField
          field={field}
          entity={entity}
          selectedRoot={selectedRoot}
          bound={boundProp}
        >
          {subs.map(sub => {
            const v = (componentValue?.[sub.path] as number | undefined) ?? 0;
            const subBound = bindings?.[`${field.componentId}.${sub.path}`];
            return (
              <BindableSubField
                key={sub.path}
                field={{
                  componentId: field.componentId,
                  path: sub.path,
                  kind: 'length',
                }}
                entity={entity}
                selectedRoot={selectedRoot}
                bound={subBound}
              >
                <TextField
                  type="number"
                  leftLabel={sub.leftLabel}
                  value={String(v)}
                  onChange={e =>
                    onPatch({
                      [sub.path]: clampNumber(e.target.value),
                      [`${sub.path}Unit`]: unit,
                    })
                  }
                />
              </BindableSubField>
            );
          })}
          <div className="ui-designer-unit-selector">
            <select
              value={String(unit)}
              onChange={e => {
                const nextUnit = Number(e.target.value);
                const parent = measureParentBox(entity as unknown as number);
                const patch: Record<string, unknown> = {};
                for (const sub of subs) {
                  const cur = (componentValue?.[sub.path] as number | undefined) ?? 0;
                  const dim = parent ? parent[axisForPath(sub.path)] : 0;
                  patch[sub.path] = convertLength(cur, unit, nextUnit, dim);
                  patch[`${sub.path}Unit`] = nextUnit;
                }
                onPatch(patch);
              }}
            >
              <option value={String(YGU_POINT)}>px</option>
              <option value={String(YGU_PERCENT)}>%</option>
            </select>
          </div>
        </BindableField>
      );
    }
    case 'quad-pixels': {
      // 4-axis pixel-only group (T/R/B/L) for padding & margin. Stacked
      // vertically like the rest of the inspector; no unit selector — always
      // written as YGU_POINT.
      const subs = field.subFields ?? [];
      return (
        <BindableField
          field={field}
          entity={entity}
          selectedRoot={selectedRoot}
          bound={boundProp}
        >
          {subs.map(sub => {
            const v = (componentValue?.[sub.path] as number | undefined) ?? 0;
            const subBound = bindings?.[`${field.componentId}.${sub.path}`];
            return (
              <BindableSubField
                key={sub.path}
                field={{
                  componentId: field.componentId,
                  path: sub.path,
                  kind: 'length',
                }}
                entity={entity}
                selectedRoot={selectedRoot}
                bound={subBound}
              >
                <TextField
                  type="number"
                  leftLabel={sub.leftLabel}
                  value={String(v)}
                  disabled={fieldDisabled}
                  onChange={e =>
                    onPatch({
                      [sub.path]: clampNumber(e.target.value),
                      [`${sub.path}Unit`]: YGU_POINT,
                    })
                  }
                />
              </BindableSubField>
            );
          })}
        </BindableField>
      );
    }
    case 'color': {
      const c = (raw as Color4 | undefined) ?? {
        r: 0,
        g: 0,
        b: 0,
        a: 1,
      };
      return (
        <BindableField
          field={field}
          entity={entity}
          selectedRoot={selectedRoot}
          bound={boundProp}
        >
          <RgbaColorField
            value={c}
            onChange={next =>
              onPatch(
                field.writeAll ? expandWriteAll(field.writeAll, next) : { [field.path]: next },
              )
            }
          />
        </BindableField>
      );
    }
    case 'string-array': {
      const arr = (raw as string[] | undefined) ?? [];
      return (
        <BindableField
          field={field}
          entity={entity}
          selectedRoot={selectedRoot}
          bound={boundProp}
        >
          <textarea
            className="ui-designer-string-array"
            value={arr.join('\n')}
            onChange={e => onPatch({ [field.path]: e.target.value.split('\n') })}
          />
        </BindableField>
      );
    }
    case 'index': {
      const v = (raw as number | undefined) ?? 0;
      return (
        <BindableField
          field={field}
          entity={entity}
          selectedRoot={selectedRoot}
          bound={boundProp}
        >
          <TextField
            type="number"
            value={String(v)}
            onChange={e => onPatch({ [field.path]: clampNumber(e.target.value) })}
          />
        </BindableField>
      );
    }
    case 'callback': {
      return (
        <BindableField
          field={field}
          entity={entity}
          selectedRoot={selectedRoot}
          bound={boundProp}
        >
          <span className="ui-designer-callback-hint">Bind a callback variable…</span>
        </BindableField>
      );
    }
    default:
      return null;
  }
};

export const PropertyPanel = React.memo(PropertyPanelComponent);

export default PropertyPanel;
