/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'era-1945': '#8B4513',
        'era-1965': '#4169E1',
        'era-1985': '#FF69B4',
        'era-2005': '#32CD32',
        'era-2025': '#00CED1',
        'era-2055': '#9932CC',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}