/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        'era-1945': '#f59e0b',
        'era-1965': '#10b981',
        'era-1985': '#06b6d4',
        'era-2005': '#8b5cf6',
        'era-2025': '#ec4899',
        'era-2055': '#f97316',
      },
    },
  },
  plugins: [],
}