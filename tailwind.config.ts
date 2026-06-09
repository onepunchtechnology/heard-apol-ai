import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:            '#FFFFFF',
        surface:       '#FFF0F7',
        'surface-2':   '#FFD6E9',
        border:        '#FFC2DE',
        text:          '#2D0013',
        muted:         '#8B003D',
        accent:        '#FF99C8',
        'accent-dim':  '#FF479D',
        success:       '#216F3F',
        'success-bg':  '#D0F4DE',
        escalate:      '#8C4A35',
        'escalate-bg': '#FCEAE4',
        warning:       '#6B5904',
        'warning-bg':  '#FCF6BD',
      },
      fontFamily: {
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans:    ['Epilogue', 'system-ui', 'sans-serif'],
        mono:    ['"Martian Mono"', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
      },
      transitionDuration: {
        micro:  '75ms',
        short:  '150ms',
        medium: '250ms',
      },
      transitionTimingFunction: {
        'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
        'ease-in':  'cubic-bezier(0.4, 0, 1, 1)',
        'ease-io':  'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}

export default config
