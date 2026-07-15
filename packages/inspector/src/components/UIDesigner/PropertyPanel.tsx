import React, { useCallback, useMemo, useState } from 'react';
import { IoOptionsOutline } from 'react-icons/io5';
import type { Entity, TextureUnion } from '@dcl/ecs';

import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { getCollapsedGroups, getSelectedNode, setGroupCollapsed } from '../../redux/ui-designer';
import { Block } from '../Block';
import { Container } from '../Container';
import Search from '../Search';
import { TextField } from '../ui';
import { RgbaColorField } from '../ui/RgbaColorField';
import { measureParentBox, measureNodeOffset, axisForPath, convertLength } from './measure';
import { type CanvasSegment, type UINodeType } from './tree-model';
import { codeComponentValue, findCodeNode, spliceComponentPatch, useCodeState } from './code/store';
import { ComponentRefPanel } from './code/ComponentRefPanel';
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
  const dispatch = useAppDispatch();
  const selected = useAppSelector(getSelectedNode);
  const collapsed = useAppSelector(getCollapsedGroups);
  const [query, setQuery] = useState('');

  // Code-mode: the selected node's data comes from the parsed .tsx tree (by its
  // synthetic id), not the ECS engine.
  const codeState = useCodeState();
  const codeNode: CodeUINode | undefined = useMemo(
    () =>
      selected !== null
        ? findCodeNode(
            codeState.parsed?.root as CodeUINode | undefined,
            selected as unknown as number,
          )
        : undefined,
    [codeState, selected],
  );

  const type: UINodeType | null = useMemo(() => codeNode?.type ?? null, [codeNode]);

  // Bindings come from the parsed source (`node.bindings`, keyed by
  // `componentId.field`): a `value={state.x}` attribute is a single-variable
  // binding, a `value={`…${x}…`}` template is mixed content.
  const { bindingsByField, mixedByField } = useMemo(() => {
    const byField: Record<string, string> = {};
    const mixed: Record<string, CanvasSegment[]> = {};
    for (const row of codeNode?.bindings ?? []) {
      if (row.segments && row.segments.length > 0) mixed[row.field] = row.segments;
      else byField[row.field] = row.variable;
    }
    return { bindingsByField: byField, mixedByField: mixed };
  }, [codeNode]);

  const writeAndDispatch = useCallback(
    (componentId: string, patch: Record<string, unknown>) => {
      if (selected === null) return;
      // Route the patch to a .tsx source splice.
      void spliceComponentPatch(selected as unknown as number, componentId, patch);
    },
    [selected],
  );

  if (selected === null || type === null) {
    return (
      <EmptyState
        icon={<IoOptionsOutline />}
        title="No node selected"
        message="Select a node on the canvas or in the tree to edit its properties."
      />
    );
  }

  // A nested component reference edits the values passed to the instance (its
  // props), not the generic UiEntity fields.
  if (codeNode?.componentRef) {
    return <ComponentRefPanel node={codeNode} />;
  }

  // The canvas drop wraps `<Name />` in a positioning UiEntity, and canvas
  // clicks select that WRAPPER (the ref block is click-transparent so the
  // wrapper stays draggable) — so surface the nested instance's props here
  // too, below the wrapper's own fields.
  const refChildren = (codeNode?.children ?? []).filter(c => c.componentRef);

  const config = NODE_FIELD_CONFIGS[type];
  // Build the Layout group dynamically:
  //   - Display / Flex direction / Justify / Align items are
  //     CONTAINER-only fields (UiEntity); leaves don't need them.
  //   - Size / Position type / Position / Padding / Margin always show.
  const layoutGroup = buildLayoutGroup(type === 'UiEntity');
  const eventGroups = config.groups.filter(g => /event/i.test(g.title));
  const contentGroups = config.groups.filter(g => !/event/i.test(g.title));
  const allGroups = [layoutGroup, ...contentGroups, EFFECTS_GROUP, BORDER_GROUP, ...eventGroups];

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
      {allGroups.map(group => {
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
          >
            {fields.map(field => {
              // Field values come from the parsed .tsx node (by synthetic id).
              const value = codeComponentValue(codeNode, field.componentId);
              if ((field as FieldConfig).hiddenWhen?.((value ?? {}) as Record<string, unknown>))
                return null;
              return (
                <FieldRow
                  key={`${field.componentId}:${field.path}:${field.label}`}
                  field={field}
                  componentValue={value as Record<string, unknown> | null}
                  entity={selected as Entity}
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
      {refChildren.map(child => (
        <ComponentRefPanel
          key={child.entity as unknown as number}
          node={child}
        />
      ))}
    </div>
  );
};

interface FieldRowProps {
  field: FieldConfig;
  componentValue: Record<string, unknown> | null;
  entity: Entity;
  bound?: string;
  bindings?: Record<string, string>;
  mixed?: CanvasSegment[];
  // The stable component writer; FieldRow binds it to its own field.componentId.
  // Passing the writer (not a per-field arrow) keeps the prop stable so the
  // memoized row only re-renders when its value/bindings actually change.
  write: (componentId: string, patch: Record<string, unknown>) => void;
}

const FieldRow = React.memo(function FieldRow({
  field,
  componentValue,
  entity,
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
              segments={seedSegments(raw, mixed, bound)}
            />
          </Block>
        );
      }
      const v = (raw as string | undefined) ?? '';
      return (
        <BindableField
          field={field}
          entity={entity}
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
      // Inline `Label  [dropdown]` — see boolean above for rationale. An unset
      // value shows the field's in-world default (e.g. textAlign → center),
      // falling back to the zero option.
      const v = (raw as number | undefined) ?? field.defaultValue ?? 0;
      return (
        <BindableField
          field={field}
          entity={entity}
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
          bound={boundProp}
        >
          <span className="ui-designer-callback-hint">Bind an event handler…</span>
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
