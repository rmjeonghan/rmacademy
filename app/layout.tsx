// /app/layout.tsx
import './globals.css';
import { Noto_Sans_KR, Lexend } from 'next/font/google';
import AuthProvider from '@/components/AuthProvider';
import Sidebar from '@/components/layout/Sidebar';
import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]/route';

// 폰트 설정
const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans-kr', // CSS 변수 이름 지정
  display: 'swap',
});

const lexend = Lexend({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-lexend', // CSS 변수 이름 지정
  display: 'swap',
});

export const metadata = {
  title: 'RuleMakers Admin',
  description: 'RuleMakers 통합/학원 관리 시스템',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    // <html> 태그에 폰트 변수를 적용합니다.
    <html lang="ko" className={`${notoSansKR.variable} ${lexend.variable}`}>
      <body>
        <AuthProvider>
          {session ? (
            <div className="flex h-screen bg-gray-50">
              <Sidebar session={session} />
              <main className="flex-1 overflow-y-auto">
                {children}
              </main>
            </div>
          ) : (
            children
          )}
        </AuthProvider>
      </body>
    </html>
  );
}