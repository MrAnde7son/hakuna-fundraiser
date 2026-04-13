/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        hakuna: {
          50: '#f0f7ff',
          100: '#e0efff',
          200: '#b9dfff',
          300: '#7cc6ff',
          400: '#36a9ff',
          500: '#0c8fff',
          600: '#006fdf',
          700: '#0058b4',
          800: '#004b94',
          900: '#06407a',
          950: '#031a3a',
        },
        savanna: {
          50: '#fdf8ed',
          100: '#faefd0',
          200: '#f5dc9c',
          300: '#efc262',
          400: '#eaa93a',
          500: '#e08d1f',
          600: '#c66d16',
          700: '#a45017',
          800: '#853f19',
          900: '#6d3418',
          950: '#3f1b09',
        },
        ink: {
          50: '#f6f7f9',
          100: '#edeff3',
          200: '#d6dae3',
          300: '#b1b8c7',
          400: '#8690a5',
          500: '#67718a',
          600: '#525a72',
          700: '#43495d',
          800: '#393e4e',
          900: '#202330',
          950: '#12141c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)',
        lift: '0 4px 12px -2px rgba(16, 24, 40, 0.08), 0 2px 6px -2px rgba(16, 24, 40, 0.05)',
        glow: '0 0 0 1px rgba(0, 111, 223, 0.18), 0 8px 24px -8px rgba(0, 111, 223, 0.35)',
      },
      backgroundImage: {
        'hakuna-radial': 'radial-gradient(circle at 0% 0%, rgba(0,111,223,0.08), transparent 50%), radial-gradient(circle at 100% 100%, rgba(234,169,58,0.06), transparent 45%)',
        'grid-ink': 'linear-gradient(rgba(18,20,28,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(18,20,28,0.04) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid-sm': '24px 24px',
      },
    },
  },
  plugins: [],
}
