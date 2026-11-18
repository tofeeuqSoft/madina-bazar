/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand green — anchored on logo: 700 #0E4430, 800 #0B3D2A, 600 #1B5E3D (hover)
        primary: {
          50: '#f2f7f4',
          100: '#e0ede5',
          200: '#c2dccb',
          300: '#94c2a8',
          400: '#62a181',
          500: '#3f8264',
          600: '#1b5e3d',
          700: '#0e4430',
          800: '#0b3d2a',
          900: '#07271b',
          950: '#04150e',
        },
        // Brand gold — anchored on logo: 400 #DBAA5A, 500 #D9A857
        gold: {
          50: '#fbf7ec',
          100: '#f6ecd4',
          200: '#ecd6a3',
          300: '#e2bc70',
          400: '#dbaa5a',
          500: '#d9a857',
          600: '#b9863c',
          700: '#96692f',
          800: '#7a552b',
          900: '#655028',
        },
        secondary: {
          500: '#dbaa5a',
          600: '#b9863c',
        },
        // Palette status colors (both modes)
        success: '#4caf7d',
        danger: '#e05c5c',
        // Palette surfaces & text
        night: '#0a0f0c', // dark bg primary
        coal: '#12241a', // dark bg secondary / cards
        line: '#2a3b30', // dark border/divider
        cream: '#f7f5f0', // light bg secondary
        sand: '#e5e2da', // light border/divider
        parchment: '#f5f1e8', // dark text primary
        ash: '#a8a296', // dark text muted
        ink: '#1a1a1a', // light text primary
        smoke: '#6b6b6b', // light text secondary
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Bengali', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 4px 20px rgba(14, 68, 48, 0.08)',
        gold: '0 4px 14px rgba(219, 170, 90, 0.3)',
      },
    },
  },
  plugins: [],
};
