/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'era-1945': {
          primary: '#8B4513',
          secondary: '#A0522D',
          accent: '#CD853F',
        },
        'era-1965': {
          primary: '#4169E1',
          secondary: '#6495ED',
          accent: '#87CEEB',
        },
        'era-1985': {
          primary: '#FF1493',
          secondary: '#FF69B4',
          accent: '#FFB6C1',
        },
        'era-2005': {
          primary: '#00CED1',
          secondary: '#20B2AA',
          accent: '#40E0D0',
        },
        'era-2025': {
          primary: '#32CD32',
          secondary: '#9ACD32',
          accent: '#ADFF2F',
        },
        'era-2055': {
          primary: '#9370DB',
          secondary: '#BA55D3',
          accent: '#DDA0DD',
        },
      },
    },
  },
  plugins: [],
}