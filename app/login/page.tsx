// /app/login/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { FcGoogle } from 'react-icons/fc';
import Image from "next/image";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard'); // 로그인 후 대시보드로 이동
    }
  }, [user, loading, router]);

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google Sign-In Error", error);
      alert("로그인 중 오류가 발생했습니다.");
    }
  };

  if (loading || user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center p-10 bg-white rounded-2xl shadow-xl max-w-sm w-full">
        <Image
          src="/rmlogo.png"
          alt="RuleMakers Logo"
          width={100}
          height={100}
          className="mx-auto mb-8"
          priority
        />
        <h1 className="text-2xl font-bold font-lexend text-slate-800">
          관리자 시스템 로그인
        </h1>
        <p className="text-slate-600 mb-8 mt-2">
          등록된 관리자 계정으로 로그인해주세요.
        </p>
        <button
          onClick={handleGoogleSignIn}
          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg shadow-sm flex items-center justify-center text-base font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <FcGoogle className="mr-3 text-2xl" />
          Google 계정으로 로그인
        </button>
      </div>
    </div>
  );
}