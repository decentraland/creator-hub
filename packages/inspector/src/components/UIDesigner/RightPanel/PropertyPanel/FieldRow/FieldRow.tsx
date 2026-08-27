import React from 'react';
import { useCallback } from 'react';
import type { Entity } from '@dcl/ecs';
import type { TextureUnion } from '@dcl/ecs';
import type { Alignment } from '../alignment-presets';
import { AnchorPresetField } from '../AnchorPresetField';
import { BindableField } from '../BindableField';
import { Block } from '../../../../Block';
import { BoxModelField } from '../BoxModelField';
import { CallbackField } from '../CallbackField';
import type { CanvasSegment } from '../../../shared/tree-model';
import { CheckboxField } from '../../../../ui';
import { Dropdown } from '../../../../ui';
import type { FieldConfig } from '../field-configs';
import { FillField } from '../FillField';
import { FlowField } from '../FlowField';
import { MixedContentField } from '../MixedContentField';
import type { OverflowFlag } from '../overflow-flags';
import { ResizeField } from '../ResizeField';
import { RgbaColorField } from '../../../../ui';
import { TextAlignField } from '../TextAlignField';
import { TextArea } from '../../../../ui';
import { TextField } from '../../../../ui';
import { YGPT_ABSOLUTE } from '../../../../../lib/sdk/ui-transform-constants';
import { YGPT_RELATIVE } from '../../../../../lib/sdk/ui-transform-constants';
import { YGU_AUTO } from '../../../../../lib/sdk/ui-transform-constants';
import { YGU_POINT } from '../../../../../lib/sdk/ui-transform-constants';
import { YGU_UNDEFINED } from '../../../../../lib/sdk/ui-transform-constants';
import { absolutePatch } from '../flow';
import { alignmentToPatch } from '../alignment-presets';
import { axisForPath } from '../../../shared/measure';
import { clearAlignmentPatch } from '../alignment-presets';
import { clearedCenterMargins } from '../../../shared/align-presets';
import { convertLength } from '../../../shared/measure';
import { inFlowPatch } from '../flow';
import { measureParentBox } from '../../../shared/measure';
import { overflowFlags } from '../overflow-flags';
import { overflowPatch } from '../overflow-flags';
import { patchToAlignment } from '../alignment-presets';
import { regionToUvs } from '../uv-region';
import { seedSegments } from '../MixedContentField/segments';
import { uvsToRegion } from '../uv-region';
import {
  ALIGNMENT_OPTIONS,
  TW_NO_WRAP,
  TW_WRAP,
  UNIT_OPTIONS,
  clampNumber,
  expandWriteAll,
} from '../field-helpers';
import type { Color4 } from '../field-helpers';
import { LengthVecField } from '../LengthVecField';

interface FieldRowProps {
  field: FieldConfig;
  componentValue: Record<string, unknown> | null;
  entity: Entity;
  bound?: string;
  bindings?: Record<string, string>;
  mixed?: CanvasSegment[];
  parentFlexDirection: number;
  overriding: boolean;
  write: (componentId: string, patch: Record<string, unknown>) => void;
}

