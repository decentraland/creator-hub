import { capitalize } from '../../../lib/utils/strings';
import type { Props as OptionProp } from './Option/types';

export const FONT_SIZE = 13;
export const FONT_WEIGHT = 700;
export const WIDTH_CONST = 1200;
export const ICON_SIZE = 16;
export const MIXED_VALUE_LABEL = '-- Mixed Values --';

export function isOptionSelected(currentValue?: any, optionValue?: any) {
  return currentValue?.toString() === optionValue?.toString();
}

export function isMultipleOptionSelected(currentValue?: string | any[], optionValue?: any) {
  const values = typeof currentValue === 'string' ? currentValue.split(',') : (currentValue ?? []);
  return values.find(value => value?.toString() === optionValue?.toString());
}

export function mapSelectFieldOptions<T extends object>(value: T) {
  return Object.entries(value).map(([_, type]) => ({ value: type, label: capitalize(type) }));
}

export function matchesSearch(option: OptionProp, search: string) {
  if (!search) return true;
  const text = option.label?.toLowerCase() ?? option.value?.toString().toLowerCase() ?? '';
  return text.includes(search.toLowerCase());
}

export function isNavigable(option: OptionProp) {
  return !option.disabled && !option.header;
}

export function optionId(listId: string, index: number) {
  return `${listId}-option-${index}`;
}
