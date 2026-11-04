/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ivory: {
          50: '#FAF9F6',
          100: '#F5F3EE',
          200: '#EDEAE3',
          300: '#E2DED4',
          400: '#D4CFC3',
        },
        graphite: {
          DEFAULT: '#202124',
          700: '#3C3D40',
          600: '#5A5B5F',
          500: '#77787C',
          400: '#9A9B9F',
          300: '#C4C5C8',
          200: '#E0E1E3',
        },
        navy: {
          DEFAULT: '#172554',
          900: '#111B3F',
          800: '#172554',
          700: '#1E3169',
          600: '#273F85',
          500: '#34509E',
        },
        academic: {
          DEFAULT: '#5478A8',
          600: '#45678F',
          500: '#5478A8',
          400: '#7593BC',
          200: '#C3D2E4',
          100: '#E4EBF3',
        },
        lavender: {
          DEFAULT: '#B8B5E8',
          400: '#B8B5E8',
          200: '#DCDAF4',
          100: '#EFEEFB',
        },
        gold: {
          DEFAULT: '#C6A76B',
          600: '#B08F4F',
          400: '#D6BC89',
          200: '#EDE0C7',
          100: '#F7F1E4',
        },
      },
      fontFamily: {
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
        grotesk: ['"Space Grotesk"', '"DM Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        prose2: '68ch',
      },
      boxShadow: {
        lift: '0 1px 2px rgba(32,33,36,0.04), 0 12px 32px -12px rgba(32,33,36,0.14)',
        lift2: '0 2px 4px rgba(32,33,36,0.05), 0 24px 48px -20px rgba(23,37,84,0.22)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.65)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'paper-drift': {
          '0%, 100%': { transform: 'translate3d(0,0,0) rotate(var(--r, 0deg))' },
          '50%': { transform: 'translate3d(0,-14px,0) rotate(calc(var(--r, 0deg) + 1.2deg))' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-420px 0' },
          '100%': { backgroundPosition: '420px 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.7s cubic-bezier(0.22,1,0.36,1) both',
        'paper-drift': 'paper-drift 9s ease-in-out infinite',
        'shimmer': 'shimmer 2.4s linear infinite',
      },
    },
  },
  plugins: [],
}
