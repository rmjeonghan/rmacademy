// /components/layout/PageWrapper.tsx
'use client';

import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import LoadingSpinner from '@/components/ui/LoadingSpinner'; // 로딩 컴포넌트 경로는 실제에 맞게 확인해주세요.

export default function PageWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // 로딩이 끝났는데 유저가 없고, 현재 페이지가 로그인 페이지가 아니라면 로그인 페이지로 보냅니다.
    if (!loading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, loading, pathname, router]);

  // 인증 상태를 확인하는 동안 로딩 화면을 보여줍니다.
  if (loading) {
    return <LoadingSpinner />;
  }

  // 유저가 있다면, 기존처럼 사이드바와 함께 메인 레이아웃을 보여줍니다.
  if (user) {
    // Sidebar가 session={{ user: {...} }} 형태의 prop을 기대하므로, 맞춰서 전달합니다.
    const session = { user }; 
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar session={session} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    );
  }

  // 유저가 없고 현재 페이지가 로그인 페이지라면, 로그인 페이지만 보여줍니다.
  if (!user && pathname === '/login') {
    return <>{children}</>;
  }

  // 리디렉션이 일어나는 동안 잠시 보여줄 로딩 화면
  return <LoadingSpinner />;
}