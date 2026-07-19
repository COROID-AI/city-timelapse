/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'era-1945': '#8B4513',
        'era-1965': '#FF6B35',
        'era-1985': '#FFD23F',
        'era-2005': '#06FFA5',
        'era-2025': '#1E90FF',
        'era-2055': '#9D4EDD',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}