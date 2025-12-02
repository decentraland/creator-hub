import React, { useCallback, useMemo } from 'react';
import { BsFillLightningChargeFill as SmartItemIcon } from 'react-icons/bs';
import { type Entity } from '@dcl/ecs';
import { type ActionType, getJson, getPayload } from '@dcl/asset-packs';
import { withSdk } from '../../../../hoc/withSdk';
import { useComponentInput } from '../../../../hooks/sdk/useComponentInput';
import { useComponentValue } from '../../../../hooks/sdk/useComponentValue';
import { getValue, setValue } from '../../../../lib/logic/get-set-value';
import { type EditorComponentsTypes } from '../../../../lib/sdk/components';
import { Container } from '../../../Container';
import { Block } from '../../../Block';
import { InfoTooltip } from '../../../ui/InfoTooltip';
import { Message, MessageType } from '../../../ui/Message';
import { getComponentByType, isBooleanValue, useEntityOrChildrenHasComponents } from '../utils';
import DynamicField from './DynamicField';
import { validateConstraints } from './constraints';
import { applyTransform } from './utils';
import { WidgetType, type Props, type Section, type SectionItem } from './types';

import './SmartItemBasicView.css';

const RegularComponentItemInner = withSdk<{ item: SectionItem; entity: Entity }>(
  ({ sdk, item, entity }) => {
    const component = getComponentByType(sdk, item.component);

    const { getInputProps } = useComponentInput(
      entity,
      component,
      // Convert component value to input format
      (value: Record<string, any>) => {
        const raw = getValue(value, item.path || '');
        const inputValue = applyTransform(raw, item.transform, 'in');
        return setValue(value, item.path || '', inputValue);
      },
      // Convert input back to component value format
      (input: Record<string, any>) => {
        const raw = getValue(input, item.path || '');
        const converted = applyTransform(raw, item.transform, 'out');

        // Apply constraints validation
        if (!validateConstraints(converted, item.constraints)) {
          throw new Error('Value does not meet constraints');
        }

        return setValue(input, item.path || '', converted);
      },
      // Is valid input
      (input: Record<string, any>) => {
        const raw = getValue(input, item.path || '');

        // Basic type validation
        if (
          item.constraints?.format === 'number' ||
          item.constraints?.min !== undefined ||
          item.constraints?.max !== undefined
        ) {
          return typeof raw === 'number' || !isNaN(parseFloat(String(raw)));
        }

        if (item.constraints?.format === 'boolean') {
          return isBooleanValue(raw);
        }

        return true;
      },
    );

    let getter = undefined;
    if (item.path && item.widget === WidgetType.CheckboxField) {
      getter = (e: React.ChangeEvent<HTMLInputElement>) => e.target.checked;
    }
    const inputProps = item.path ? getInputProps(item.path, getter) : {};

    return (
      <DynamicField
        entity={entity}
        inputProps={inputProps}
        widget={item.widget}
        label={item.label}
        constraints={item.constraints}
        props={item.props}
        transform={item.transform}
        dataSource={item.dataSource}
        basicViewId={item.basicViewId}
      />
    );
  },
);

const RegularComponentItem = withSdk<{ item: SectionItem; entity: Entity }>(
  ({ sdk, item, entity }) => {
    const component = getComponentByType(sdk, item.component);
    if (!component) return null;
    return (
      <RegularComponentItemInner
        item={item}
        entity={entity}
      />
    );
  },
);

