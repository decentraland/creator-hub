import React, { useCallback, useState } from 'react';
import { VscEllipsis as EllipsisIcon } from 'react-icons/vsc';
import { Button } from '../../Button';
import { Option } from '../../ui/Dropdown/Option';
import type { Props as OptionProp } from '../../ui/Dropdown/Option/types';
import { useOutsideClick } from '../../../hooks/useOutsideClick';

import './MoreOptionsMenu.css';

export const MoreOptionsMenu = ({
  children,
  options,
  icon,
}: {
  children?: JSX.Element | JSX.Element[];
  options?: OptionProp[];
  icon?: JSX.Element;
}) => {
  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);

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
  }, [showMoreOptions, setShowMoreOptions]);

  const ref = useOutsideClick(handleClosePanel);

  return (
    <div
      className="MoreOptionsMenu"
      ref={ref}
    >
      <Button
        className="MoreOptionsButton"
        onClick={handleShowMoreOptions}
      >
        {icon ?? <EllipsisIcon size={16} />}
      </Button>
      {showMoreOptions && (
        <div
          className="MoreOptionsContent"
          onClick={handleClosePanel}
        >
          {options
            ? options.map((opt, i) => (
                <Option
                  key={i}
                  {...opt}
                />
              ))
            : children}
        </div>
      )}
    </div>
  );
};

export default React.memo(MoreOptionsMenu);
