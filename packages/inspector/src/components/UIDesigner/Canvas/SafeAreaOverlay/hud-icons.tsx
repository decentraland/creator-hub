import React from 'react';

import type { HudKind } from '../../shared/safe-areas';

const FILL = 'rgba(14, 11, 16, 0.72)';

const svg = {
  viewBox: '0 0 24 24',
  'aria-hidden': true,
  width: '100%',
  height: '100%',
};

const line = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** The shared button body: a dark filled disc with a white ring. */
const Disc: React.FC<{ r?: number }> = ({ r = 11 }) => (
  <circle
    cx="12"
    cy="12"
    r={r}
    fill={FILL}
    stroke="currentColor"
    strokeWidth="1.2"
  />
);

const KeyIcon: React.FC<{ label: string; fontSize?: number }> = ({ label, fontSize = 11 }) => (
  <svg {...svg}>
    <Disc />
    <text
      x="12"
      y="12.5"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={fontSize}
      fontWeight="700"
      fill="currentColor"
      stroke="none"
    >
      {label}
    </text>
  </svg>
);

const Joystick: React.FC = () => (
  <svg {...svg}>
    <Disc />
    <circle
      cx="12"
      cy="12"
      r="4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    />
  </svg>
);

const Jump: React.FC = () => (
  <svg {...svg}>
    <Disc />
    <g {...line}>
      <path d="M7.5 12.5 L12 8 L16.5 12.5" />
      <path d="M7.5 16 L12 11.5 L16.5 16" />
    </g>
  </svg>
);

const Emote: React.FC = () => (
  <svg {...svg}>
    <Disc />
    <circle
      cx="12"
      cy="7.5"
      r="1.5"
      fill="currentColor"
      stroke="none"
    />
    <g {...line}>
      <path d="M12 9 V14" />
      <path d="M12 10.5 L8.5 8.5" />
      <path d="M12 10.5 L15.5 9" />
      <path d="M12 14 L9.5 18.5" />
      <path d="M12 14 L14.5 18.5" />
    </g>
  </svg>
);

const Profile: React.FC = () => (
  <svg {...svg}>
    <Disc />
    <circle
      cx="12"
      cy="10"
      r="2.8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
    />
    <path
      d="M7 17.5 a5 4 0 0 1 10 0"
      {...line}
      strokeWidth="1.3"
    />
  </svg>
);

const Chat: React.FC = () => (
  <svg {...svg}>
    <Disc />
    <path
      d="M7 9 H17 A1.4 1.4 0 0 1 18.4 10.4 V14 A1.4 1.4 0 0 1 17 15.4 H11 L8.4 18 V15.4 H7 A1.4 1.4 0 0 1 5.6 14 V10.4 A1.4 1.4 0 0 1 7 9 Z"
      {...line}
      strokeWidth="1.3"
    />
  </svg>
);

const Compass: React.FC = () => (
  <svg {...svg}>
    <Disc />
    <path
      d="M15 9 L11.2 11.2 L9 15 L12.8 12.8 Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="0.8"
      strokeLinejoin="round"
    />
  </svg>
);

const Pointer: React.FC = () => (
  <svg {...svg}>
    <Disc />
    <path
      d="M10 6.5 V13 L8 11.4 A1.3 1.3 0 0 0 6.2 13.2 L9 17.5 A3.2 3.2 0 0 0 11.7 19 H14.5 A2 2 0 0 0 16.5 17 V12.5 A1.2 1.2 0 0 0 14.1 12.5 A1.2 1.2 0 0 0 11.7 12.5 V6.5 A1.2 1.2 0 0 0 10 6.5 Z"
      {...line}
      strokeWidth="1.1"
    />
  </svg>
);

const ICONS: Record<HudKind, React.FC> = {
  joystick: Joystick,
  jump: Jump,
  keyF: () => <KeyIcon label="F" />,
  keyE: () => <KeyIcon label="E" />,
  emote: Emote,
  profile: Profile,
  chat: Chat,
  compass: Compass,
  counter: () => (
    <KeyIcon
      label="12"
      fontSize={9.5}
    />
  ),
  pointer: Pointer,
};

export const HudIcon: React.FC<{ kind: HudKind }> = ({ kind }) => {
  const Icon = ICONS[kind];
  return <Icon />;
};
