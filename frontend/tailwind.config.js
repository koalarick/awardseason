/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'oscars-red': '#0f1013',
        'oscars-gold': '#c8922f',
        'oscars-dark': '#1b1b1b',
        yellow: {
          50: '#fff8e6',
          100: '#fdefc7',
          200: '#f8dc9f',
          300: '#efc66f',
          400: '#e2ad46',
          500: '#c8922f',
          600: '#a77622',
          700: '#7f5a19',
          800: '#5c4112',
          900: '#3f2b0b',
          950: '#2a1c07',
        },
        slate: {
          50: '#f6f6f4',
          100: '#e9e9e6',
          200: '#d2d2cd',
          300: '#b4b3ad',
          400: '#96948d',
          500: '#78766f',
          600: '#5a5852',
          700: '#3f3d38',
          800: '#262522',
          900: '#141312',
          950: '#0b0a09',
        },
      },
      fontFamily: {
        oscars: ['Cormorant Garamond', 'serif'],
        sans: ['Source Sans 3', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
