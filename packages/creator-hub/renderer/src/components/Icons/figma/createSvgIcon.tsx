import { forwardRef, memo, type ReactNode } from 'react';
import type { IconDrawing } from '@dcl/inspector/icons';
import { SvgIcon, type SvgIconProps } from 'decentraland-ui2';

/** Binds one Figma icon to ui2's `SvgIcon`; `fontSize="small"` renders the small drawing at 16px. */
export function createSvgIcon(path: ReactNode, displayName: string, small?: IconDrawing) {
  const Icon = forwardRef<SVGSVGElement, SvgIconProps>(function Icon({ sx, ...props }, ref) {
    const isSmall = props.fontSize === 'small';
    const drawing = isSmall && small ? small : { path, viewBox: '0 0 24 24' };
    const own = sx === undefined ? [] : Array.isArray(sx) ? sx : [sx];
    return (
      <SvgIcon
        ref={ref}
        viewBox={drawing.viewBox}
        overflow={drawing === small ? undefined : 'visible'}
        {...props}
        sx={isSmall ? [{ fontSize: 16 }, ...own] : sx}
      >
        {drawing.path}
      </SvgIcon>
    );
  });
  Icon.displayName = `${displayName}Icon`;
  return Object.assign(memo(Icon), { muiName: SvgIcon.muiName });
}
