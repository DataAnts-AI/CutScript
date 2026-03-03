/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        editor: {
          bg: '#0f1117',
          surface: '#1a1d27',
          border: '#2a2d3a',
          accent: '#6366f1',
          'accent-hover': '#818cf8',
          text: '#e2e8f0',
          'text-muted': '#94a3b8',
          danger: '#ef4444',
          success: '#22c55e',
          warning: '#f59e0b',
          'word-hover': 'rgba(99, 102, 241, 0.15)',
          'word-selected': 'rgba(99, 102, 241, 0.3)',
          'word-deleted': 'rgba(239, 68, 68, 0.2)',
          'word-filler': 'rgba(245, 158, 11, 0.25)',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
