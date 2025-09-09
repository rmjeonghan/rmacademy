import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Noto Sans KR', 'sans-serif'],
        lexend: ['var(--font-lexend)', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#78AAD4',
          hover: '#5d91b9',
          light: '#eef6fc',
        },
      },
    },
  },
  plugins: [],
};
export default config;
