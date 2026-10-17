/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"Atkinson Hyperlegible"', 'system-ui', 'sans-serif'],
      },
      colors: {
        paper: '#F3F7F7',
        ink: '#12252E',
        soft: '#4B6069',
        line: '#D5E0E2',
        brand: { DEFAULT: '#0B6F6A', dark: '#095955', tint: '#E1F1EF' },
        sev: { critical: '#B3261E', high: '#B34F0A', medium: '#7A5C00', low: '#2F6489' },
        tint: { critical: '#FBEAE9', high: '#FCEEE2', medium: '#F8F0D8', low: '#E6EFF6' },
        bar: { critical: '#C8372D', high: '#E8762B', medium: '#E0B02A', low: '#5B93B8' },
      },
    },
  },
  plugins: [],
};