export const FieldRow = React.memo(function FieldRow({
  field,
  componentValue,
  entity,
  bound,
  bindings,
  mixed,
  parentFlexDirection,
  overriding,
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

  const bindable = (control: React.ReactNode) => (
    <BindableField
      field={field}
      entity={entity}
      bound={boundProp}
    >
      {control}
    </BindableField>
  );

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
      return bindable(
        <TextField
          value={v}
          onChange={e =>
            onPatch({
              [field.path]: field.sanitize ? field.sanitize(e.target.value) : e.target.value,
            })
          }
        />,
      );
    }
    case 'number': {
      const v = (raw as number | undefined) ?? field.defaultValue ?? 0;
      return bindable(
        <TextField
          type="number"
          rightLabel={field.suffix}
          value={String(field.toDisplay ? field.toDisplay(v) : v)}
          onChange={e => {
            const next = clampNumber(e.target.value);
            onPatch({ [field.path]: field.fromDisplay ? field.fromDisplay(next) : next });
          }}
        />,
      );
    }
    case 'boolean': {
      const v = !!raw;
      return bindable(
        <CheckboxField
          checked={v}
          aria-label={field.label}
          onChange={e => onPatch({ [field.path]: e.target.checked })}
        />,
      );
    }
    case 'enum': {
      const v = (raw as number | undefined) ?? field.defaultValue ?? 0;
      return bindable(
        <Dropdown
          options={field.options ?? []}
          value={v}
          aria-label={field.label}
          onChange={e => onPatch({ [field.path]: Number(e.target.value) })}
        />,
      );
    }
    case 'length': {
      const unitKey = `${field.path}Unit`;
      const numeric = (componentValue?.[field.path] as number | undefined) ?? 0;
      const unitRaw = (componentValue?.[unitKey] as number | undefined) ?? YGU_UNDEFINED;
      const unit = unitRaw === YGU_UNDEFINED ? YGU_POINT : unitRaw;
      return bindable(
        <div className="ui-designer-length-row">
          <TextField
            type="number"
            value={String(numeric)}
            disabled={unit === YGU_AUTO}
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
        </div>,
      );
    }
    case 'resize': {
      const absolute =
        ((componentValue?.positionType as number | undefined) ?? YGPT_RELATIVE) === YGPT_ABSOLUTE;
      return (
        <Block
          label={absolute ? field.label : 'Resize'}
          info={field.info}
        >
          <ResizeField
            field={field}
            value={componentValue}
            entity={entity}
            bindings={bindings}
            parentFlexDirection={parentFlexDirection}
            overriding={overriding}
            onPatch={onPatch}
          />
        </Block>
      );
    }
    case 'overflow-scroll':
    case 'overflow-clip': {
      const flag: OverflowFlag = field.kind === 'overflow-scroll' ? 'scroll' : 'clip';
      const flags = overflowFlags(componentValue);
      return bindable(
        <CheckboxField
          checked={flags[flag]}
          disabled={fieldDisabled || (flag === 'clip' && flags.clipLocked)}
          aria-label={field.label}
          onChange={e => onPatch(overflowPatch(flag, e.target.checked, componentValue))}
        />,
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
    case 'color': {
      const c = (raw as Color4 | undefined) ?? {
        r: 0,
        g: 0,
        b: 0,
        a: 1,
      };
      return bindable(
        <RgbaColorField
          value={c}
          onChange={next =>
            onPatch(field.writeAll ? expandWriteAll(field.writeAll, next) : { [field.path]: next })
          }
        />,
      );
    }
    case 'fill': {
      return bindable(
        <FillField
          key={entity}
          color={componentValue?.color as Color4 | undefined}
          texture={componentValue?.texture as TextureUnion | undefined}
          entity={entity}
          bindings={bindings}
          onPatch={onPatch}
        />,
      );
    }
    case 'text-align': {
      return bindable(
        <TextAlignField
          value={raw as number | undefined}
          onChange={mode => onPatch({ [field.path]: mode })}
        />,
      );
    }
    case 'text-wrap': {
      return bindable(
        <CheckboxField
          checked={((raw as number | undefined) ?? TW_WRAP) === TW_WRAP}
          aria-label={field.label}
          onChange={e => onPatch({ [field.path]: e.target.checked ? TW_WRAP : TW_NO_WRAP })}
        />,
      );
    }
    case 'string-array': {
      const arr = (raw as string[] | undefined) ?? [];
      return bindable(
        <TextArea
          className="ui-designer-string-array"
          aria-label={field.label}
          value={arr.join('\n')}
          onChange={e => onPatch({ [field.path]: e.target.value.split('\n') })}
        />,
      );
    }
    case 'index': {
      const v = (raw as number | undefined) ?? 0;
      return bindable(
        <TextField
          type="number"
          value={String(v)}
          onChange={e => onPatch({ [field.path]: clampNumber(e.target.value) })}
        />,
      );
    }
    case 'callback': {
      return (
        <CallbackField
          field={field}
          entity={entity}
          bound={bound}
        />
      );
    }
    case 'position-mode': {
      const absolute = ((raw as number | undefined) ?? YGPT_RELATIVE) === YGPT_ABSOLUTE;
      return bindable(
        <CheckboxField
          checked={absolute}
          aria-label={field.label}
          onChange={e =>
            onPatch(
              e.target.checked
                ? absolutePatch()
                : { ...inFlowPatch(), ...clearedCenterMargins(componentValue) },
            )
          }
        />,
      );
    }
    case 'flow': {
      return (
        <Block
          label={field.label}
          info={field.info}
        >
          <FlowField
            value={componentValue}
            onPatch={onPatch}
          />
        </Block>
      );
    }
    case 'alignment': {
      const direction = (componentValue?.flexDirection as number | undefined) ?? 0;
      const current = patchToAlignment(componentValue, direction);
      return (
        <Block
          label={field.label}
          info={field.info}
        >
          <Dropdown
            options={ALIGNMENT_OPTIONS}
            value={current ?? ''}
            aria-label={field.label}
            onChange={e => {
              const next = (e.target as HTMLSelectElement).value as Alignment | '';
              onPatch(next ? alignmentToPatch(next, direction) : clearAlignmentPatch());
            }}
          />
        </Block>
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
            componentId={field.componentId}
            entity={entity}
            box={field.box ?? 'padding'}
            bindings={bindings}
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
