import React from 'react';

import type { HudKind } from '../../shared/safe-areas';

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  width: '100%',
  height: '100%',
};

const KeyIcon: React.FC<{ letter: string }> = ({ letter }) => (
  <svg {...base}>
    <circle
      cx="12"
      cy="12"
      r="9"
    />
    <text
      x="12"
      y="12"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize="11"
      fontWeight="600"
      stroke="none"
      fill="currentColor"
    >
      {letter}
    </text>
  </svg>
);

const Joystick: React.FC = () => (
  <svg {...base}>
    <circle
      cx="12"
      cy="12"
      r="10"
    />
    <circle
      cx="12"
      cy="12"
      r="3.5"
    />
  </svg>
);

const Jump: React.FC = () => (
  <svg {...base}>
    <circle
      cx="12"
      cy="12"
      r="10"
    />
    <path d="M12 16.5 V8.5" />
    <path d="M8 11.5 L12 7.5 L16 11.5" />
  </svg>
);

const Emote: React.FC = () => (
  <svg {...base}>
    <circle
      cx="12"
      cy="6"
      r="2.2"
    />
    <path d="M12 8.5 V15" />
    <path d="M7.5 10.5 L12 12 L16.5 9" />
    <path d="M12 15 L9 20" />
    <path d="M12 15 L15 20" />
  </svg>
);

const Profile: React.FC = () => (
  <svg {...base}>
    <circle
      cx="12"
      cy="12"
      r="10"
    />
    <circle
      cx="12"
      cy="10"
      r="3"
    />
    <path d="M6.5 18.5 a5.5 5.5 0 0 1 11 0" />
  </svg>
);

const Chat: React.FC = () => (
  <svg {...base}>
    <path d="M4 6 A2 2 0 0 1 6 4 H18 A2 2 0 0 1 20 6 V14 A2 2 0 0 1 18 16 H10 L6 20 V16 A2 2 0 0 1 4 14 Z" />
  </svg>
);

const Counter: React.FC = () => <KeyIcon letter="12" />;

const Pointer: React.FC = () => (
  <svg {...base}>
    <path d="M9 5 V13 L6.5 11 A1.6 1.6 0 0 0 4.3 13.3 L8 19 A4 4 0 0 0 11.3 20.5 H15 A3 3 0 0 0 18 17.5 V12 A1.5 1.5 0 0 0 15 12 A1.5 1.5 0 0 0 12 12 V5 A1.5 1.5 0 0 0 9 5 Z" />
  </svg>
);

const ICONS: Record<HudKind, React.FC> = {
  joystick: Joystick,
  jump: Jump,
  keyF: () => <KeyIcon letter="F" />,
  keyE: () => <KeyIcon letter="E" />,
  emote: Emote,
  profile: Profile,
  chat: Chat,
  counter: Counter,
  pointer: Pointer,
};

export const HudIcon: React.FC<{ kind: HudKind }> = ({ kind }) => {
  const Icon = ICONS[kind];
  return <Icon />;
};
