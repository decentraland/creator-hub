import React, { useId, useState } from 'react';
import cx from 'classnames';
import { ArrowRightIcon } from '../../Icons/ArrowRight';
import { CheckboxField } from '../CheckboxField';

import './Accordion.css';

export type AccordionProps = {
  label: string;
  children: React.ReactNode;
  className?: string;
  initialOpen?: boolean;
  enabled?: boolean;
  onToggleEnabled?: (enabled: boolean) => void;
};

export const Accordion: React.FC<AccordionProps> = ({
  label,
  children,
  className,
  initialOpen = true,
  enabled,
  onToggleEnabled,
}) => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const id = useId();
  const headerId = `${id}-header`;
  const regionId = `${id}-region`;
  const isOff = enabled === false;
  const isVisible = isOpen && !isOff;

  return (
    <div
      className={cx('Accordion', className, {
        open: isOpen,
        disabled: isOff,
        'has-toggle': enabled !== undefined,
      })}
    >
      <div className="header">
        <button
          type="button"
          id={headerId}
          className="toggle"
          aria-expanded={isOpen}
          aria-controls={regionId}
          onClick={() => setIsOpen(open => !open)}
        >
          <ArrowRightIcon />
          <span className="label">{label}</span>
        </button>
        {enabled !== undefined && (
          <CheckboxField
            className="enable"
            aria-label={`Enable ${label}`}
            checked={enabled}
            onChange={e => onToggleEnabled?.(e.target.checked)}
          />
        )}
      </div>
      <div
        id={regionId}
        role="region"
        aria-labelledby={headerId}
        className="content"
        hidden={!isVisible}
      >
        {isVisible && children}
      </div>
    </div>
  );
};

export default React.memo(Accordion);
