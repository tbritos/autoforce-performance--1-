/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './**/*.{ts,tsx}',
    '!./node_modules/**',
    '!./backend/**',
  ],
  theme: {
    extend: {
      colors: {
        autoforce: {
          blue: '#1440FF',
          darkBlue: '#001A91',
          darkest: '#000D3D',
          dark: '#00061A',
          sidebar: '#00040F',
          secondary: '#0027D4',
          grey: '#4E5265',
          lightGrey: '#C7CDE9',
          accent: '#FFA814',
          yellow: '#FFC414',
          black: '#00020A',
          success: '#00C851',
          danger: '#ff4444',
        },
      },
      fontFamily: {
        sans: ['Poppins', '"Titillium Web"', 'sans-serif'],
        display: ['Poppins', '"Manrope"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        'fade-in-down': 'fadeInDown 0.5s ease-out forwards',
        'fade-in-right': 'fadeInRight 0.5s ease-out forwards',
        'fade-in': 'fadeIn 0.25s ease-out forwards',
        'fade-out': 'fadeOut 0.25s ease-in forwards',
        'slide-in-right': 'slideInRight 0.35s ease-out forwards',
        'slide-out-right': 'slideOutRight 0.25s ease-in forwards',
        'shake': 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideOutRight: {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(16px)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInRight: {
          '0%': { opacity: '0', transform: 'translateX(10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shake: {
          '10%, 90%': { transform: 'translate3d(-1px, 0, 0)' },
          '20%, 80%': { transform: 'translate3d(2px, 0, 0)' },
          '30%, 50%, 70%': { transform: 'translate3d(-4px, 0, 0)' },
          '40%, 60%': { transform: 'translate3d(4px, 0, 0)' },
        },
      },
    },
  },
  plugins: [],
};
