import React, { useCallback, useMemo, useState } from 'react';
import { IoOptionsOutline } from 'react-icons/io5';
import type {
  Entity,
  IEngine,
  LastWriteWinElementSetComponentDefinition,
  TextureUnion,
} from '@dcl/ecs';
import type { UIBindings, UISegment } from '@dcl/asset-packs';
import { ComponentName } from '@dcl/asset-packs';

import { useChange } from '../../hooks/sdk/useChange';
import { useSdk } from '../../hooks/sdk/useSdk';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  getCollapsedGroups,
  getSelectedNode,
  getSelectedRoot,
  setGroupCollapsed,
} from '../../redux/ui-designer';
import { Block } from '../Block';
import { Button } from '../Button';
import { Container } from '../Container';
import Search from '../Search';
import { TextField } from '../ui';
import { RgbaColorField } from '../ui/RgbaColorField';
import { debounce } from '../../lib/utils/debounce';
import { UI_REQUIRED_FIELD_DEFAULTS } from '../../lib/sdk/operations/ui-component-defaults';
import { measureParentBox, measureNodeOffset, axisForPath, convertLength } from './measure';
import { classifyNode, getComponentBag, type UINodeType } from './tree-model';
import { CodeBindingsSection } from './code/CodeBindingsSection';
import { UI_DESIGNER_CODE_MODE } from './code/config';
import { codeComponentValue, findCodeNode, spliceComponentPatch, useCodeState } from './code/store';
import type { CodeUINode } from './code/types';
import { AnchorPresetField } from './AnchorPresetField';
import { BindableField } from './BindableField';
import { BoxModelField } from './BoxModelField';
import { BindableSubField } from './BindableSubField';
import { EmptyState } from './EmptyState';
import { MixedContentField } from './MixedContentField';
import { seedSegments } from './MixedContentField/segments';
import { TextureField } from './TextureField';
import { regionToUvs, uvsToRegion } from './uv-region';
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

import {
  YGU_UNDEFINED,
  YGU_POINT,
  YGU_PERCENT,
  YGPT_RELATIVE,
  YGPT_ABSOLUTE,
} from '../../lib/sdk/ui-transform-constants';

type Color4 = { r: number; g: number; b: number; a?: number };

// Defaults applied whenever the panel createOrReplaces a fresh component on an entity:
// the shared serializer-safe baseline (UI_REQUIRED_FIELD_DEFAULTS) plus the panel's own
// minimal-safe visual values. Property edits override these via the patch.
const COMPONENT_DEFAULTS: Record<string, Record<string, unknown>> = {
  'core::UiBackground': {
    ...UI_REQUIRED_FIELD_DEFAULTS['core::UiBackground'],
    // Transparent by default — a freshly-created background (e.g. on the UI root, which
    // spans the whole canvas) must not paint an opaque rectangle over the scene. PB's
    // own default color is opaque white, so we set a:0 explicitly.
    color: { r: 0, g: 0, b: 0, a: 0 },
  },
  'core::UiInput': {
    ...UI_REQUIRED_FIELD_DEFAULTS['core::UiInput'],
    placeholder: '',
  },
  'core::UiDropdown': {
    ...UI_REQUIRED_FIELD_DEFAULTS['core::UiDropdown'],
    options: [],
  },
};

// Optional UI render components the panel lets you add/remove per node. Sections
// for these render only when the component is present; when absent they surface
// in "+ Add component". (Type-defining components — UiText on a Label, UiInput,
// UiDropdown — are never here: removing them would reclassify the node.)
const OPTIONAL_UI_COMPONENTS = new Set<string>(['core::UiBackground']);

// Components whose values are copy/paste-able via the group's MoreOptionsMenu.
// Enabled on the FIRST group carrying each id (Layout wins UiTransform over
// Effects/Border), so one component is never offered twice.
const CLIPBOARD_UI_COMPONENTS = new Set<string>([
  'core::UiTransform',
  'core::UiBackground',
  'core::UiText',
  'core::UiInput',
  'core::UiDropdown',
]);

