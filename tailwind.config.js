/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 0 24px rgba(120, 200, 255, 0.35)',
      },
    },
  },
  plugins: [],
}
