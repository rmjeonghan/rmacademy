// tailwind.config.ts

import type { Config } from 'tailwindcss'

const config: Config = {
  // 이 부분을 추가하거나 수정해주세요.
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-noto-sans-kr)', 'sans-serif'],
        lexend: ['var(--font-lexend)', 'sans-serif'],
      },
      colors: {
        primary: {
          light: '#eef6fc',
          DEFAULT: '#3b82f6',
          dark: '#2563eb',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}

export default config