import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#6C5CE7',
          secondary: '#a29bfe',
          mint: '#00B894',
          blue: '#0984E3',
          orange: '#e17055',
        },
      },
      fontFamily: {
        sans: ['Pretendard', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
} satisfies Config

