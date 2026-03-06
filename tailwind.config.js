/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif']
      },
      colors: {
        sidebar: {
          bg: '#1a1a2e',
          hover: '#16213e',
          active: '#0f3460',
          text: '#a8b2d8',
          heading: '#ccd6f6'
        }
      }
    }
  },
  plugins: []
}
