import React from 'react';

const base = {
  width: '1em',
  height: '1em',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

/** A GUI root: a dashboard grid of panels. */
export const GuiGridIcon: React.FC = () => (
  <svg {...base}>
    <rect
      x="3"
      y="3"
      width="8"
      height="8"
      rx="1.5"
    />
    <rect
      x="13"
      y="3"
      width="8"
      height="5"
      rx="1.5"
    />
    <rect
      x="13"
      y="10"
      width="8"
      height="11"
      rx="1.5"
    />
    <rect
      x="3"
      y="13"
      width="8"
      height="8"
      rx="1.5"
    />
  </svg>
);

/** Label: an "Aa" text field. */
export const LabelFieldIcon: React.FC = () => (
  <svg
    {...base}
    strokeWidth={1.4}
  >
    <rect
      x="2.5"
      y="5"
      width="19"
      height="14"
      rx="3"
    />
    <path d="M4.9 15 L7 9 L9.1 15" />
    <path d="M5.6 12.9 H8.4" />
    <path d="M16.4 11.7 V15.2" />
    <path d="M16.4 12.2 a 1.7 1.7 0 1 0 0 3" />
  </svg>
);

/** Input: an editable field (box with a pencil). */
export const InputFieldIcon: React.FC = () => (
  <svg {...base}>
    <path d="M12.5 5H5.5A2.5 2.5 0 0 0 3 7.5v9A2.5 2.5 0 0 0 5.5 19h9a2.5 2.5 0 0 0 2.5-2.5v-6.5" />
    <path d="M15.6 4.4a1.9 1.9 0 0 1 2.7 2.7l-6.1 6.1-3.2.5.5-3.2z" />
  </svg>
);

/** Dropdown: a select field (box with a chevron). */
export const DropdownFieldIcon: React.FC = () => (
  <svg {...base}>
    <rect
      x="2.5"
      y="5"
      width="19"
      height="14"
      rx="3"
    />
    <path d="M9 10.5l3 3 3-3" />
  </svg>
);
