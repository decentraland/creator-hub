import React, { useCallback, useMemo } from 'react';
import { VscSearch as SearchIcon } from 'react-icons/vsc';
import cx from 'classnames';
import { TextField } from '../../TextField';
import { InfoTooltip } from '../../InfoTooltip';
import type { Props as TooltipProps } from '../../InfoTooltip/types';
import { Option } from '../Option';
import type { Props as OptionProp } from '../Option/types';
import {
  isMultipleOptionSelected,
  isNavigable,
  isOptionSelected,
  matchesSearch,
  optionId,
} from '../utils';
import type { Props } from './types';
import './OptionList.css';

const isTooltipText = (tooltip: string | TooltipProps | undefined | null): tooltip is string => {
  return (
    tooltip !== undefined &&
    tooltip !== null &&
    (typeof tooltip === 'string' || tooltip instanceof String)
  );
};

const OptionList = React.forwardRef<HTMLDivElement, Props>((props, ref) => {
  const {
    empty,
    minWidth,
    multiple,
    options,
    searchable,
    selectedValue,
    isField,
    className,
    style,
    scope,
    id,
    activeIndex,
    activeSource,
    search,
    onSearchChange,
    searchInputProps,
    onActiveChange,
    onChange,
  } = props;

  const filteredOptions = useMemo(
    () =>
      options.flatMap((option, index) =>
        matchesSearch(option, search) ? [{ option, index }] : [],
      ),
    [options, search],
  );

  const isSelected = useCallback(
    (option: OptionProp) => {
      return multiple
        ? isMultipleOptionSelected(
            (selectedValue as OptionProp[]).map($ => $.value),
            option.value,
          )
        : isOptionSelected((selectedValue as OptionProp)?.value, option.value);
    },
    [selectedValue, multiple],
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearchChange(e.target.value);
    },
    [onSearchChange],
  );

  const handleSearchClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Avoid close the dropdown when clicking on the search input
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleSelectOption = useCallback(
    (e: any, option: OptionProp) => {
      if (option.value !== undefined) {
        const formatSelectedValue =
          multiple && (selectedValue as OptionProp[]).length > 0
            ? (selectedValue as OptionProp[]).map(({ value }) => (value ?? '').toString())
            : [];
        const optionValue = multiple
          ? formatSelectedValue.includes(option.value.toString())
            ? formatSelectedValue
            : [...formatSelectedValue, option.value.toString()]
          : option.value.toString();
        onChange &&
          onChange({
            ...e,
            target: {
              ...e?.target,
              value: optionValue,
            },
          });
      }
    },
    [selectedValue, multiple, onChange],
  );

  const renderEmptyMessage = useCallback(() => {
    if (options.length > 0 && filteredOptions.length === 0) {
      return 'There are no results for this search.';
    }

    if (options.length === 0) {
      return empty || 'No options available.';
    }
  }, [empty, options, filteredOptions]);

  const renderOption = useCallback(
    (index: number, optionProps: OptionProp) => {
      return (
        <Option
          key={index}
          {...optionProps}
          id={optionId(id, index)}
          active={index === activeIndex}
          onMouseEnter={isNavigable(optionProps) ? () => onActiveChange(index) : undefined}
          onClick={optionProps.onClick ?? handleSelectOption}
          selected={isSelected(optionProps) || !!optionProps.selected}
          isField={isField}
          minWidth={minWidth}
        />
      );
    },
    [id, activeIndex, minWidth, isField, isSelected, handleSelectOption, onActiveChange],
  );

  return (
    <div
      ref={ref}
      id={id}
      role="listbox"
      aria-multiselectable={multiple || undefined}
      className={cx('OptionList', className, { searchable })}
      style={style}
      data-dropdown-scope={scope}
      data-active-source={activeSource}
      onMouseLeave={() => onActiveChange(-1)}
    >
      {searchable && options.length > 0 ? (
        <TextField
          className="OptionListSearch"
          placeholder="Search"
          leftIcon={<SearchIcon />}
          onChange={handleSearchChange}
          onClick={handleSearchClick}
          autoSelect
          {...searchInputProps}
        />
      ) : null}
      {filteredOptions.length > 0 ? (
        filteredOptions.map(({ option, index }) =>
          option.tooltip ? (
            <InfoTooltip
              key={index}
              trigger={renderOption(index, option)}
              position="left center"
              {...(isTooltipText(option.tooltip) ? { text: option.tooltip } : option.tooltip)}
            />
          ) : (
            renderOption(index, option)
          ),
        )
      ) : (
        <Option
          className="OptionListEmpty"
          label={renderEmptyMessage()}
          disabled
        />
      )}
    </div>
  );
});

export default React.memo(OptionList);
