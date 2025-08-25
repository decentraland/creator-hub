import React, { useCallback, useMemo } from 'react';
import { BsFillLightningChargeFill as SmartItemIcon } from 'react-icons/bs';
import { type Entity } from '@dcl/ecs';
import { type ActionType, getJson, getPayload } from '@dcl/asset-packs';
import { withSdk } from '../../../../hoc/withSdk';
import { useComponentInput } from '../../../../hooks/sdk/useComponentInput';
import { useComponentValue } from '../../../../hooks/sdk/useComponentValue';
import { useHasComponent } from '../../../../hooks/sdk/useHasComponent';
import { getValue, setValue } from '../../../../lib/logic/get-set-value';
import { type EditorComponentsTypes } from '../../../../lib/sdk/components';
import { Container } from '../../../Container';
import { Block } from '../../../Block';
import { InfoTooltip } from '../../../ui/InfoTooltip';
import { Message, MessageType } from '../../../ui/Message';
import { getComponentByType, isBooleanValue } from '../utils';
import DynamicField from './DynamicField';
import { validateConstraints } from './constraints';
import { applyTransform } from './utils';
import { type Props, type Section, type SectionItem } from './types';

import './SmartItemBasicView.css';

const RegularComponentItem = withSdk<{ item: SectionItem; entity: Entity }>(
  ({ sdk, item, entity }) => {
    const component = getComponentByType(sdk, item.component);
    if (!component) return null;

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

    const inputProps = item.path ? getInputProps(item.path) : {};

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

// Component for rendering action component items
const ActionComponentItem = withSdk<{ item: SectionItem; entity: Entity }>(
  ({ sdk, item, entity }) => {
    const { Actions } = sdk.components;
    const [actionComponent, setActionComponentValue] = useComponentValue<
      EditorComponentsTypes['Actions']
    >(entity, Actions);

    if (!item.basicViewId || !item.path) return null;

    const [action, actionIdx] = useMemo(() => {
      const actionIdx = actionComponent?.value.findIndex(
        action => action.basicViewId === item.basicViewId,
      );
      return [actionIdx !== -1 ? actionComponent?.value[actionIdx] : undefined, actionIdx];
    }, [actionComponent?.value, item.basicViewId]);

    if (!action) return null;

    const parsedActionValue = useMemo(() => {
      try {
        const actionValue = getJson(getPayload<ActionType>(action));
        return JSON.parse(actionValue);
      } catch {
        return {};
      }
    }, [action]);

    const currentValue = useMemo(() => {
      const rawValue =
        getValue(parsedActionValue, item.path || '') || item.constraints?.default || '';
      return applyTransform(rawValue, item.transform, 'in');
    }, [parsedActionValue, item.path, item.constraints?.default, item.transform]);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
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
          // Do nothing
        }
      },
      [
        action,
        actionIdx,
        actionComponent,
        item.basicViewId,
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
  const { Config, Actions, Triggers } = sdk.components;

  const hasActions = useHasComponent(entity, Actions);
  const hasTriggers = useHasComponent(entity, Triggers);
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
            key={`${item.component}-${item.path}-${itemIndex}`}
            item={item}
            entity={entity}
          />
        );
      } else {
        return (
          <RegularComponentItem
            key={`${item.component}-${item.path}-${itemIndex}`}
            item={item}
            entity={entity}
          />
        );
      }
    },
    [sdk, Actions, entity],
  );

  const renderSection = useCallback(
    (section: Section, sectionIndex: number) => {
      const renderSectionRightContent = useCallback(() => {
        if (section.helpTooltip) {
          return (
            <InfoTooltip
              text={section.helpTooltip.text}
              link={section.helpTooltip.link}
              type="help"
            />
          );
        }
        return undefined;
      }, [section.helpTooltip]);

      return (
        <Container
          key={`${section.id}-${sectionIndex}`}
          label={section.label}
          className="SmartItemBasicViewSection"
          rightContent={renderSectionRightContent()}
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

  if (!config || !config.sections || config.sections.length === 0) {
    return null;
  }

  return (
    <Container
      label={config.label || 'Smart Item'}
      indicator={renderSmartItemIndicator()}
      className="SmartItemBasicViewInspector"
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
