import React, { useMemo, useCallback } from 'react';
import {
  TextField,
  CheckboxField,
  RangeField,
  ColorField,
  FileUploadField,
  Dropdown,
  TextArea,
  EntityField,
  ColorPicker,
} from '../../../ui';
import { getInputType, getStep, getMin, getMax } from './constraints';
import { applyTransform } from './utils';
import { getDataSourceOptions } from './dataSources';
import { TriggerSection } from './TriggerSection';
import { WidgetType, type WidgetProps } from './types';

const DynamicField: React.FC<WidgetProps> = ({
  entity,
  inputProps,
  widget,
  label,
  constraints,
  props,
  transform,
  dataSource,
  basicViewId,
}) => {
  const fieldLabel = useMemo(() => {
    return label?.trim() || '';
  }, [label]);

  const renderWidget = useCallback(() => {
    const commonProps = {
      label: fieldLabel,
      ...inputProps,
      ...props,
    };

    switch (widget) {
      case WidgetType.TriggerSection:
        return (
          <TriggerSection
            entity={entity}
            label={fieldLabel}
            basicViewId={basicViewId}
          />
        );

      case WidgetType.CheckboxField:
        return (
          <CheckboxField
            {...commonProps}
            checked={!!inputProps.value}
          />
        );

      case WidgetType.RangeField: {
        // Transform constraints to work with stored values
        const transformedConstraints = constraints
          ? {
              ...constraints,
              min:
                constraints.min !== undefined
                  ? applyTransform(constraints.min, transform, 'in')
                  : undefined,
              max:
                constraints.max !== undefined
                  ? applyTransform(constraints.max, transform, 'in')
                  : undefined,
              step:
                constraints.step !== undefined
                  ? applyTransform(constraints.step, transform, 'in')
                  : undefined,
            }
          : constraints;

        return (
          <RangeField
            {...commonProps}
            step={getStep(transformedConstraints)}
            min={getMin(transformedConstraints)}
            max={getMax(transformedConstraints)}
          />
        );
      }
      case WidgetType.ColorField:
        return <ColorField {...commonProps} />;

      case WidgetType.ColorPicker:
        return <ColorPicker {...commonProps} />;

      case WidgetType.FileUploadField:
        return (
          <FileUploadField
            {...commonProps}
            options={getDataSourceOptions(dataSource?.kind)}
          />
        );

      case WidgetType.EntityField:
        return <EntityField {...commonProps} />;

      case WidgetType.Dropdown:
        return (
          <Dropdown
            {...commonProps}
            options={getDataSourceOptions(dataSource?.kind)}
          />
        );

      case WidgetType.TextArea:
        return (
          <TextArea
            {...commonProps}
            maxLength={constraints?.maxLength}
            minLength={constraints?.minLength}
          />
        );

      default:
        return (
          <TextField
            {...commonProps}
            type={getInputType(constraints) as any}
            maxLength={constraints?.maxLength}
            minLength={constraints?.minLength}
            pattern={constraints?.pattern}
          />
        );
    }
  }, [fieldLabel, inputProps, widget, props, basicViewId, constraints, transform, dataSource]);

  return renderWidget();
};

export default React.memo(DynamicField);
