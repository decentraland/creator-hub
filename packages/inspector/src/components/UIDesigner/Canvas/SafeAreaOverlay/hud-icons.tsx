import React from 'react';

import type { HudKind } from '../../shared/safe-areas';

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

/** The dark radial-gradient shared by every button body; id is reused across icons on purpose (identical paint). */
const DiscGradient: React.FC = () => (
  <radialGradient id="mobile-hud-disc">
    <stop
      stopColor="#251A3B"
      stopOpacity="0.9"
    />
    <stop
      offset="1"
      stopColor="#161518"
      stopOpacity="0.9"
    />
  </radialGradient>
);

/** The shared button body in the 24-space icons: a dark gradient disc with a ring in the current colour. */
const Disc: React.FC<{ r?: number }> = ({ r = 11 }) => (
  <>
    <circle
      cx="12"
      cy="12"
      r={r}
      fill="url(#mobile-hud-disc)"
      fillOpacity="0.5"
      stroke="currentColor"
      strokeWidth="0.6"
    />
    <DiscGradient />
  </>
);

/** A 44-space action button: gradient disc + ring, with its glyph dimmed to match the HUD. */
const DiscButton: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg
    viewBox="0 0 44 44"
    fill="none"
    width="100%"
    height="100%"
    aria-hidden
  >
    <circle
      cx="22"
      cy="22"
      r="21.8"
      fill="url(#mobile-hud-disc)"
      fillOpacity="0.5"
      stroke="currentColor"
      strokeWidth="0.9"
    />
    <g opacity="0.8">{children}</g>
    <DiscGradient />
  </svg>
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
  <svg
    viewBox="0 0 94 93"
    fill="none"
    width="100%"
    height="100%"
    aria-hidden
    xmlns="http://www.w3.org/2000/svg"
  >
    <g filter="url(#filter0_i_3885_3233)">
      <ellipse
        cx="46.87"
        cy="46.325"
        rx="46.87"
        ry="46.325"
        fill="url(#paint0_radial_3885_3233)"
        fillOpacity="0.5"
      />
      <path
        d="M46.8701 0.0908203C72.7065 0.0908835 93.6494 20.7918 93.6494 46.3252C93.6493 71.8585 72.7064 92.5595 46.8701 92.5596C21.0338 92.5596 0.0909288 71.8585 0.0908203 46.3252C0.0908203 20.7918 21.0337 0.0908203 46.8701 0.0908203Z"
        stroke="currentColor"
        strokeWidth="0.181667"
      />
    </g>
    <path
      d="M46.8706 29.7026C56.0598 29.7029 63.4927 37.0633 63.4927 46.1226C63.4926 55.1817 56.0598 62.5423 46.8706 62.5425C37.6812 62.5425 30.2476 55.1819 30.2476 46.1226C30.2476 37.0632 37.6812 29.7026 46.8706 29.7026Z"
      fill="currentColor"
      fillOpacity="0.5"
      stroke="currentColor"
      strokeWidth="1.635"
    />
    <defs>
      <filter
        id="filter0_i_3885_3233"
        x="0"
        y="0"
        width="94.4667"
        height="93.3766"
        filterUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        <feFlood
          floodOpacity="0"
          result="BackgroundImageFix"
        />
        <feBlend
          mode="normal"
          in="SourceGraphic"
          in2="BackgroundImageFix"
          result="shape"
        />
        <feColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset
          dx="0.726667"
          dy="0.726667"
        />
        <feGaussianBlur stdDeviation="0.726667" />
        <feComposite
          in2="hardAlpha"
          operator="arithmetic"
          k2="-1"
          k3="1"
        />
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0.818575 0 0 0 0 0.679838 0 0 0 0 1 0 0 0 0.5 0"
        />
        <feBlend
          mode="normal"
          in2="shape"
          result="effect1_innerShadow_3885_3233"
        />
      </filter>
      <radialGradient
        id="paint0_radial_3885_3233"
        cx="0"
        cy="0"
        r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="translate(46.87 46.325) rotate(90) scale(46.325 46.87)"
      >
        <stop
          stopColor="#251A3B"
          stopOpacity="0.9"
        />
        <stop
          offset="1"
          stopColor="#161518"
          stopOpacity="0.9"
        />
      </radialGradient>
    </defs>
  </svg>
);

