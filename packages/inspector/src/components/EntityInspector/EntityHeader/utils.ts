import type { ComponentRules, TooltipConfig } from './types';

export const getComponentName = (
  componentId: number,
  availableComponents: Array<{ id: number; name: string }>,
): string => {
  const component = availableComponents.find(c => c.id === componentId);
  return component?.name || 'Unknown Component';
};

export const isDisabled = (
  componentId: number,
  rules: ComponentRules,
  attachedComponents: Set<number>,
): boolean => {
  // If component is already on entity, disable it
  if (attachedComponents.has(componentId)) {
    return true;
  }

  // If requires is defined, evaluate the requirements
  // Nested arrays use OR logic within, AND logic between groups
  // Flat array uses AND logic for all
  if (rules.requires) {
    const allGroupsSatisfied = rules.requires.every((group: number | number[]) =>
      Array.isArray(group)
        ? group.some((id: number) => attachedComponents.has(id))
        : attachedComponents.has(group),
    );
    if (!allGroupsSatisfied) return true;
  }

  // If conflictsWith is defined, check if ANY conflicting component is present
  if (rules.conflictsWith) {
    const hasConflict = rules.conflictsWith.some((id: number) => attachedComponents.has(id));
    if (hasConflict) return true;
  }

  return false;
};

const formatRequirementMessage = (
  rules: ComponentRules,
  attachedComponents: Set<number>,
  availableComponents: Array<{ id: number; name: string }>,
): string => {
  if (!rules.requires) return '';

  const requirementParts = rules.requires.map((group: number | number[]) => {
    if (Array.isArray(group)) {
      const names = group.map(id => getComponentName(id, availableComponents));
      if (names.length === 1) return names[0];
      if (names.length === 2) return `either ${names[0]} or ${names[1]}`;
      return `either ${names.slice(0, -1).join(', ')}, or ${names[names.length - 1]}`;
    }
    return getComponentName(group, availableComponents);
  });

  let message = 'You must have ';
  if (requirementParts.length === 1) {
    message += requirementParts[0];
  } else if (requirementParts.length === 2) {
    message += `${requirementParts[0]} and ${requirementParts[1]}`;
  } else {
    message += `${requirementParts.slice(0, -1).join(', ')}, and ${requirementParts[requirementParts.length - 1]}`;
  }
  message += ' to use this component.';
  return message;
};

const formatConflictMessage = (
  rules: ComponentRules,
  attachedComponents: Set<number>,
  availableComponents: Array<{ id: number; name: string }>,
): string => {
  if (!rules.conflictsWith) return '';

  const conflictingNames = rules.conflictsWith
    .filter((id: number) => attachedComponents.has(id))
    .map((id: number) => getComponentName(id, availableComponents));

  let message = 'This component cannot be used with ';
  if (conflictingNames.length === 1) {
    message += `${conflictingNames[0]}.`;
  } else if (conflictingNames.length === 2) {
    message += `${conflictingNames[0]} or ${conflictingNames[1]}.`;
  } else {
    message += `${conflictingNames.slice(0, -1).join(', ')}, or ${conflictingNames[conflictingNames.length - 1]}.`;
  }
  return message;
};

export const getTooltip = (
  componentId: number,
  config: TooltipConfig,
  rules: ComponentRules,
  attachedComponents: Set<number>,
  availableComponents: Array<{ id: number; name: string }>,
): { text: string; link?: string } => {
  // If already on entity
  if (attachedComponents.has(componentId)) {
    return {
      text: 'This component is already added. An entity can only have one copy of each component.',
    };
  }

  // If disabled due to missing requirements
  if (rules.requires) {
    const allGroupsSatisfied = rules.requires.every((group: number | number[]) =>
      Array.isArray(group)
        ? group.some((id: number) => attachedComponents.has(id))
        : attachedComponents.has(group),
    );
    if (!allGroupsSatisfied) {
      return {
        text:
          config.disabledMessage ||
          formatRequirementMessage(rules, attachedComponents, availableComponents),
      };
    }
  }

  // If disabled due to conflicts
  if (rules.conflictsWith) {
    const hasConflict = rules.conflictsWith.some((id: number) => attachedComponents.has(id));
    if (hasConflict) {
      return {
        text:
          config.disabledMessage ||
          formatConflictMessage(rules, attachedComponents, availableComponents),
      };
    }
  }

  // Component is enabled, show normal description
  return { text: config.description, ...(config.link && { link: config.link }) };
};

export const getComponentConfig = (
  componentId: number,
  config: TooltipConfig,
  rules: ComponentRules,
  attachedComponents: Set<number>,
  availableComponents: Array<{ id: number; name: string }>,
) => ({
  disabled: isDisabled(componentId, rules, attachedComponents),
  tooltip: getTooltip(componentId, config, rules, attachedComponents, availableComponents),
});
