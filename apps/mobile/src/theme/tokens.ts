/**
 * Mobile tokens — mirrors @atlas/design-tokens.
 *
 * Duplicated here because mobile lives outside the pnpm workspace
 * (React Native 0.76 pins React 18, the web is on React 19). Keep in
 * sync with packages/design-tokens/src/index.ts.
 */
import type { NodeKind } from '../types';

export const color = {
  void: '#000000',
  ink: '#06070A',
  graphite: '#0E1014',
  smoke: '#16181E',

  glass: {
    base: 'rgba(255, 255, 255, 0.05)',
    raised: 'rgba(255, 255, 255, 0.07)',
    floating: 'rgba(255, 255, 255, 0.09)',
    border: 'rgba(255, 255, 255, 0.10)',
    borderStrong: 'rgba(255, 255, 255, 0.16)',
  },

  text: {
    primary: 'rgba(255, 255, 255, 0.96)',
    secondary: 'rgba(255, 255, 255, 0.64)',
    tertiary: 'rgba(255, 255, 255, 0.42)',
    quaternary: 'rgba(255, 255, 255, 0.22)',
  },

  accent: {
    aurora: '#7CC6FF',
    nebula: '#A78BFA',
    plasma: '#F472B6',
    solar: '#FCD34D',
    forest: '#6EE7B7',
    coral: '#FB923C',
    indigo: '#818CF8',
  },
} as const;

export const NODE_KIND_ACCENT: Record<NodeKind, keyof typeof color.accent> = {
  note: 'aurora',
  idea: 'solar',
  task: 'forest',
  project: 'indigo',
  conversation: 'plasma',
  link: 'coral',
  memory: 'nebula',
  document: 'aurora',
};

export function accentFor(kind: NodeKind): string {
  return color.accent[NODE_KIND_ACCENT[kind]];
}

/** Springs — named, matching @atlas/design-tokens. */
export const spring = {
  snappy: { stiffness: 520, damping: 38, mass: 1 },
  standard: { stiffness: 320, damping: 32, mass: 1 },
  cinematic: { stiffness: 140, damping: 24, mass: 1.2 },
  ambient: { stiffness: 60, damping: 22, mass: 1.4 },
} as const;
