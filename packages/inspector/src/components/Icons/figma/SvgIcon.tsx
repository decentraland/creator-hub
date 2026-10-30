import React, { forwardRef, type SVGProps } from 'react';
import cx from 'classnames';

import './SvgIcon.css';

export type IconFontSize = 'inherit' | 'small' | 'medium';

export type IconColor =
  | 'inherit'
  | 'action'
  | 'disabled'
  | 'primary'
  | 'secondary'
  | 'error'
  | 'info'
  | 'success'
  | 'warning';

export type SvgIconProps = Omit<SVGProps<SVGSVGElement>, 'color' | 'fontSize' | 'ref'> & {
  fontSize?: IconFontSize;
  color?: IconColor;
  htmlColor?: string;
  titleAccess?: string;
};

const capitalize = (value: string) => value[0].toUpperCase() + value.slice(1);

/** The inspector's icon base: MUI's `SvgIcon` API, sized and coloured by `SvgIcon.css`. */
export const SvgIcon = forwardRef<SVGSVGElement, SvgIconProps>(function SvgIcon(
  {
    fontSize = 'medium',
    color = 'inherit',
    htmlColor,
    titleAccess,
    viewBox = '0 0 24 24',
    className,
    style,
    children,
    ...props
  },
  ref,
) {
  return (
    <svg
      ref={ref}
      viewBox={viewBox}
      fill="currentColor"
      focusable="false"
      aria-hidden={titleAccess ? undefined : true}
      role={titleAccess ? 'img' : undefined}
      {...props}
      className={cx(
        'SvgIcon',
        `SvgIcon--fontSize${capitalize(fontSize)}`,
        color !== 'inherit' && `SvgIcon--color${capitalize(color)}`,
        className,
      )}
      style={htmlColor ? { color: htmlColor, ...style } : style}
    >
      {titleAccess ? <title>{titleAccess}</title> : null}
      {children}
    </svg>
  );
});
