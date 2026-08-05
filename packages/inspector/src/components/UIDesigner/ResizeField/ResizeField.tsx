import React from 'react';
import type { Entity } from '@dcl/ecs';

import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { getAspectLockedNodes, setAspectLocked } from '../../../redux/ui-designer';
import { Dropdown, TextField } from '../../ui';
import { BindableSubField } from '../BindableSubField';
import type { FieldConfig } from '../field-configs';
import { axisForPath, convertLength, measureParentBox } from '../measure';
import {
  MODE_LABELS,
  type ResizeAxis,
  type ResizeMode,
  mainAxisFor,
  resizeMode,
  resizeModesFor,
  resizePatch,
  resizeValuePatch,
} from '../resize-modes';
import { YGU_PERCENT, YGU_POINT } from '../../../lib/sdk/ui-transform-constants';

import './ResizeField.css';

interface ResizeFieldProps {
  field: FieldConfig;
  // The whole UiTransform value (the field uses path '').
  value: Record<string, unknown> | null;
  entity: Entity;
  bindings?: Record<string, string>;
  // The PARENT's flexDirection — which axis Fill grows along. Read by the panel,
  // since a node's own component cannot answer it.
  parentFlexDirection: number;
  onPatch: (patch: Record<string, unknown>) => void;
}

// Only the two numeric modes convert; Hug and Fill have no number to carry.
const UNIT_OF: Partial<Record<ResizeMode, number>> = {
  fixed: YGU_POINT,
  percent: YGU_PERCENT,
};

// Width and height, each with its own mode (Fixed px / Percent / Hug / Fill) and
// an aspect-ratio lock over the pair. The modes and the props Fill borrows live in
// resize-modes.ts; this component only measures (for the px ⇄ % conversion) and
// renders.
export const ResizeField: React.FC<ResizeFieldProps> = ({
  field,
  value,
  entity,
  bindings,
  parentFlexDirection,
  onPatch,
}) => {
  const dispatch = useAppDispatch();
  const aspectLockedMap = useAppSelector(getAspectLockedNodes);
  const aspectLocked = !!field.aspectLockable && !!aspectLockedMap[entity as unknown as number];
  const mainAxis = mainAxisFor(parentFlexDirection);
  const modes = resizeModesFor(value);

  const patchValue = (axis: ResizeAxis, mode: ResizeMode, next: number) => {
    const patch = resizeValuePatch(axis, mode, next);
    // Aspect lock scales the other axis to preserve the current ratio — only
    // meaningful while that axis holds a number of its own.
    const other: ResizeAxis = axis === 'width' ? 'height' : 'width';
    const otherMode = resizeMode(value, other, mainAxis);
    const cur = (value?.[axis] as number | undefined) ?? 0;
    const curOther = (value?.[other] as number | undefined) ?? 0;
    if (aspectLocked && UNIT_OF[otherMode] && cur > 0 && curOther > 0) {
      Object.assign(
        patch,
        resizeValuePatch(other, otherMode, Math.max(0, Math.round(next * (curOther / cur)))),
      );
    }
    onPatch(patch);
  };

  return (
    <div className="ui-designer-resize">
      {(field.subFields ?? []).map(sub => {
        const axis = sub.path as ResizeAxis;
        const mode = resizeMode(value, axis, mainAxis);
        const numeric = (value?.[axis] as number | undefined) ?? 0;
        return (
          <BindableSubField
            key={axis}
            field={{ componentId: field.componentId, path: axis, kind: 'length' }}
            entity={entity}
            bound={bindings?.[`${field.componentId}.${axis}`]}
          >
            <div className="ui-designer-resize-axis">
              <TextField
                type="number"
                leftLabel={sub.leftLabel}
                value={String(numeric)}
                // Hug reads the size off the content and Fill off the free space,
                // so in both the number is not what decides it.
                disabled={!UNIT_OF[mode]}
                onChange={e => patchValue(axis, mode, Number(e.target.value) || 0)}
              />
              <Dropdown
                options={modes.map(m => ({ value: m, label: MODE_LABELS[m] }))}
                value={mode}
                aria-label={`${sub.leftLabel === 'W' ? 'Width' : 'Height'} resize mode`}
                onChange={e => {
                  const next = (e.target as HTMLSelectElement).value as ResizeMode;
                  if (next === mode) return;
                  const parent = measureParentBox(entity);
                  const dim = parent ? parent[axisForPath(axis)] : 0;
                  onPatch(
                    resizePatch({
                      next,
                      current: mode,
                      axis,
                      mainAxis,
                      // Carry the number across a px ⇄ % change so the box keeps
                      // roughly the size it had.
                      value: convertLength(
                        numeric,
                        UNIT_OF[mode] ?? YGU_POINT,
                        UNIT_OF[next] ?? YGU_POINT,
                        dim,
                      ),
                    }),
                  );
                }}
              />
            </div>
          </BindableSubField>
        );
      })}
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
    </div>
  );
};

export default ResizeField;
