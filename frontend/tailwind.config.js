/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        segoe: ['"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: '#0000BF',
        secondary: '#00B4D8',
        ocean: '#03045E',
        warning: '#FFD166',
        danger: '#EF476F',
        neutralBg: '#F9F9F9',
      },
    },
  },
  plugins: [],
}
