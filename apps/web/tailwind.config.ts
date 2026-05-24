import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
    '../../packages/graph-engine/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        void: 'var(--atlas-void)',
        ink: 'var(--atlas-ink)',
        graphite: 'var(--atlas-graphite)',
        smoke: 'var(--atlas-smoke)',
        fog: 'var(--atlas-fog)',
      },
    },
  },
  plugins: [],
};

export default config;
