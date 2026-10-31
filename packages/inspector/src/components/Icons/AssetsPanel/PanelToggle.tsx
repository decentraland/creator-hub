import React from 'react';

type Props = {
  /** Points the arrow at the panel it hides (the design mirrors the glyph for the open state). */
  mirrored?: boolean;
};

// Figma "Expand/Retract" (Collapse/Expand Panel states): a 20px glyph centred in a 24px icon box.
function PanelToggle({ mirrored = false }: Props) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="-2 -2 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path
        d="M7 0V20H-1V0H7ZM0 19H6V1H0V19Z"
        fill="currentColor"
      />
      <path
        d="M11.7707 14L8 10L11.7707 6L12.5714 6.84124L10.173 9.38557H16V10.6144H10.173L12.5714 13.1546L11.7707 14Z"
        fill="currentColor"
      />
      <rect
        x="0.5"
        y="0.5"
        width="19"
        height="19"
        rx="4.5"
        stroke="currentColor"
      />
    </svg>
  );
}

export default PanelToggle;
