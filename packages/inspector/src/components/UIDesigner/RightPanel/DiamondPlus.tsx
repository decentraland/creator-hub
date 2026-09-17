import React from 'react';

/** The design's diamond-plus glyph for the "Add New …" menu rows. */
export const DiamondPlus: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden
  >
    <path
      d="M8 1.6 14.4 8 8 14.4 1.6 8 8 1.6Z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path
      d="M8 5.5v5M5.5 8h5"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  </svg>
);

export default DiamondPlus;
