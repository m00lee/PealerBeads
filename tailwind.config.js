/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#1e1e2e',
          light: '#313244',
          lighter: '#45475a',
        },
        accent: {
          DEFAULT: '#89b4fa',
          hover: '#74c7ec',
          muted: '#585b70',
        },
        text: {
          DEFAULT: '#cdd6f4',
          muted: '#a6adc8',
          dim: '#6c7086',
        },
      },
    },
  },
  plugins: [],
};
