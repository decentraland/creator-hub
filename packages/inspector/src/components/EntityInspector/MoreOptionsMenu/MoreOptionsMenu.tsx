import React, { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { VscEllipsis as EllipsisIcon } from 'react-icons/vsc';
import cx from 'classnames';
import { Button } from '../../Button';
import { Option } from '../../ui/Dropdown/Option';
import type { Props as OptionProp } from '../../ui/Dropdown/Option/types';
import { usePopoverPosition } from '../../ui/usePopoverPosition';

import './MoreOptionsMenu.css';

export const MoreOptionsMenu = ({
  children,
  options,
  icon,
  className,
}: {
  children?: React.ReactNode;
  options?: OptionProp[];
  icon?: JSX.Element;
  /** Lands on the portalled menu, so a consumer can size it (see MoreOptionsMenu.css). */
  className?: string;
}) => {
  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const handleShowMoreOptions = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setShowMoreOptions(!showMoreOptions);
    },
    [showMoreOptions, setShowMoreOptions],
  );

  const handleClosePanel = useCallback(() => {
    setShowMoreOptions(false);
  }, [setShowMoreOptions]);

  const handleContentClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      setShowMoreOptions(false);
    },
    [setShowMoreOptions],
  );

  const position = usePopoverPosition({
    anchorRef,
    popoverRef: menuRef,
    open: showMoreOptions,
    onDismiss: handleClosePanel,
    // The menu sizes to its content, so let the hook measure it rather than pass a width.
    align: 'right',
  });

  return (
    <div
      className="MoreOptionsMenu"
      ref={anchorRef}
    >
      <Button
        className="MoreOptionsButton"
        onClick={handleShowMoreOptions}
      >
        {icon ?? <EllipsisIcon size={16} />}
      </Button>
      {showMoreOptions &&
        createPortal(
          <div
            ref={menuRef}
            className={cx('MoreOptionsContent', className)}
            style={{ top: position.top, left: position.left }}
            onClick={handleContentClick}
          >
            {options
              ? options.map((opt, i) => (
                  <Option
                    key={i}
                    {...opt}
                  />
                ))
              : children}
          </div>,
          document.body,
        )}
    </div>
  );
};

export default React.memo(MoreOptionsMenu);
