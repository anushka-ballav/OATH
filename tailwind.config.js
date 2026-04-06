/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b1220',
        paper: '#ffffff',
        sand: '#dbeafe',
        clay: '#2563eb',
        moss: '#1d4ed8',
        ember: '#3b82f6',
        teal: '#60a5fa',
      },
      boxShadow: {
        card: '0 20px 45px rgba(15, 23, 42, 0.12)',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
