import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#172033',
        navy: '#101929',
        cobalt: '#4963e8',
        canvas: '#f5f6f8',
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'sans-serif'],
        display: ['var(--font-manrope)', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 12px 35px rgba(18, 29, 46, 0.08)',
      },
    },
  },
  plugins: [],
} satisfies Config;
