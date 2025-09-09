// /app/login/page.tsx
'use client';

import { signIn } from 'next-auth/react';
import { FcGoogle } from 'react-icons/fc';

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center p-10 bg-white rounded-2xl shadow-xl max-w-sm w-full">
        <img
          src="/logo_with_text.png" // public 폴더에 로고 이미지 필요
          alt="RuleMakers Logo"
          className="mx-auto mb-8 h-20"
        />
        <h1 className="text-2xl font-bold font-lexend text-slate-800">
          관리자 시스템 로그인
        </h1>
        <p className="text-slate-600 mb-8 mt-2">
          관리자 계정으로 로그인해주세요.
        </p>
        <button
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg shadow-sm flex items-center justify-center text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <FcGoogle className="w-6 h-6 mr-3" />
          <span>Google 계정으로 로그인</span>
        </button>
      </div>
    </div>
  );
}

