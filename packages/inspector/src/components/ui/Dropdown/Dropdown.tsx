import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { VscChevronDown as DownArrowIcon } from 'react-icons/vsc';
import cx from 'classnames';
import { isMixedValue } from '../utils';
import { usePopoverPosition } from '../usePopoverPosition';
import { useContainerSize } from '../../../hooks/useContainerSize';
import { Label } from '../Label';
import { Message, MessageType } from '../Message';
import { Option } from './Option';
import { OptionList } from './OptionList';
import { SelectedOption } from './SelectedOption';
import type { Props as OptionProp } from './Option/types';
import {
  FONT_SIZE,
  FONT_WEIGHT,
  WIDTH_CONST,
  ICON_SIZE,
  isMultipleOptionSelected,
  isNavigable,
  isOptionSelected,
  matchesSearch,
  MIXED_VALUE_LABEL,
  optionId,
} from './utils';
import type { SearchInputProps } from './OptionList/types';
import type { Props } from './types';
import './Dropdown.css';

const OPEN_KEYS = new Set(['Enter', ' ', 'ArrowDown', 'ArrowUp']);

const Dropdown = React.forwardRef<HTMLInputElement, Props>((props, parentRef) => {
  const {
    className,
    disabled,
    empty,
    error,
    info,
    label,
    options,
    searchable,
    value,
    multiple,
    trigger,
    menuAlign,
    onChange,
    placeholder = '',
  } = props;
  const [showOptions, setShowOptions] = useState(false);
  const [isFocused, setFocus] = useState(false);
  const [menuScope, setMenuScope] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searchFocused, setSearchFocused] = useState(false);
  const scrollToActive = useRef(false);
  const listId = useId();
  const isField = useMemo(() => !trigger, [trigger]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const optionListRef = useRef<HTMLDivElement>(null);

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      if (typeof parentRef === 'function') parentRef(node as never);
      else if (parentRef) (parentRef as React.MutableRefObject<unknown>).current = node;
    },
    [parentRef],
  );

  const openList = useCallback((initialActiveIndex: number) => {
    setMenuScope(
      containerRef.current?.closest('[data-dropdown-scope]')?.getAttribute('data-dropdown-scope') ??
        null,
    );
    setSearch('');
    setSearchFocused(false);
    scrollToActive.current = true;
    setActiveIndex(initialActiveIndex);
    setShowOptions(true);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setFocus(true);
      if (showOptions) {
        setShowOptions(false);
      } else {
        openList(-1);
      }
    },
    [showOptions, setShowOptions, setFocus, openList],
  );

  const handleCloseDropdown = useCallback(() => {
    setShowOptions(false);
    setFocus(false);
  }, [setShowOptions, setFocus]);

  const handleSearchChange = useCallback((nextSearch: string) => {
    setSearch(nextSearch);
    setActiveIndex(-1);
  }, []);

  const containerSize = useContainerSize(containerRef);
  const menuPosition = usePopoverPosition({
    anchorRef: containerRef,
    popoverRef: optionListRef,
    open: showOptions,
    onDismiss: handleCloseDropdown,
    // A trigger dropdown sizes its menu to the content, so let the hook measure it.
    width: isField ? containerSize.width : undefined,
    align: menuAlign,
    gap: 1,
  });

  const handleRemoveOption = useCallback(
    (e: any, option: Partial<OptionProp>) => {
      if (option !== undefined) {
        const values = typeof value === 'string' ? value.split(',') : (value as any[]);
        const optionValue = values.filter(v => v !== option.value);
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
    [multiple, value, onChange],
  );

  const isMixed = useMemo(() => isMixedValue(value), [value]);

  const selectedValue = useMemo(() => {
    if (isMixed) {
      return undefined;
    }
    if (multiple) {
      return options.filter(option => isMultipleOptionSelected(value as any[], option.value));
    } else {
      return options.find(option => isOptionSelected(value, option.value));
    }
  }, [options, value, multiple, isMixed]);

  const navigableIndexes = useMemo(
    () =>
      options.flatMap((option, idx) =>
        isNavigable(option) && matchesSearch(option, search) ? [idx] : [],
      ),
    [options, search],
  );

  const moveActive = useCallback(
    (step: 1 | -1) => {
      if (navigableIndexes.length === 0) return;
      const last = navigableIndexes.length - 1;
      const pos = navigableIndexes.indexOf(activeIndex);
      const next = pos === -1 ? (step === 1 ? 0 : last) : Math.min(last, Math.max(0, pos + step));
      scrollToActive.current = true;
      setActiveIndex(navigableIndexes[next]);
    },
    [navigableIndexes, activeIndex],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      const fromList = !!optionListRef.current?.contains(e.target as Node);
      if (e.target !== e.currentTarget && !fromList) return;

      if (!showOptions) {
        if (!OPEN_KEYS.has(e.key)) return;
        const selectedIndex = options.findIndex(
          option => option === selectedValue && isNavigable(option),
        );
        openList(selectedIndex >= 0 ? selectedIndex : options.findIndex(isNavigable));
      } else if (e.key === 'Tab') {
        handleCloseDropdown();
        if (!fromList) return;
        containerRef.current?.focus();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        moveActive(e.key === 'ArrowDown' ? 1 : -1);
      } else if (e.key === 'Enter' || (e.key === ' ' && !fromList)) {
        const active =
          activeIndex >= 0 ? document.getElementById(optionId(listId, activeIndex)) : null;
        if (active) active.click();
        else handleCloseDropdown();
        containerRef.current?.focus();
      } else if (e.key === 'Escape') {
        handleCloseDropdown();
        containerRef.current?.focus();
      } else {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    },
    [
      disabled,
      showOptions,
      options,
      selectedValue,
      activeIndex,
      listId,
      openList,
      moveActive,
      handleCloseDropdown,
    ],
  );

  useEffect(() => {
    if (!showOptions || activeIndex < 0 || !scrollToActive.current) return;
    scrollToActive.current = false;
    document.getElementById(optionId(listId, activeIndex))?.scrollIntoView({ block: 'nearest' });
  }, [showOptions, activeIndex, listId]);

  const activeId = showOptions && activeIndex >= 0 ? optionId(listId, activeIndex) : undefined;

  const searchInputProps = useMemo<SearchInputProps>(
    () => ({
      role: 'combobox',
      'aria-autocomplete': 'list',
      'aria-expanded': true,
      'aria-controls': listId,
      'aria-activedescendant': searchFocused ? activeId : undefined,
      onFocus: () => setSearchFocused(true),
      onBlur: () => setSearchFocused(false),
    }),
    [listId, searchFocused, activeId],
  );

  const minWidth = useMemo(() => {
    if (options.length > 0) {
      const horizontalPadding = 16;
      const iconWidth = ICON_SIZE + 4;
      const selectedIconWidth = iconWidth;
      let leftIconWidth = 0;
      let rightIconWidth = 0;
      const _minWidth = options.reduce((width, option) => {
        const label = option.label ?? option.value?.toString() ?? option.header ?? '';
        const labelWidth = label.length * FONT_SIZE * FONT_WEIGHT;
        leftIconWidth = Math.max(leftIconWidth, option.leftIcon ? iconWidth : 0);
        rightIconWidth = Math.max(rightIconWidth, option.rightIcon ? iconWidth : 0);
        return Math.max(
          width,
          (labelWidth + selectedIconWidth + leftIconWidth + rightIconWidth) / WIDTH_CONST,
        );
      }, 0);

      // To calculate the option's max width, we need to substract the drop icon width, the horizontal padding and the left and right icon width
      const maxWidth =
        isField && containerSize.width
          ? containerSize.width - (iconWidth + leftIconWidth + rightIconWidth + horizontalPadding)
          : Number.MAX_SAFE_INTEGER;

      return Math.min(_minWidth, maxWidth);
    }
  }, [options, empty, containerSize, isField]);

  const renderMessage = useCallback(() => {
    if (error) {
      return (
        <Message
          text={error}
          type={MessageType.ERROR}
        />
      );
    } else if (info) {
      return (
        <Message
          text={info}
          type={MessageType.INFO}
          icon={false}
        />
      );
    }

    return null;
  }, [error, info]);

  const renderPlaceholder = useCallback(() => {
    if (isMixed) {
      return (
        <Option
          className="DropdownPlaceholder mixed"
          value={MIXED_VALUE_LABEL}
          minWidth={minWidth}
        />
      );
    }
    return selectedValue ? (
      <SelectedOption
        selectedValue={selectedValue}
        minWidth={minWidth}
        multiple={multiple}
        onRemove={handleRemoveOption}
      />
    ) : (
      <Option
        className="DropdownPlaceholder"
        value={placeholder}
        minWidth={minWidth}
      />
    );
  }, [selectedValue, placeholder, minWidth, multiple, handleRemoveOption, isMixed]);

  return (
    <div className={cx('Dropdown', { Field: isField, Trigger: !!trigger })}>
      <Label text={label} />
      <div
        className={cx('DropdownContainer', className, {
          focused: isFocused,
          disabled: !!disabled,
          open: !!showOptions,
          error: !!error,
        })}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        ref={setContainerRef}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-expanded={showOptions}
        aria-haspopup="listbox"
        aria-controls={showOptions && !searchFocused ? listId : undefined}
        aria-activedescendant={searchFocused ? undefined : activeId}
        aria-label={props['aria-label'] ?? (typeof label === 'string' ? label : undefined)}
      >
        {isField ? renderPlaceholder() : trigger}
        {showOptions
          ? createPortal(
              <OptionList
                ref={optionListRef}
                id={listId}
                activeIndex={activeIndex}
                search={search}
                onSearchChange={handleSearchChange}
                searchInputProps={searchInputProps}
                onActiveChange={setActiveIndex}
                className={className}
                scope={menuScope ?? undefined}
                style={{
                  top: menuPosition.top,
                  left: menuPosition.left,
                  width: isField ? containerSize.width : undefined,
                }}
                options={options}
                searchable={searchable}
                selectedValue={selectedValue}
                multiple={multiple}
                onChange={onChange}
                isField={isField}
              />,
              document.body,
            )
          : null}
        {isField && (
          <div className="DropIcon">
            <DownArrowIcon size={ICON_SIZE} />
          </div>
        )}
      </div>
      {renderMessage()}
    </div>
  );
});

export default React.memo(Dropdown);
