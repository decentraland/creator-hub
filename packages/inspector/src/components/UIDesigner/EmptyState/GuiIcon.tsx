import React from 'react';

/** The UI-Designer first-run glyph: an image placeholder beside a few text lines. */
export const GuiIcon: React.FC = () => (
  <svg
    width="64"
    height="40"
    viewBox="0 0 64 40"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect
      x="1"
      y="5"
      width="38"
      height="30"
      rx="4"
    />
    <circle
      cx="12"
      cy="15"
      r="2.5"
    />
    <path d="M4 31l10-9 7 6 5-4 13 11" />
    <path d="M47 14h16M47 20h11M47 26h16" />
  </svg>
);

export default GuiIcon;
