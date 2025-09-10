// app/page.tsx
'use client'; // 👈 클라이언트 컴포넌트로 변경

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext'; // 👈 next-auth 대신 useAuth 훅을 사용
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 로딩이 끝났는데 유저 정보가 없다면 로그인 페이지로 보냅니다.
    if (!loading && !user) {
      router.push('/login');
    }
    // 유저 정보가 있다면 대시보드 페이지로 보냅니다.
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // 인증 상태를 확인하는 동안 로딩 화면을 보여줍니다.
  return <LoadingSpinner />;
}