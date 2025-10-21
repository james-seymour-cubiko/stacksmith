/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Everforest Dark Hard - Official color palette
        'everforest': {
          bg0: '#1e2326',
          bg1: '#272e33',
          bg2: '#2e383c',
          bg3: '#374145',
          bg4: '#495156',
          bg5: '#4f5b58',
          'bg-visual': '#503946',
          'bg-red': 'rgba(230, 126, 128, 0.10)',
          'bg-yellow': '#4d4c43',
          'bg-green': 'rgba(167, 192, 128, 0.10)',
          'bg-blue': '#3a515d',
          fg: '#d3c6aa',
          red: '#e67e80',
          orange: '#e69875',
          yellow: '#dbbc7f',
          green: '#a7c080',
          aqua: '#83c092',
          blue: '#7fbbb3',
          purple: '#d699b6',
          grey0: '#7a8478',
          grey1: '#859289',
          grey2: '#9da9a0',
          'statusline1': '#a7c080',
          'statusline2': '#d3c6aa',
          'statusline3': '#e67e80',
        }
      },
    },
  },
  plugins: [],
}
