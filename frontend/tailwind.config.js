/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'oscars-red': '#8B1538',
        'oscars-gold': '#D4AF37',
        'oscars-dark': '#1a1a1a',
      },
      fontFamily: {
        'oscars': ['Oswald', 'sans-serif'],
        'sans': ['Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
