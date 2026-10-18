/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        dev: {
          bg: {
            dark: '#0b0d13',
            DEFAULT: '#0f1219',
            card: '#141824',
            light: '#f8fafc',
            lightCard: '#ffffff',
          },
          sidebar: {
            dark: '#0f121a',
            DEFAULT: '#11141d',
            border: '#1c2230',
            light: '#f1f5f9',
            lightBorder: '#e2e8f0',
          },
          border: {
            dark: '#1e2535',
            light: '#e2e8f0',
          },
          accent: {
            DEFAULT: '#6366f1', // Indigo
            hover: '#4f46e5',
            subtle: 'rgba(99, 102, 241, 0.12)',
            cyan: '#06b6d4',
            emerald: '#10b981',
            amber: '#f59e0b',
            rose: '#f43f5e',
          }
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          '"Fira Code"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
}