const Jump: React.FC = () => (
  <svg
    viewBox="0 0 88 88"
    fill="none"
    width="100%"
    height="100%"
    aria-hidden
  >
    <circle
      cx="43.6"
      cy="43.6"
      r="43.6"
      fill="url(#mobile-hud-disc)"
      fillOpacity="0.5"
      stroke="currentColor"
      strokeWidth="0.9"
    />
    <g opacity="0.8">
      <path
        d="M37.9603 64.0377C37.6189 64.0377 37.3302 63.785 37.285 63.4466L35.9983 53.8067C35.9531 53.4683 35.6645 53.2156 35.3231 53.2156H29.0714C28.505 53.2156 28.186 52.5646 28.5331 52.1169L42.6384 33.9232C42.9112 33.5714 43.4425 33.5714 43.7152 33.9232L57.8206 52.1169C58.1676 52.5646 57.8486 53.2156 57.2822 53.2156H50.8345C50.493 53.2156 50.2044 53.4683 50.1592 53.8067L48.8725 63.4466C48.8273 63.785 48.5386 64.0377 48.1972 64.0377H37.9603Z"
        stroke="currentColor"
        strokeWidth="2.725"
      />
      <path
        d="M27.6812 41.8266L31.5551 36.9903L35.429 32.154L42.6451 23.1452C42.9178 22.8048 43.4358 22.8048 43.7085 23.1452L50.9246 32.154L54.7985 36.9903L58.6723 41.8266"
        stroke="currentColor"
        strokeWidth="2.18"
        strokeLinecap="round"
      />
    </g>
    <DiscGradient />
  </svg>
);

const Pointer: React.FC = () => (
  <DiscButton>
    <path
      d="M17.9073 32.2455L12.5882 24.6699C12.1489 24.0443 12.2403 23.1902 12.802 22.6717L13.4913 22.0354C14.0202 21.5472 14.8184 21.4949 15.4064 21.91L17.7683 23.5772V11.9796C17.7683 11.0492 18.5226 10.2949 19.453 10.2949C20.3026 10.2949 21.0193 10.9276 21.1247 11.7706L21.9314 18.2247L28.0049 18.9653C29.1715 19.1076 30.0408 20.1102 30.0163 21.2852L29.8692 28.3433C29.8639 28.5981 29.7949 28.8474 29.6685 29.0687L27.9216 32.1258C27.6499 32.6012 27.1443 32.8946 26.5967 32.8946H19.1562C18.659 32.8946 18.193 32.6524 17.9073 32.2455Z"
      stroke="currentColor"
      strokeWidth="2.18"
    />
  </DiscButton>
);

const KeyE: React.FC = () => (
  <DiscButton>
    <path
      d="M18.2924 30.0383C17.5213 30.0383 17.0587 29.5537 17.0587 28.7606V15.4217C17.0587 14.6287 17.5213 14.144 18.2924 14.144H26.1789C26.8619 14.144 27.3245 14.5626 27.3245 15.2124C27.3245 15.8623 26.8619 16.2809 26.1789 16.2809H19.526V20.9181H25.8154C26.4653 20.9181 26.9169 21.3146 26.9169 21.9425C26.9169 22.5593 26.4763 22.9668 25.8154 22.9668H19.526V27.9015H26.1789C26.8619 27.9015 27.3245 28.32 27.3245 28.9699C27.3245 29.6198 26.8619 30.0383 26.1789 30.0383H18.2924Z"
      fill="currentColor"
    />
  </DiscButton>
);

const KeyF: React.FC = () => (
  <DiscButton>
    <path
      d="M18.9587 30.2146C18.1877 30.2146 17.7251 29.7299 17.7251 28.9369V15.4217C17.7251 14.6286 18.1877 14.144 18.9587 14.144H26.6691C27.363 14.144 27.8256 14.5626 27.8256 15.2124C27.8256 15.8623 27.352 16.2809 26.6691 16.2809H20.1924V21.3036H26.0853C26.7462 21.3036 27.1978 21.7112 27.1978 22.339C27.1978 22.9779 26.7462 23.3854 26.0853 23.3854H20.1924V28.9369C20.1924 29.7299 19.7187 30.2146 18.9587 30.2146Z"
      fill="currentColor"
    />
  </DiscButton>
);

const Action1: React.FC = () => (
  <DiscButton>
    <path
      d="M23.1694 30.2476C22.4535 30.2476 21.9578 29.7409 21.9578 28.9919V16.6444H21.9027L19.16 18.5609C18.9177 18.7372 18.6974 18.8143 18.4221 18.8143C17.8823 18.8143 17.4968 18.4288 17.4968 17.867C17.4968 17.4595 17.651 17.1731 18.1136 16.8536L21.4181 14.5075C22.09 14.0339 22.4535 13.9347 22.9822 13.9347C23.8523 13.9347 24.37 14.4524 24.37 15.3116V28.9919C24.37 29.7409 23.8744 30.2476 23.1694 30.2476Z"
      fill="currentColor"
    />
  </DiscButton>
);

