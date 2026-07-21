/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'era-1945': '#8B4513',
        'era-1965': '#2563EB',
        'era-1985': '#7C3AED',
        'era-2005': '#0EA5E9',
        'era-2025': '#14B8A6',
        'era-2055': '#F59E0B',
      },
    },
  },
  plugins: [],
}