import type { CommonProps } from './types';

// A circled exclamation mark (MUI's ErrorOutline glyph) inlined as an SVG. It is NOT imported
// from @mui/icons-material on purpose: pulling in a not-yet-bundled icon retriggers Vite's dep
// optimizer, which reorders the MUI chunks into a broken init order (styled_default undefined).
// Inheriting currentColor lets the surrounding warning box tint it.
const PATH =
  'M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z';

export function WarningCircleIcon({ className, size = 24 }: CommonProps & { size?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={PATH}
        fill="currentColor"
      />
    </svg>
  );
}
