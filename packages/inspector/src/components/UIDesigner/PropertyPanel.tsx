import React, { useCallback, useMemo, useRef, useState } from 'react';
import { IoOptionsOutline, IoLockClosedOutline, IoLockOpenOutline } from 'react-icons/io5';
import { VscTrash } from 'react-icons/vsc';
import { AiOutlinePlus } from 'react-icons/ai';
import type { Entity, TextureUnion } from '@dcl/ecs';

import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  getAspectLockedNodes,
  getCollapsedGroups,
  getSelectedNode,
  setAspectLocked,
  setGroupCollapsed,
} from '../../redux/ui-designer';
import { Block } from '../Block';
import { Container } from '../Container';
import { CheckboxField, Dropdown, RgbaColorField, TextArea, TextField } from '../ui';
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

const UNIT_OPTIONS = [
  { value: YGU_POINT, label: 'px' },
  { value: YGU_PERCENT, label: '%' },
];

// --- Figma-style add/remove property model (Phase F) ---
// A field is one of three buckets:
//   • core        → always shown (structural props; see field-configs `core`).
//   • togglable   → a simple scalar-ish prop shown only when SET in source, with
//                   a `−` to unset it and a group `+ Add property` entry when
//                   unset. This is what tames the panel clutter.
//   • always-on   → composite / context-gated props (texture, box-model, anchor,
//                   uv-region, event callbacks) that stay visible (subject to
//                   their own hiddenWhen/disabledWhen).
const TOGGLABLE_KINDS = new Set([
  'number',
  'index',
  'boolean',
  'string',
  'string-array',
  'color',
  'enum',
  'length',
  'length-vec',
  'position-mode',
]);

function isTogglable(field: FieldConfig): boolean {
  return !field.core && !field.hiddenWhen && TOGGLABLE_KINDS.has(field.kind);
}

// Composite widgets that render full-width (stacked) rather than in the inline
// control column — the nested box-model and the 4-input texture editors need the
// width (Figma stacks these too). The 3×3 anchor grid is compact (~96px) and
// stays inline in the control column.
const WIDE_KINDS = new Set(['box-model', 'uv-region', 'border-rect']);

// The concrete PB paths whose presence means "this field is authored in source".
function fieldSetPaths(field: FieldConfig): string[] {
  if (field.writeAll) return field.writeAll;
  if (field.subFields) return field.subFields.map(s => s.path);
  return field.path ? [field.path] : [];
}

// The parser only populates keys physically present in source (ecs-shape never
// synthesizes proto defaults), so a present key means "explicitly set".
function isFieldSet(field: FieldConfig, value: Record<string, unknown> | null): boolean {
  if (!value) return false;
  return fieldSetPaths(field).some(p => p in value);
}

// Seed patch written when the user ADDS an optional prop — a sensible default so
// the newly-shown row isn't empty/degenerate (border width 1 so it's visible,
// opacity 1, enums at their default option, lengths in px).
function buildAddPatch(field: FieldConfig): Record<string, unknown> {
  switch (field.kind) {
    case 'number':
      return { [field.path]: field.path === 'opacity' ? 1 : 0 };
    case 'index':
      return { [field.path]: 0 };
    case 'boolean':
      return { [field.path]: false };
    case 'string':
      return { [field.path]: '' };
    case 'string-array':
      return { [field.path]: [] };
    case 'enum':
    case 'position-mode':
      return { [field.path]: field.defaultValue ?? field.options?.[0]?.value ?? 0 };
    case 'color': {
      const black = { r: 0, g: 0, b: 0, a: 1 };
      return field.writeAll ? expandWriteAll(field.writeAll, black) : { [field.path]: black };
    }
    case 'length': {
      const seed = /width/i.test(field.path) ? 1 : 0;
      return field.writeAll
        ? expandWriteAll(field.writeAll, seed, { unit: YGU_POINT })
        : { [field.path]: seed, [`${field.path}Unit`]: YGU_POINT };
    }
    case 'length-vec': {
      const patch: Record<string, unknown> = {};
      for (const s of field.subFields ?? []) {
        patch[s.path] = 0;
        patch[`${s.path}Unit`] = YGU_POINT;
      }
      return patch;
    }
    default:
      return {};
  }
}

// Unset patch written when the user REMOVES a prop — every set path (and its
// `Unit` companion; harmless where none exists) resolves to undefined, which the
// splice layer removes from source (uiTransformPatchEdits / setObjectFields /
// removeAttribute all treat undefined as "delete").
function buildRemovePatch(field: FieldConfig): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const p of fieldSetPaths(field)) {
    patch[p] = undefined;
    patch[`${p}Unit`] = undefined;
  }
  return patch;
}

