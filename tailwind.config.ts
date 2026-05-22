import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        vermelho: '#d42b2b',
        surface: 'var(--surface)',
        'surface-dim': 'var(--surface-dim)',
        card: 'var(--card)',
        'card-hi': 'var(--card-hi)',
        line: 'var(--line)',
        'line-hi': 'var(--line-hi)',
        ink: 'var(--ink)',
        dim: 'var(--dim)',
        faint: 'var(--faint)',
        // ── Admin brand tokens (Twix-style, vermelho accent) ──
        'brand-bg':           'var(--brand-bg)',
        'brand-surface':      'var(--brand-surface)',
        'brand-surface-2':    'var(--brand-surface-2)',
        'brand-accent':       'var(--brand-accent)',
        'brand-accent-hover': 'var(--brand-accent-hover)',
        'brand-border':       'var(--brand-border)',
        'brand-text':         'var(--brand-text)',
        'brand-muted':        'var(--brand-muted)',
      },
      fontFamily: {
        barlow: ['var(--font-barlow)', 'Barlow Condensed', 'sans-serif'],
        inter: ['var(--font-inter)', 'Inter', 'sans-serif'],
        // Legacy aliases used in admin and shared components
        rajdhani: ['var(--font-barlow)', 'sans-serif'],
        outfit: ['var(--font-inter)', 'sans-serif'],
        grotesk: ['var(--font-barlow)', 'sans-serif'],
        mono: ['monospace'],
      },
      borderRadius: {
        DEFAULT: '4px',
        sm: '3px',
        md: '4px',
        lg: '6px',
        xl: '6px',
        '2xl': '8px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
export default config
