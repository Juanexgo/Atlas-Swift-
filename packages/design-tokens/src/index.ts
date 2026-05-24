/**
 * Atlas design tokens.
 *
 * Tokens are the single source of truth for visual language. They are
 * authored as typed TS constants and consumed two ways:
 *   1. Directly from TS (animation values, shader uniforms, etc.)
 *   2. As CSS variables from tokens.css for declarative styling.
 *
 * Rule: components reference tokens, never magic numbers.
 */

export const color = {
  // Canvas / surface
  void: '#000000',
  ink: '#06070A',
  graphite: '#0E1014',
  smoke: '#16181E',
  fog: '#1F222B',

  // Surface glass tints (use with backdrop-filter)
  glass: {
    base: 'rgba(255, 255, 255, 0.04)',
    raised: 'rgba(255, 255, 255, 0.06)',
    floating: 'rgba(255, 255, 255, 0.08)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.14)',
  },

  // Text
  text: {
    primary: 'rgba(255, 255, 255, 0.96)',
    secondary: 'rgba(255, 255, 255, 0.64)',
    tertiary: 'rgba(255, 255, 255, 0.42)',
    quaternary: 'rgba(255, 255, 255, 0.22)',
  },

  // Accents — spatial palette, OKLCH-derived for perceptual uniformity
  accent: {
    aurora: '#7CC6FF',
    nebula: '#A78BFA',
    plasma: '#F472B6',
    solar: '#FCD34D',
    forest: '#6EE7B7',
    coral: '#FB923C',
    indigo: '#818CF8',
  },

  // Semantic
  semantic: {
    focus: '#7CC6FF',
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#F87171',
  },
} as const;

export const space = {
  px: '1px',
  0: '0',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
} as const;

export const radius = {
  none: '0',
  xs: '4px',
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '20px',
  '2xl': '28px',
  pill: '999px',
} as const;

export const font = {
  family: {
    // Loaded by Next.js in the web app and exposed via CSS var
    sans: 'var(--font-sans), -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
    mono: 'var(--font-mono), ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace',
    display:
      'var(--font-display), var(--font-sans), -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  },
  size: {
    xs: '11px',
    sm: '12px',
    base: '13px',
    md: '14px',
    lg: '16px',
    xl: '20px',
    '2xl': '28px',
    '3xl': '40px',
    '4xl': '56px',
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  tracking: {
    tight: '-0.02em',
    normal: '0',
    wide: '0.02em',
    wider: '0.08em',
  },
  leading: {
    tight: 1.15,
    normal: 1.4,
    relaxed: 1.6,
  },
} as const;

/**
 * Motion is expressed as named springs, not durations.
 * Durations couple to feel — springs encode it directly.
 *
 * Tunings derived empirically to match Apple's `UIView.animate(usingSpring…)`
 * presets, then nudged for our denser UI.
 */
export const motion = {
  spring: {
    /** Instant feedback (button press, hover). */
    snappy: { stiffness: 520, damping: 38, mass: 1 },
    /** Default for most UI transitions. */
    standard: { stiffness: 320, damping: 32, mass: 1 },
    /** Camera flights, focus mode, hero transitions. */
    cinematic: { stiffness: 140, damping: 24, mass: 1.2 },
    /** Slow, ambient — used for background/atmospheric motion. */
    ambient: { stiffness: 60, damping: 22, mass: 1.4 },
    /** Decay for inertial pan/scroll. */
    inertia: { stiffness: 28, damping: 18, mass: 1 },
  },
  ease: {
    // For non-spring transitions (rarely used; prefer springs)
    standard: [0.22, 1, 0.36, 1] as const,
    in: [0.4, 0, 1, 1] as const,
    out: [0, 0, 0.2, 1] as const,
    inOut: [0.4, 0, 0.2, 1] as const,
  },
  duration: {
    instant: 90,
    fast: 160,
    normal: 240,
    slow: 420,
    cinematic: 720,
  },
} as const;

/**
 * Depth/elevation layers. Z-index AND blur AND shadow are all coupled to
 * a single elevation token so visual hierarchy stays coherent.
 */
export const elevation = {
  canvas: {
    z: 0,
    blur: 0,
    shadow: 'none',
  },
  raised: {
    z: 10,
    blur: 24,
    shadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.4)',
  },
  floating: {
    z: 100,
    blur: 40,
    shadow:
      '0 1px 0 rgba(255,255,255,0.06) inset, 0 12px 32px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3)',
  },
  command: {
    z: 200,
    blur: 60,
    shadow:
      '0 1px 0 rgba(255,255,255,0.08) inset, 0 24px 64px rgba(0,0,0,0.6), 0 8px 24px rgba(0,0,0,0.4)',
  },
  modal: {
    z: 300,
    blur: 80,
    shadow: '0 32px 96px rgba(0,0,0,0.7)',
  },
} as const;

/**
 * LOD distance thresholds — camera distance (orthographic zoom) at which
 * the renderer transitions between detail tiers.
 */
export const lod = {
  /** Below this zoom: render clusters only. */
  cluster: 0.35,
  /** Below this zoom: render sprite + label. */
  sprite: 1.2,
  /** At/above this zoom: a node can be promoted to DOM card. */
  card: 2.5,
} as const;

export type Tokens = {
  color: typeof color;
  space: typeof space;
  radius: typeof radius;
  font: typeof font;
  motion: typeof motion;
  elevation: typeof elevation;
  lod: typeof lod;
};

export const tokens: Tokens = { color, space, radius, font, motion, elevation, lod };
