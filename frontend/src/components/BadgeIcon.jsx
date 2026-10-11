import { useId } from 'react';

// tipos de badges
export const BADGE_TYPE_LABELS = { 0: 'Común', 1: 'Rara', 2: 'Épica', 3: 'Única' };

// colores según rareza
export const BADGE_TYPE_STYLES = {
  0: { from: '#3ee6c4', to: '#1fa88e', glow: 'rgba(62, 230, 196, 0.35)', pips: 1 },
  1: { from: '#5b9dff', to: '#3a5bff', glow: 'rgba(91, 157, 255, 0.4)', pips: 2 },
  2: { from: '#e070ff', to: '#ff4fa3', glow: 'rgba(224, 112, 255, 0.45)', pips: 3 },
  3: { from: '#8fd3ff', to: '#c664f7', glow: 'rgba(150, 140, 255, 0.45)', pips: 0 },
};

const SYMBOLS = {
  // icono labs
  labs: (
    <>
      <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
      <path d="M8.5 2h7" />
      <path d="M7 16h10" />
    </>
  ),
  // cronometro
  time: (
    <>
      <line x1="10" x2="14" y1="2" y2="2" />
      <line x1="12" x2="15" y1="14" y2="11" />
      <circle cx="12" cy="14" r="8" />
    </>
  ),
  // cohete
  account: (
    <>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </>
  ),
  // fuego
  streak: (
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  ),
  // diana
  no_fail: (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  // estrella
  default: (
    <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
  ),
};

const HEXAGON = 'M50 4 L90 27 L90 73 L50 96 L10 73 L10 27 Z';
const INNER_HEXAGON = 'M50 13 L82 31.5 L82 68.5 L50 87 L18 68.5 L18 31.5 Z';

// color para locked badges
const LOCKED_STYLE = { from: '#5a5468', to: '#34303f', glow: 'transparent' };

function BadgeIcon({ category, type = 0, size = 72, title, className, locked = false }) {
  const gradientId = `badge-gradient-${useId().replace(/:/g, '')}`;
  const typeStyle = BADGE_TYPE_STYLES[type] ?? BADGE_TYPE_STYLES[0];
  const style = locked ? { ...typeStyle, ...LOCKED_STYLE } : typeStyle;
  const symbol = SYMBOLS[category] ?? SYMBOLS.default;
  const paint = `url(#${gradientId})`;

  const pipsStart = 50 - (style.pips - 1) * 5;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={{ filter: `drop-shadow(0 0 10px ${style.glow})`, overflow: 'visible' }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      {title && <title>{title}</title>}

      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={style.from} />
          <stop offset="1" stopColor={style.to} />
        </linearGradient>
      </defs>

      <path d={HEXAGON} fill="#120f1a" stroke={paint} strokeWidth="4" strokeLinejoin="round" />
      <path
        d={INNER_HEXAGON}
        fill={paint}
        fillOpacity="0.08"
        stroke={paint}
        strokeOpacity="0.35"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      <g
        transform="translate(31 24) scale(1.6)"
        fill="none"
        stroke={paint}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {symbol}
      </g>

      {style.pips > 0 ? (
        Array.from({ length: style.pips }, (_, i) => (
          <circle key={i} cx={pipsStart + i * 10} cy="80" r="2.6" fill={paint} />
        ))
      ) : (
        <path d="M50 76.5 l3 3 -3 3 -3 -3 Z" fill={paint} />
      )}
    </svg>
  );
}

export default BadgeIcon;
