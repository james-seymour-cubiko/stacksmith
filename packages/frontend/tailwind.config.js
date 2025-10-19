/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Everforest Dark color palette
        'everforest': {
          bg0: '#323d43',
          bg1: '#323c41',
          bg2: '#3a454a',
          bg3: '#445055',
          bg4: '#4d5960',
          bg5: '#555f66',
          'bg-visual': '#503946',
          'bg-red': 'rgba(230, 126, 128, 0.10)',
          'bg-yellow': '#4d4c43',
          'bg-green': 'rgba(167, 192, 128, 0.10)',
          'bg-blue': '#3a515d',
          fg: '#d3c6aa',
          red: '#e68183',
          orange: '#e69875',
          yellow: '#d9bb80',
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
