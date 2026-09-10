import React from 'react';
import type { Entity } from '@dcl/ecs';
import { BindableField } from '../BindableField';
import { BindableSubField } from '../BindableSubField';
import { Dropdown } from '../../../../ui';
import type { FieldConfig } from '../field-configs';
import { TextField } from '../../../../ui';
import { YGU_AUTO } from '../../../../../lib/sdk/ui-transform-constants';
import { YGU_POINT } from '../../../../../lib/sdk/ui-transform-constants';
import { YGU_UNDEFINED } from '../../../../../lib/sdk/ui-transform-constants';
import { axisForPath } from '../../../shared/measure';
import { convertLength } from '../../../shared/measure';
import { getAspectLockedNodes } from '../../../../../redux/ui-designer';
import { measureParentBox } from '../../../shared/measure';
import { setAspectLocked } from '../../../../../redux/ui-designer';
import { useAppDispatch } from '../../../../../redux/hooks';
import { useAppSelector } from '../../../../../redux/hooks';
import { UNIT_OPTIONS, clampNumber } from '../field-helpers';

interface LengthVecFieldProps {
  field: FieldConfig;
  componentValue: Record<string, unknown> | null;
  entity: Entity;
  bindings?: Record<string, string>;
  boundProp?: { variable: string };
  fieldDisabled: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
}

export const LengthVecField = React.memo(function LengthVecField({
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
  const subs = field.facadeSubFields?.(componentValue) ?? field.subFields ?? [];

  const firstUnitKey = subs[0] ? `${subs[0].path}Unit` : '';
  const firstUnitRaw = (componentValue?.[firstUnitKey] as number | undefined) ?? YGU_UNDEFINED;
  const unit = firstUnitRaw === YGU_UNDEFINED ? YGU_POINT : firstUnitRaw;
  const numbersDisabled = fieldDisabled || unit === YGU_AUTO;

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
              disabled={numbersDisabled}
              onChange={e => {
                const next = clampNumber(e.target.value);
                const patch: Record<string, unknown> = {
                  [sub.path]: next,
                  [`${sub.path}Unit`]: unit,
                };
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
          />
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
