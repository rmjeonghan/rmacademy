// /components/layout/Sidebar.tsx (최종 수정 버전 - 메뉴 단순화)
'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { FiGrid, FiUsers, FiBookOpen, FiCheckSquare, FiLogOut } from 'react-icons/fi'; // 👈 FiFileText 아이콘 제거
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

  // 🔽 '전체 결과 보기' 메뉴를 제거하여 navLinks를 단순화했습니다. 🔽
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
  
  const handleSignOut = async () => {
    try {
      await auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Sign out error', error);
    }
  };

  return (
    <div className="w-64 bg-white text-slate-700 flex flex-col border-r border-slate-200 shadow-md">
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
      <div className="p-5 border-t border-slate-200">
        <p className="text-sm truncate text-slate-600 mb-2" title={isSuperAdmin ? user?.displayName || '관리자' : user?.academyName || '학원 관리자'}>
          {isSuperAdmin ? user?.displayName || '관리자' : user?.academyName || '학원 관리자'}
        </p>
        <button
          onClick={handleSignOut}
          className="w-full btn-danger"
        >
          <FiLogOut className="w-4 h-4 mr-2" />
          <span>로그아웃</span>
        </button>
      </div>
    </div>
  );
}

