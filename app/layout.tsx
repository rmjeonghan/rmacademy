// /app/layout.tsx
import './globals.css';
import { Noto_Sans_KR, Lexend } from 'next/font/google';
import { AuthProvider } from '@/context/AuthContext'; // 👈 1. AuthProvider 경로를 context 폴더로 변경
import PageWrapper from '@/components/layout/PageWrapper'; // 👈 2. 새로 만들 PageWrapper import

// 폰트 설정 (기존과 동일)
const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans-kr',
  display: 'swap',
});

const lexend = Lexend({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-lexend',
  display: 'swap',
});

export const metadata = {
  title: 'RuleMakers Admin',
  description: 'RuleMakers 통합/학원 관리 시스템',
};

// ❗ async 키워드 제거, session 관련 코드 제거
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={`${notoSansKR.variable} ${lexend.variable}`}>
      <body>
        <AuthProvider>
          {/* 👈 3. PageWrapper가 레이아웃을 담당하도록 변경 */}
          <PageWrapper>
            {children}
          </PageWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}