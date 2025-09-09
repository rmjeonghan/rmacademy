// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  // content 배열은 Tailwind CSS v4에서 더 이상 필요하지 않습니다.
  theme: {
    extend: {
      fontFamily: {
        // next/font에서 생성된 CSS 변수를 사용하도록 설정합니다.
        sans: ['var(--font-noto-sans-kr)', 'sans-serif'],
        lexend: ['var(--font-lexend)', 'sans-serif'],
      },
      colors: {
        // 기존에 정의한 커스텀 색상을 그대로 사용합니다.
        primary: {
          light: '#eef6fc',
          DEFAULT: '#3b82f6', // 좀 더 선명한 파란색으로 조정
          dark: '#2563eb',
        },
      },
    },
  },
  plugins: [
    // Tailwind CSS v4에서는 플러그인을 이렇게 가져옵니다.
    require('@tailwindcss/forms'),
  ],
}

export default config