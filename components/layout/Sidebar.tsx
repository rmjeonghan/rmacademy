// /components/layout/Sidebar.tsx (최종 수정 버전 - 메뉴 단순화 및 문의 버튼 추가)
'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { FiGrid, FiUsers, FiBookOpen, FiCheckSquare, FiLogOut } from 'react-icons/fi';
import { auth } from '@/lib/firebase';
import { CustomUser } from '@/context/AuthContext';

interface SidebarProps {
  session: {
    user: CustomUser | null;
  };
}

export default function Sidebar({ session }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = session;
  const isSuperAdmin = user?.role === 'superadmin';

  const navLinks = [
    { href: "/dashboard", icon: FiGrid, label: "결과 대시보드" },
    { 
      href: "/management", 
      icon: FiUsers, 
      label: isSuperAdmin ? "학원/학생 관리" : "수업/학생 관리" 
    },
    { 
      href: "/assignments", 
      icon: FiBookOpen, 
      label: isSuperAdmin ? "학원 과제 관리" : "수업 과제 관리" 
    },
    { href: "/assignment-status", icon: FiCheckSquare, label: "과제 현황" },
  ];

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/login');
  };

  return (
    <aside className="bg-white w-64 min-h-screen flex flex-col border-r border-slate-200">
      <div className="p-5 border-b border-slate-200 flex items-center space-x-3">
        <img src="/favicon.ico" alt="RuleMakers Logo" className="h-10 w-10 rounded-lg object-cover" />
        <div>
          <h2 className="text-xl font-bold font-lexend text-slate-800">RuleMakers</h2>
          <span className="text-sm text-slate-500">
            {isSuperAdmin ? '통합 관리자' : '학원 관리자'}
          </span>
        </div>
      </div>
      <nav className="flex-grow p-3 space-y-1">
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href}
            className={`flex items-center space-x-3 py-2.5 px-4 rounded-lg transition-colors duration-200 ${
              pathname.startsWith(link.href)
                ? "bg-blue-600 text-white font-semibold shadow-sm"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <link.icon className="w-5 h-5" />
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
      
      {/* ▼▼▼▼▼ 수정된 부분 시작 ▼▼▼▼▼ */}
      {/* 로그아웃과 문의하기 버튼을 flex-col로 묶어 하단에 고정 */}
      <div className="mt-auto"> 
        <div className="p-5 border-t border-slate-200">
          <p className="text-sm truncate text-slate-600 mb-2" title={isSuperAdmin ? user?.displayName || '관리자' : user?.academyName || '학원 관리자'}>
            {isSuperAdmin ? user?.displayName || '관리자님' : user?.academyName || '학원 관리자님'}
          </p>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 text-sm font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors duration-200"
          >
            <FiLogOut className="w-4 h-4" />
            <span>로그아웃</span>
          </button>
        </div>

        {/* 카카오톡 채널 문의 버튼 */}
        <div className="p-3 border-t border-slate-200">
          <a 
              href="https://pf.kakao.com/_kbcxan/chat" // 👈 여기에 카카오 채널 링크를 입력하세요.
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center space-x-3 py-2.5 px-4 rounded-lg transition-colors duration-200 text-slate-700 hover:bg-slate-100"
          >
              <img 
                  src="data:image/png;base64,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" // 👈 여기에 아이콘 Base64 데이터를 입력하세요.
                  alt="카카오톡 채널 문의"
                  className="w-5 h-5"
              />
              <span>문의하기</span>
          </a>
        </div>
      </div>
      {/* ▲▲▲▲▲ 수정된 부분 끝 ▲▲▲▲▲ */}

    </aside> // ✅ 이 태그의 안쪽으로 모든 요소가 위치해야 합니다.
  );
}