// Component for rendering action component items
const ActionComponentItem = withSdk<{ item: SectionItem; entity: Entity }>(
  ({ sdk, item, entity }) => {
    const { Actions } = sdk.components;

    const [actionComponent, setActionComponentValue] = useComponentValue<
      EditorComponentsTypes['Actions']
    >(entity, Actions);

    const { action, actionIdx } = useMemo(() => {
      if (!item.basicViewId) return { action: undefined, actionIdx: -1 };
      const idx = actionComponent?.value.findIndex(a => a.basicViewId === item.basicViewId) ?? -1;
      return { action: idx !== -1 ? actionComponent?.value[idx] : undefined, actionIdx: idx };
    }, [actionComponent?.value, item.basicViewId]);

    const parsedActionValue = useMemo<Record<string, any>>(() => {
      if (!action) return {};
      try {
        const actionValue = getJson(getPayload<ActionType>(action));
        return JSON.parse(actionValue);
      } catch {
        return {};
      }
    }, [action]);

    const currentValue = useMemo(() => {
      const raw = getValue(parsedActionValue, item.path || '') ?? item.constraints?.default ?? '';
      return applyTransform(raw, item.transform, 'in') || '';
    }, [parsedActionValue, item.path, item.constraints?.default, item.transform]);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!action || actionIdx < 0 || !actionComponent) return;
        const inputValue = e.target.value;
        const convertedValue = applyTransform(inputValue, item.transform, 'out');

        if (!validateConstraints(convertedValue, item.constraints)) {
          return;
        }

        try {
          const newPayload = getJson({
            ...getPayload<ActionType>(action),
            [item.path || '']: convertedValue,
          });
          const newAction = { ...action, jsonPayload: newPayload };

          const updatedActions = [...actionComponent.value];
          updatedActions[actionIdx] = newAction;
          setActionComponentValue({ ...actionComponent, value: updatedActions });
        } catch {
          /* noop */
        }
      },
      [
        action,
        actionIdx,
        actionComponent,
        item.path,
        item.transform,
        item.constraints,
        setActionComponentValue,
      ],
    );

    const inputProps = useMemo(
      () => ({
        value: currentValue.toString(),
        onChange: handleChange,
        onFocus: () => {},
        onBlur: () => {},
      }),
      [currentValue, handleChange],
    );

    if (!item.basicViewId || !item.path || !action) return null;

    return (
      <DynamicField
        entity={entity}
        inputProps={inputProps}
        widget={item.widget}
        label={item.label}
        constraints={item.constraints}
        props={item.props}
        transform={item.transform}
        dataSource={item.dataSource}
        basicViewId={item.basicViewId}
      />
    );
  },
);

const SmartItemBasicView = withSdk<Props>(({ sdk, entity }) => {
  const { Config, Actions } = sdk.components;

  const { hasActions, hasTriggers } = useEntityOrChildrenHasComponents(entity, sdk);
  const shouldShowHint = hasActions && !hasTriggers;

  const config = useMemo(() => {
    return Config.getOrNull(entity);
  }, [entity, Config]);

  const renderSmartItemIndicator = useCallback(() => {
    return (
      <div className="SmartItemBadge">
        <SmartItemIcon size={12} />
      </div>
    );
  }, []);

  const renderSectionItem = useCallback(
    (item: SectionItem, itemIndex: number) => {
      const component = getComponentByType(sdk, item.component);
      const isActionComponent = component?.componentName === Actions.componentName;

      if (isActionComponent && item.basicViewId) {
        return (
          <ActionComponentItem
            key={`${item.component}-${item.path}-${item.widget}-${itemIndex}`}
            item={item}
            entity={entity}
          />
        );
      }

      return (
        <RegularComponentItem
          key={`${item.component}-${item.path}-${item.widget}-${itemIndex}`}
          item={item}
          entity={entity}
        />
      );
    },
    [sdk, Actions, entity],
  );

  const renderSection = useCallback(
    (section: Section, sectionIndex: number) => {
      const rightContent = section.helpTooltip ? (
        <InfoTooltip
          text={section.helpTooltip.text}
          link={section.helpTooltip.link}
          type="help"
        />
      ) : undefined;

      return (
        <Container
          key={`${section.id}-${sectionIndex}`}
          label={section.label}
          className="SmartItemBasicViewSection"
          rightContent={rightContent}
        >
          {section.columns && section.columns > 1 ? (
            <Block>
              {section.items.map((item: SectionItem, itemIndex: number) =>
                renderSectionItem(item, itemIndex),
              )}
            </Block>
          ) : (
            section.items.map((item: SectionItem, itemIndex: number) =>
              renderSectionItem(item, itemIndex),
            )
          )}
        </Container>
      );
    },
    [renderSectionItem],
  );

  const renderHelpTooltip = useCallback(() => {
    if (config?.helpTooltip) {
      return (
        <InfoTooltip
          text={config.helpTooltip.text}
          link={config.helpTooltip.link}
          type="help"
        />
      );
    }
    return undefined;
  }, [config?.helpTooltip]);

  if (!config || !config.sections || config.sections.length === 0) {
    return null;
  }

  return (
    <Container
      label={config.label || 'Smart Item'}
      indicator={renderSmartItemIndicator()}
      className="SmartItemBasicViewInspector"
      rightContent={renderHelpTooltip()}
    >
      {config.sections.map((section, sectionIndex) =>
        renderSection(section as Section, sectionIndex),
      )}
      {shouldShowHint && (
        <Message
          text="This item needs to be triggered by another smart item to work"
          type={MessageType.WARNING}
        />
      )}
    </Container>
  );
});

export default React.memo(SmartItemBasicView);
