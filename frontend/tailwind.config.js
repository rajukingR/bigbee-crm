/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#ff4400', 600: '#e63d00', 50: '#fff1eb', 100: '#ffe0d1' },
        accent: '#f97316',
        sidebar: '#0f172a',
        ink: '#020817',
        line: '#e2e8f0',
        page: '#fafafa',
      },
      fontFamily: {
        sans: ['Outfit', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: { card: '0 1px 2px rgba(15, 23, 42, 0.04)' },
    },
  },
  plugins: [],
};