const Action2: React.FC = () => (
  <DiscButton>
    <path
      d="M17.7306 30.0383C16.9816 30.0383 16.5631 29.6198 16.5631 29.0029C16.5631 28.5183 16.7062 28.2539 17.246 27.7142L22.2136 22.6915C24.2844 20.5766 24.7911 19.7615 24.7911 18.4948C24.7911 16.9858 23.6235 15.8843 22.0264 15.8843C20.4623 15.8843 19.3828 16.6884 18.8321 18.2415C18.6118 18.7372 18.3254 19.0346 17.7196 19.0346C17.0257 19.0346 16.6291 18.605 16.6291 17.9882C16.6291 17.8009 16.6512 17.6357 16.6952 17.4705C17.0367 15.7962 18.8762 13.8466 22.0374 13.8466C25.0775 13.8466 27.2254 15.7191 27.2254 18.3406C27.2254 20.1471 26.3772 21.4248 23.7006 24.1014L19.9115 27.9015V27.9565H26.5094C27.1813 27.9565 27.5999 28.3751 27.5999 29.0029C27.5999 29.6198 27.1813 30.0383 26.5094 30.0383H17.7306Z"
      fill="currentColor"
    />
  </DiscButton>
);

const Action3: React.FC = () => (
  <DiscButton>
    <path
      d="M22.4062 30.3357C19.7957 30.3357 18.0223 29.3224 17.1411 27.7142C16.9208 27.3067 16.8217 26.9211 16.8217 26.5246C16.8217 25.8637 17.2402 25.4342 17.9342 25.4342C18.4629 25.4342 18.7713 25.6765 19.0246 26.2492C19.5643 27.5159 20.5997 28.276 22.4172 28.276C24.3448 28.276 25.6445 27.1745 25.6555 25.6324C25.6665 23.815 24.3558 22.8016 22.2299 22.8016H21.1725C20.5447 22.8016 20.1481 22.4161 20.1481 21.8433C20.1481 21.2706 20.5447 20.885 21.1725 20.885H22.1638C23.9813 20.885 25.2149 19.8056 25.2149 18.3296C25.2149 16.8536 24.2677 15.8733 22.3841 15.8733C20.776 15.8733 19.8728 16.5452 19.322 17.867C19.0577 18.5059 18.7933 18.7372 18.2095 18.7372C17.5156 18.7372 17.1411 18.3406 17.1411 17.6797C17.1411 17.2502 17.2292 16.8867 17.4385 16.4791C18.2316 14.904 19.9609 13.8466 22.3841 13.8466C25.6225 13.8466 27.6162 15.62 27.6162 17.9882C27.6162 19.9708 26.2173 21.3146 24.2677 21.7222V21.7772C26.6028 21.9865 28.1669 23.4074 28.1669 25.6324C28.1669 28.4302 25.7216 30.3357 22.4062 30.3357Z"
      fill="currentColor"
    />
  </DiscButton>
);

const Action4: React.FC = () => (
  <DiscButton>
    <path
      d="M24.7607 30.2476C24.0778 30.2476 23.5821 29.774 23.5821 29.014V26.8771H17.0394C16.1582 26.8771 15.5964 26.3263 15.5964 25.4782C15.5964 24.9165 15.7286 24.4759 16.1472 23.7489C17.2707 21.7332 19.2423 18.7812 21.2911 15.8072C22.2604 14.3753 22.8882 13.9347 23.9236 13.9347C25.2123 13.9347 25.9503 14.6066 25.9503 15.7962V24.8063H27.206C27.8559 24.8063 28.2855 25.2249 28.2855 25.8417C28.2855 26.4585 27.8559 26.8771 27.206 26.8771H25.9503V29.014C25.9503 29.774 25.4547 30.2476 24.7607 30.2476ZM23.6042 24.8394V16.1157H23.5601C20.8615 19.9818 19.1983 22.4712 17.9095 24.7733V24.8394H23.6042Z"
      fill="currentColor"
    />
  </DiscButton>
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

/** The center reticle: a thin plus, no disc. */
const Crosshair: React.FC = () => (
  <svg {...svg}>
    <g {...line}>
      <path d="M12 7 V17" />
      <path d="M7 12 H17" />
    </g>
  </svg>
);

/** The overflow toggle: a plus in a disc. */
const Plus: React.FC = () => (
  <DiscButton>
    <line
      x1="22.3851"
      y1="14.4648"
      x2="22.3851"
      y2="28.8717"
      stroke="currentColor"
      strokeWidth="2.18"
      strokeLinecap="round"
    />
    <line
      x1="29.5352"
      y1="22.2399"
      x2="15.1283"
      y2="22.2399"
      stroke="currentColor"
      strokeWidth="2.18"
      strokeLinecap="round"
    />
  </DiscButton>
);

const ICONS: Record<HudKind, React.FC> = {
  joystick: Joystick,
  jump: Jump,
  keyF: KeyF,
  keyE: KeyE,
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
  crosshair: Crosshair,
  plus: Plus,
  action1: Action1,
  action2: Action2,
  action3: Action3,
  action4: Action4,
};

export const HudIcon: React.FC<{ kind: HudKind }> = ({ kind }) => {
  const Icon = ICONS[kind];
  return <Icon />;
};