const UI_COMPONENT_LABELS: Record<string, string> = {
  'core::UiBackground': 'Background',
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
  const dispatch = useAppDispatch();
  const selected = useAppSelector(getSelectedNode);
  const selectedRoot = useAppSelector(getSelectedRoot);
  const collapsed = useAppSelector(getCollapsedGroups);
  const [query, setQuery] = useState('');
  // Bump on engine change to re-read component values without rebuilding the tree.
  const [tick, setTick] = useState(0);
  const debouncedBump = useMemo(() => debounce(() => setTick(t => t + 1), 10), []);
  useChange(debouncedBump, []);

  // Code-mode: the selected node's data comes from the parsed .tsx tree (by its
  // synthetic id), not the ECS engine.
  const codeState = useCodeState();
  const codeNode: CodeUINode | undefined = useMemo(
    () =>
      UI_DESIGNER_CODE_MODE && selected !== null
        ? findCodeNode(
            codeState.parsed?.root as CodeUINode | undefined,
            selected as unknown as number,
          )
        : undefined,
    [codeState, selected],
  );

  const type: UINodeType | null = useMemo(() => {
    if (UI_DESIGNER_CODE_MODE) return codeNode?.type ?? null;
    if (!sdk || selected === null) return null;
    const bag = getComponentBag(sdk.engine);
    if (!bag.UiTransform || !bag.UiTransform.has(selected as Entity)) return null;
    // `tick` (in the dep array) re-runs this when components are added/removed on the entity.
    return classifyNode(bag, selected as Entity);
  }, [sdk, selected, tick, codeNode]);

  // True when the selected entity carries the `asset-packs::UI` marker —
  // i.e. it's a UI root, not a child node. We expose Name + Visible at the
  // top of the panel only in that case.
  const isUIRoot = useMemo(() => {
    if (UI_DESIGNER_CODE_MODE) return false;
    if (!sdk || selected === null) return false;
    const UI = sdk.engine.getComponentOrNull('asset-packs::UI');
    return !!UI && UI.has(selected as Entity);
  }, [sdk, selected, tick]);

  // Read the raw `asset-packs::UIBindings` value once. Its reference is stable
  // across ticks where bindings didn't change, so the two derived maps below only
  // rebuild on an actual bindings change — not on every engine tick — keeping each
  // FieldRow's `bindings`/`mixed` props referentially stable (so the memoized rows
  // can bail out).
  const bindingsValue = useMemo(() => {
    if (!sdk || selected === null) return null;
    const Bindings = sdk.engine.getComponentOrNull(
      ComponentName.UI_BINDINGS,
    ) as LastWriteWinElementSetComponentDefinition<UIBindings> | null;
    return Bindings?.getOrNull(selected as Entity) ?? null;
  }, [sdk, selected, tick]);

  // Map `componentId.fieldPath` -> bound variable name (rows without segments).
  const bindingsByField = useMemo<Record<string, string>>(() => {
    if (!bindingsValue) return {};
    return Object.fromEntries(
      bindingsValue.value.filter(b => !b.segments?.length).map(b => [b.field, b.variable]),
    );
  }, [bindingsValue]);

  // Mixed-content rows live in the same `UIBindings` component (rows carrying a
  // non-empty `segments` list). Map `componentId.fieldPath` -> segment list.
  const mixedByField = useMemo<Record<string, UISegment[]>>(() => {
    if (!bindingsValue) return {};
    return Object.fromEntries(
      bindingsValue.value
        .filter(b => b.segments?.length)
        .map(b => [b.field, b.segments as UISegment[]]),
    );
  }, [bindingsValue]);

  const writeAndDispatch = useCallback(
    (componentId: string, patch: Record<string, unknown>) => {
      if (selected === null) return;
      // Code-mode: route the patch to a .tsx source splice instead of the ECS.
      if (UI_DESIGNER_CODE_MODE) {
        void spliceComponentPatch(selected as unknown as number, componentId, patch);
        return;
      }
      if (!sdk) return;
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

  const addUIComponent = useCallback(
    (componentId: string) => {
      if (!sdk || selected === null) return;
      const component = resolveComponent(sdk.engine, componentId);
      if (!component) return;
      const defaults = COMPONENT_DEFAULTS[componentId] ?? {};
      // addComponent op uses component.create(entity, value) — pass the
      // serializer-safe defaults so the PB encoder doesn't crash on a missing
      // repeated/required field (e.g. UiBackground.uvs).
      sdk.operations.addComponent(selected as Entity, component.componentId, defaults);
      void sdk.operations.dispatch();
    },
    [sdk, selected],
  );

  const removeUIComponent = useCallback(
    (componentId: string) => {
      if (!sdk || selected === null) return;
      const component = resolveComponent(sdk.engine, componentId);
      if (!component) return;
      sdk.operations.removeComponent(selected as Entity, component);
      void sdk.operations.dispatch();
    },
    [sdk, selected],
  );

  if (!sdk || selected === null || type === null) {
    return (
      <EmptyState
        icon={<IoOptionsOutline />}
        title="No node selected"
        message="Select a node on the canvas or in the tree to edit its properties."
      />
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
  const eventGroups = config.groups.filter(g => /event/i.test(g.title));
  const contentGroups = config.groups.filter(g => !/event/i.test(g.title));
  const head = isUIRoot ? UI_ROOT_GROUP : NODE_GROUP;

  // The root IS the screen: it needs only identity (UI_ROOT_GROUP) + layout
  // (padding). Border / Effects / Mouse-events don't apply to the frame.
  const trailing = isUIRoot ? [] : [EFFECTS_GROUP, BORDER_GROUP, ...eventGroups];
  const allGroups = [head, layoutGroup, ...contentGroups, ...trailing];

  // A group's single backing component id, or null when it spans several
  // (e.g. the root Layout group mixes the UI marker's Visible with UiTransform).
  const groupComponentId = (g: { fields: FieldConfig[] }): string | null => {
    const ids = new Set(g.fields.map(f => f.componentId));
    return ids.size === 1 ? (g.fields[0]?.componentId ?? null) : null;
  };
  const hasComponent = (componentId: string): boolean =>
    UI_DESIGNER_CODE_MODE
      ? codeComponentValue(codeNode, componentId) != null
      : !!resolveComponent(sdk.engine, componentId)?.has(selected as Entity);

  // Presence-driven: hide an optional component's section until it's added.
  const visibleGroups = allGroups.filter(g => {
    const cid = groupComponentId(g);
    return cid && OPTIONAL_UI_COMPONENTS.has(cid) ? hasComponent(cid) : true;
  });

  // Optional components not yet present on the node (order-stable from the set).
  // Add-component isn't wired for code-mode yet (would need to insert the
  // attr/prop into source), so no add buttons there for now.
  const addableComponents = UI_DESIGNER_CODE_MODE
    ? []
    : [...OPTIONAL_UI_COMPONENTS].filter(cid => !hasComponent(cid));

  // First-occurrence guard so a component (esp. UiTransform, shared by
  // Layout/Effects/Border) offers clipboard on exactly one group.
  const clipboardSeen = new Set<string>();

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  return (
    <div className="ui-designer-property-panel">
      <div className="ui-designer-property-search">
        <Search
          value={query}
          onChange={setQuery}
          placeholder="Search properties…"
        />
      </div>
      {UI_DESIGNER_CODE_MODE ? <CodeBindingsSection /> : null}
      {visibleGroups.map(group => {
        const cid = groupComponentId(group);
        // Clipboard on the first group of each allowed component.
        let clipboardComponent = null;
        if (cid && CLIPBOARD_UI_COMPONENTS.has(cid) && !clipboardSeen.has(cid)) {
          clipboardSeen.add(cid);
          clipboardComponent = resolveComponent(sdk.engine, cid);
        }
        // Remove only optional components that are present.
        const onRemoveContainer =
          cid && OPTIONAL_UI_COMPONENTS.has(cid) ? () => removeUIComponent(cid) : undefined;

        // While searching, show only matching fields and force every group open
        // so matches aren't hidden behind a collapsed header.
        const fields = searching
          ? group.fields.filter(field => (field.label ?? '').toLowerCase().includes(q))
          : group.fields;
        if (searching && fields.length === 0) return null;
        return (
          <Container
            // Re-key when toggling search so initialOpen re-seeds (Container
            // owns its open state once mounted).
            key={searching ? `${group.title}::search` : group.title}
            label={group.title}
            initialOpen={searching ? true : !collapsed[group.title]}
            onToggle={open => dispatch(setGroupCollapsed({ title: group.title, collapsed: !open }))}
            entity={clipboardComponent ? (selected as Entity) : undefined}
            component={clipboardComponent ?? undefined}
            onRemoveContainer={onRemoveContainer}
          >
            {fields.map(field => {
              // Code-mode reads field values from the parsed node; ECS mode reads
              // them from the live component on the selected entity.
              const value = UI_DESIGNER_CODE_MODE
                ? codeComponentValue(codeNode, field.componentId)
                : (resolveComponent(sdk.engine, field.componentId)?.getOrNull(selected as Entity) ??
                  null);
              if ((field as FieldConfig).hiddenWhen?.((value ?? {}) as Record<string, unknown>))
                return null;
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
                  write={writeAndDispatch}
                />
              );
            })}
          </Container>
        );
      })}
      {!searching && addableComponents.length > 0 ? (
        <div className="ui-designer-add-component">
          {addableComponents.map(cid => (
            <Button
              key={cid}
              onClick={() => addUIComponent(cid)}
            >
              + Add {UI_COMPONENT_LABELS[cid] ?? cid}
            </Button>
          ))}
        </div>
      ) : null}
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
  // The stable component writer; FieldRow binds it to its own field.componentId.
  // Passing the writer (not a per-field arrow) keeps the prop stable so the
  // memoized row only re-renders when its value/bindings actually change.
  write: (componentId: string, patch: Record<string, unknown>) => void;
}

const FieldRow = React.memo(function FieldRow({
  field,
  componentValue,
  entity,
  selectedRoot,
  bound,
  bindings,
  mixed,
  write,
}: FieldRowProps) {
  const onPatch = useCallback(
    (patch: Record<string, unknown>) => write(field.componentId, patch),
    [write, field.componentId],
  );
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
            onChange={e =>
              onPatch({
                [field.path]: field.sanitize ? field.sanitize(e.target.value) : e.target.value,
              })
            }
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
            aria-label={field.label}
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
              aria-label="Unit"
              value={String(unit)}
              onChange={e => {
                const nextUnit = Number(e.target.value);
                const parent = measureParentBox(entity);
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
              aria-label="Unit"
              value={String(unit)}
              onChange={e => {
                const nextUnit = Number(e.target.value);
                const parent = measureParentBox(entity);
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
    case 'texture': {
      // The PBUiBackground `texture` key is a discriminated `TextureUnion`
      // (file / avatar / video variants). `TextureField` owns variant
      // selection, per-variant editing, and file-path validation.
      return (
        <Block
          label={field.label}
          info={field.info}
        >
          <TextureField
            value={componentValue?.texture as TextureUnion | undefined}
            onChange={next => {
              const color = componentValue?.color as
                | { r: number; g: number; b: number; a?: number }
                | undefined;
              const transparent = !color || (color.a ?? 1) === 0;
              // A textured background almost always wants full-opacity display;
              // a transparent tint is only meaningful for a solid color fill.
              const tint = next && transparent ? { color: { r: 1, g: 1, b: 1, a: 1 } } : {};
              onPatch({ texture: next, ...tint });
            }}
          />
        </Block>
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
    case 'position-mode': {
      const v = (raw as number | undefined) ?? YGPT_RELATIVE;
      const onModeChange = (next: number) => {
        if (next === v) return;
        if (next === YGPT_ABSOLUTE) {
          // Bake the current on-screen offset so switching modes never moves the node.
          const offset = measureNodeOffset(entity);
          onPatch({
            positionType: YGPT_ABSOLUTE,
            positionTop: offset?.top ?? 0,
            positionTopUnit: YGU_POINT,
            positionLeft: offset?.left ?? 0,
            positionLeftUnit: YGU_POINT,
            positionRight: 0,
            positionRightUnit: YGU_UNDEFINED,
            positionBottom: 0,
            positionBottomUnit: YGU_UNDEFINED,
          });
        } else {
          // Back into flow: clear baked offsets — Yoga applies position* to
          // RELATIVE nodes too, so stale values would shift the node in flow.
          onPatch({
            positionType: YGPT_RELATIVE,
            positionTop: 0,
            positionTopUnit: YGU_UNDEFINED,
            positionRight: 0,
            positionRightUnit: YGU_UNDEFINED,
            positionBottom: 0,
            positionBottomUnit: YGU_UNDEFINED,
            positionLeft: 0,
            positionLeftUnit: YGU_UNDEFINED,
          });
        }
      };
      return (
        <BindableField
          field={field}
          entity={entity}
          selectedRoot={selectedRoot}
          bound={boundProp}
        >
          <select
            aria-label={field.label}
            value={String(v)}
            onChange={e => onModeChange(Number(e.target.value))}
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
    case 'align-preset': {
      return (
        <Block
          label={field.label}
          info={field.info}
        >
          <AnchorPresetField
            value={componentValue}
            entity={entity}
            disabled={fieldDisabled}
            onPatch={onPatch}
          />
        </Block>
      );
    }
    case 'box-model': {
      return (
        <Block
          label={field.label}
          info={field.info}
        >
          <BoxModelField
            value={componentValue}
            onPatch={onPatch}
          />
        </Block>
      );
    }
    case 'uv-region': {
      const region = uvsToRegion(componentValue?.uvs as number[] | undefined);
      const setField = (key: keyof typeof region, raw: string) =>
        onPatch({ uvs: regionToUvs({ ...region, [key]: clampNumber(raw) }) });
      const rows: { key: keyof typeof region; leftLabel: string }[] = [
        { key: 'uMin', leftLabel: 'U₀' },
        { key: 'vMin', leftLabel: 'V₀' },
        { key: 'uMax', leftLabel: 'U₁' },
        { key: 'vMax', leftLabel: 'V₁' },
      ];
      return (
        <Block
          label={field.label}
          info={field.info}
        >
          {rows.map(r => (
            <TextField
              key={r.key}
              type="number"
              leftLabel={r.leftLabel}
              value={String(region[r.key])}
              onChange={e => setField(r.key, e.target.value)}
            />
          ))}
        </Block>
      );
    }
    case 'border-rect': {
      const rect = (raw as Record<string, number> | undefined) ?? {};
      const setSide = (side: string, v: string) =>
        onPatch({ textureSlices: { ...rect, [side]: clampNumber(v) } });
      const sides: { key: string; leftLabel: string }[] = [
        { key: 'top', leftLabel: 'T' },
        { key: 'right', leftLabel: 'R' },
        { key: 'bottom', leftLabel: 'B' },
        { key: 'left', leftLabel: 'L' },
      ];
      return (
        <Block
          label={field.label}
          info={field.info}
        >
          {sides.map(s => (
            <TextField
              key={s.key}
              type="number"
              leftLabel={s.leftLabel}
              value={String(rect[s.key] ?? 0)}
              onChange={e => setSide(s.key, e.target.value)}
            />
          ))}
        </Block>
      );
    }
    default:
      return null;
  }
});

export const PropertyPanel = React.memo(PropertyPanelComponent);

export default PropertyPanel;
