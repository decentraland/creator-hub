import React, { forwardRef, memo, type ReactNode } from 'react';
import type { IconDrawing } from './icon-set.generated';
import { SvgIcon, type SvgIconProps } from './SvgIcon';

/** The inspector's icon factory: `small` renders the small drawing when the icon has one. */
export function createSvgIcon(path: ReactNode, displayName: string, small?: IconDrawing) {
  const Icon = forwardRef<SVGSVGElement, SvgIconProps>(function Icon(props, ref) {
    const drawing = props.fontSize === 'small' && small ? small : { path, viewBox: '0 0 24 24' };
    return (
      <SvgIcon
        ref={ref}
        viewBox={drawing.viewBox}
        overflow={drawing === small ? undefined : 'visible'}
        {...props}
      >
        {drawing.path}
      </SvgIcon>
    );
  });
  Icon.displayName = `${displayName}Icon`;
  return memo(Icon);
}