// Native <details> disclosure — keyboard-accessible with no popover math. Lists
// the group's unset optional props; picking one splices its seed default.
const AddPropertyMenu: React.FC<{ fields: FieldConfig[]; onAdd: (f: FieldConfig) => void }> = ({
  fields,
  onAdd,
}) => {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details
      className="ui-designer-add-prop"
      ref={ref}
    >
      <summary className="ui-designer-add-prop-trigger">
        <AiOutlinePlus aria-hidden />
        Add property
      </summary>
      <ul className="ui-designer-add-prop-menu">
        {fields.map(f => (
          <li key={`${f.componentId}:${f.path}:${f.label}`}>
            <button
              type="button"
              onClick={() => {
                onAdd(f);
                if (ref.current) ref.current.open = false;
              }}
            >
              {f.label}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
};

const PropertyPanelComponent: React.FC = () => {
  const dispatch = useAppDispatch();
  const selected = useAppSelector(getSelectedNode);
  const collapsed = useAppSelector(getCollapsedGroups);

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

  return (
    <div className="ui-designer-property-panel">
      {/* A nested component's Inputs are the primary thing to edit on an instance,
          so surface them at the TOP — above the wrapper's Layout/Background groups
          (which only position the instance). */}
      {refChildren.map(child => (
        <ComponentRefPanel
          key={child.entity as unknown as number}
          node={child}
        />
      ))}
      {allGroups.map(group => {
        // Bucket each field: shown (core / set / always-on) → a row (with a `−`
        // when it's an optional set prop); togglable-and-unset → the group's
        // `+ Add property` menu. Field values come from the parsed .tsx node.
        const rows: React.ReactNode[] = [];
        const addable: FieldConfig[] = [];
        // The group consts have narrow inferred field types; treat them uniformly.
        for (const field of group.fields as FieldConfig[]) {
          const value = codeComponentValue(codeNode, field.componentId) as Record<
            string,
            unknown
          > | null;
          if (field.hiddenWhen?.((value ?? {}) as Record<string, unknown>)) continue;
          const togglable = isTogglable(field);
          if (togglable && !isFieldSet(field, value)) {
            addable.push(field);
            continue;
          }
          rows.push(
            <div
              className={`ui-designer-property-row${WIDE_KINDS.has(field.kind) ? ' wide' : ''}`}
              key={`${field.componentId}:${field.path}:${field.label}`}
            >
              <FieldRow
                field={field}
                componentValue={value}
                entity={selected as Entity}
                bound={bindingsByField[`${field.componentId}.${field.path}`]}
                bindings={bindingsByField}
                mixed={mixedByField[`${field.componentId}.${field.path}`]}
                write={writeAndDispatch}
              />
              {togglable ? (
                <button
                  type="button"
                  className="ui-designer-prop-remove"
                  aria-label={`Remove ${field.label ?? 'property'}`}
                  title={`Remove ${field.label ?? 'property'}`}
                  onClick={() => writeAndDispatch(field.componentId, buildRemovePatch(field))}
                >
                  <VscTrash aria-hidden />
                </button>
              ) : null}
            </div>,
          );
        }
        if (rows.length === 0 && addable.length === 0) return null;
        return (
          <Container
            key={group.title}
            label={group.title}
            initialOpen={!collapsed[group.title]}
            onToggle={open => dispatch(setGroupCollapsed({ title: group.title, collapsed: !open }))}
          >
            {rows}
            {addable.length > 0 ? (
              <AddPropertyMenu
                fields={addable}
                onAdd={f => writeAndDispatch(f.componentId, buildAddPatch(f))}
              />
            ) : null}
          </Container>
        );
      })}
    </div>
  );
};

interface LengthVecFieldProps {
  field: FieldConfig;
  componentValue: Record<string, unknown> | null;
  entity: Entity;
  bindings?: Record<string, string>;
  boundProp?: { variable: string };
  fieldDisabled: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
}

// A `length-vec` group (Size / Min / Max / Position). Sub-fields stack in the
// control column with a shared unit selector. When the field declares
// `collapsedSubFields`, it renders that compact projection (Position → X/Y) with
// a reveal toggle to the full edge set (T/R/B/L). The toggle seeds expanded when
// an edge outside the compact set is already authored — a right/bottom-anchored
// node then shows its real values without a manual reveal.
const LengthVecField = React.memo(function LengthVecField({
  field,
  componentValue,
  entity,
  bindings,
  boundProp,
  fieldDisabled,
  onPatch,
}: LengthVecFieldProps) {
  const dispatch = useAppDispatch();
  const aspectLockedMap = useAppSelector(getAspectLockedNodes);
  const aspectLocked = !!field.aspectLockable && !!aspectLockedMap[entity as unknown as number];
  const fullSubs = field.subFields ?? [];
  const compactSubs = field.collapsedSubFields;
  const hasFacade = !!compactSubs && compactSubs.length > 0;
  const extraPaths = hasFacade
    ? fullSubs.filter(s => !compactSubs!.some(c => c.path === s.path)).map(s => s.path)
    : [];
  const autoExpand = !!componentValue && extraPaths.some(p => p in componentValue);
  // null = follow the data (autoExpand); a boolean = the user's explicit choice.
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const expanded = userExpanded ?? autoExpand;
  const subs = hasFacade && !expanded ? compactSubs! : fullSubs;

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
            field={{ componentId: field.componentId, path: sub.path, kind: 'length' }}
            entity={entity}
            bound={subBound}
          >
            <TextField
              type="number"
              leftLabel={sub.leftLabel}
              value={String(v)}
              disabled={fieldDisabled}
              onChange={e => {
                const next = clampNumber(e.target.value);
                const patch: Record<string, unknown> = {
                  [sub.path]: next,
                  [`${sub.path}Unit`]: unit,
                };
                // Aspect lock: scale the sibling axis to preserve the current ratio.
                if (aspectLocked && subs.length === 2) {
                  const other = subs.find(s => s.path !== sub.path);
                  const curThis = (componentValue?.[sub.path] as number | undefined) ?? 0;
                  const curOther = other
                    ? ((componentValue?.[other.path] as number | undefined) ?? 0)
                    : 0;
                  if (other && curThis > 0 && curOther > 0) {
                    patch[other.path] = Math.max(0, Math.round(next * (curOther / curThis)));
                    patch[`${other.path}Unit`] = unit;
                  }
                }
                onPatch(patch);
              }}
            />
          </BindableSubField>
        );
      })}
      <div className="ui-designer-unit-selector">
        {field.aspectLockable ? (
          <button
            type="button"
            className={`ui-designer-vec-lock${aspectLocked ? ' active' : ''}`}
            aria-pressed={aspectLocked}
            aria-label={aspectLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
            title={aspectLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
            onClick={() => dispatch(setAspectLocked({ entity, locked: !aspectLocked }))}
          >
            {aspectLocked ? <IoLockClosedOutline aria-hidden /> : <IoLockOpenOutline aria-hidden />}
          </button>
        ) : null}
        {hasFacade ? (
          <button
            type="button"
            className="ui-designer-vec-reveal"
            aria-expanded={expanded}
            aria-label={expanded ? 'Show X and Y only' : 'Show all edges'}
            onClick={() => setUserExpanded(!expanded)}
          >
            {expanded ? 'X / Y' : 'T R B L'}
          </button>
        ) : null}
        <Dropdown
          options={UNIT_OPTIONS}
          value={unit}
          aria-label="Unit"
          disabled={fieldDisabled}
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
        />
      </div>
    </BindableField>
  );
});

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
      // Fields stack label-over-control: `BindableField` → `Block` owns the
      // visible Label; the control gets an aria-label for screen readers.
      const v = !!raw;
      return (
        <BindableField
          field={field}
          entity={entity}
          bound={boundProp}
        >
          <CheckboxField
            checked={v}
            aria-label={field.label}
            onChange={e => onPatch({ [field.path]: e.target.checked })}
          />
        </BindableField>
      );
    }
    case 'enum': {
      // An unset value shows the field's in-world default (e.g. textAlign →
      // center), falling back to the zero option.
      const v = (raw as number | undefined) ?? field.defaultValue ?? 0;
      return (
        <BindableField
          field={field}
          entity={entity}
          bound={boundProp}
        >
          <Dropdown
            options={field.options ?? []}
            value={v}
            aria-label={field.label}
            onChange={e => onPatch({ [field.path]: Number(e.target.value) })}
          />
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
            <Dropdown
              options={UNIT_OPTIONS}
              value={unit}
              aria-label="Unit"
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
            />
          </div>
        </BindableField>
      );
    }
    case 'length-vec': {
      return (
        <LengthVecField
          field={field}
          componentValue={componentValue}
          entity={entity}
          bindings={bindings}
          boundProp={boundProp}
          fieldDisabled={fieldDisabled}
          onPatch={onPatch}
        />
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
          <TextArea
            className="ui-designer-string-array"
            aria-label={field.label}
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
          <Dropdown
            options={field.options ?? []}
            value={v}
            aria-label={field.label}
            onChange={e => onModeChange(Number(e.target.value))}
          />
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
