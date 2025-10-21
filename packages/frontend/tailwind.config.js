/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Everforest Dark color palette (adjusted for better contrast)
        'everforest': {
          bg0: '#0f1215',
          bg1: '#151a1d',
          bg2: '#1d2226',
          bg3: '#282e32',
          bg4: '#323a3e',
          bg5: '#3c4548',
          'bg-visual': '#503946',
          'bg-red': 'rgba(230, 126, 128, 0.10)',
          'bg-yellow': '#4d4c43',
          'bg-green': 'rgba(167, 192, 128, 0.10)',
          'bg-blue': '#3a515d',
          fg: '#f8f0df',
          red: '#f9b1b3',
          orange: '#f7c9a9',
          yellow: '#f3e5b7',
          green: '#cce3b7',
          aqua: '#afe4c3',
          blue: '#b0deda',
          purple: '#f4cce6',
          grey0: '#b2c2b9',
          grey1: '#c0cdc4',
          grey2: '#d0dcd3',
          'statusline1': '#cce3b7',
          'statusline2': '#f8f0df',
          'statusline3': '#f9b1b3',
        }
      },
    },
  },
  plugins: [],
}
