// /components/layout/Sidebar.tsx
'use client';

import { Session } from "next-auth";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiGrid, FiUsers, FiBookOpen, FiCheckSquare, FiLogOut } from "react-icons/fi";

interface SidebarProps {
  session: Session;
}

export default function Sidebar({ session }: SidebarProps) {
  const pathname = usePathname();
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

  return (
    <div className="w-64 bg-white text-slate-700 flex flex-col border-r border-slate-200 shadow-md"> {/* 그림자 추가 */}
      <div className="p-5 border-b border-slate-200 flex items-center space-x-3"> {/* 패딩 조정 */}
        <img src="/logo.png" alt="RuleMakers Logo" className="h-10 w-10 rounded-lg object-cover" />
        <div>
          <h2 className="text-xl font-bold font-lexend text-slate-800">RuleMakers</h2>
          <span className="text-sm text-slate-500">
            {isSuperAdmin ? '통합 관리자' : '학원 관리자'}
          </span>
        </div>
      </div>
      <nav className="flex-grow p-3 space-y-1"> {/* 패딩 및 간격 조정 */}
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href}
            className={`flex items-center space-x-3 py-2.5 px-4 rounded-lg transition-colors duration-200 ${
              pathname.startsWith(link.href)
                ? "bg-blue-600 text-white font-semibold shadow-sm" // 활성 링크 디자인 강화
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <link.icon className="w-5 h-5" />
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-5 border-t border-slate-200"> {/* 패딩 조정 */}
        <p className="text-sm truncate text-slate-600 mb-2" title={isSuperAdmin ? user?.name || '관리자' : user?.academyName || '관리자'}>
          {isSuperAdmin ? user?.name || '관리자' : user?.academyName || '관리자'}
        </p>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full btn-danger" // 전역 스타일 사용
        >
          <FiLogOut className="w-4 h-4 mr-2" />
          <span>로그아웃</span>
        </button>
      </div>
    </div>
  );
}