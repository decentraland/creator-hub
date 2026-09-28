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

/** The shared rounded-square frame the field-like widgets are built on. */
const SQUIRCLE = { x: 4, y: 4, width: 16, height: 16, rx: 5 } as const;

/** MobileHUD: a HUD frame with a centred plus, from the HUD Revamp Figma. */
export const MobileHudIcon: React.FC = () => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M15.2 4.42308C15.2 3.78583 14.6627 3.26923 14 3.26923H2C1.33726 3.26923 0.8 3.78583 0.8 4.42308V11.5769C0.8 12.2142 1.33726 12.7308 2 12.7308H14C14.6627 12.7308 15.2 12.2142 15.2 11.5769V4.42308ZM16 11.5769C16 12.639 15.1046 13.5 14 13.5H2C0.895431 13.5 0 12.639 0 11.5769V4.42308C1.03083e-07 3.36099 0.895431 2.5 2 2.5H14C15.1046 2.5 16 3.36099 16 4.42308V11.5769Z" />
    <path d="M9.5 8.21429H8.21429V9.5H7.78571V8.21429H6.5V7.78571H7.78571V6.5H8.21429V7.78571H9.5V8.21429Z" />
    <path d="M13 5V11H3V5H13ZM3.2002 10.7998H12.7998V5.2002H3.2002V10.7998Z" />
  </svg>
);

/** A GUI root: a uniform 2×2 grid of panels. */
export const GuiGridIcon: React.FC = () => (
  <svg {...base}>
    <rect
      x="5"
      y="5"
      width="6"
      height="6"
      rx="1.5"
    />
    <rect
      x="13"
      y="5"
      width="6"
      height="6"
      rx="1.5"
    />
    <rect
      x="5"
      y="13"
      width="6"
      height="6"
      rx="1.5"
    />
    <rect
      x="13"
      y="13"
      width="6"
      height="6"
      rx="1.5"
    />
  </svg>
);

/** Container: an empty rounded square. */
export const ContainerIcon: React.FC = () => (
  <svg {...base}>
    <rect {...SQUIRCLE} />
  </svg>
);

/** Image: a framed picture with a sun and a mountain. */
export const ImageIcon: React.FC = () => (
  <svg {...base}>
    <rect {...SQUIRCLE} />
    <circle
      cx="9"
      cy="9.5"
      r="1.3"
    />
    <path d="M5.5 16.5 L9.5 12.5 L12.5 15.5" />
    <path d="M11.5 14.5 L14.5 11.5 L18.5 15.5" />
  </svg>
);

/** Button: a bare pill/circle, outside any frame. */
export const ButtonIcon: React.FC = () => (
  <svg {...base}>
    <circle
      cx="12"
      cy="12"
      r="7"
    />
  </svg>
);

/** Label: an "Aa" text field. */
export const LabelFieldIcon: React.FC = () => (
  <svg
    {...base}
    strokeWidth={1.4}
  >
    <rect {...SQUIRCLE} />
    <path d="M4.9 15 L7 9 L9.1 15" />
    <path d="M5.6 12.9 H8.4" />
    <path d="M16.4 11.7 V15.2" />
    <path d="M16.4 12.2 a 1.7 1.7 0 1 0 0 3" />
  </svg>
);

/** Input: an editable field (framed box with a pencil). */
export const InputFieldIcon: React.FC = () => (
  <svg {...base}>
    <path d="M14 4 H9 A5 5 0 0 0 4 9 V15 A5 5 0 0 0 9 20 H15 A5 5 0 0 0 20 15 V10" />
    <path d="M15.6 5.2 a1.9 1.9 0 0 1 2.7 2.7 l-6.1 6.1 -3.2 .5 .5 -3.2 z" />
  </svg>
);

/** Dropdown: a select field (framed box with a chevron). */
export const DropdownFieldIcon: React.FC = () => (
  <svg {...base}>
    <rect {...SQUIRCLE} />
    <path d="M9 10.5l3 3 3-3" />
  </svg>
);
