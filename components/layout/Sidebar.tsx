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
    { href: "/dashboard", icon: FiGrid, label: "대시보드" },
    { 
      href: "/management", 
      icon: FiUsers, 
      label: isSuperAdmin ? "학원/학생 관리" : "수업/학생 관리" 
    },
    { 
      href: "/assignments", 
      icon: FiBookOpen, 
      label: isSuperAdmin ? "과제 관리" : "수업 과제 관리" 
    },
    { href: "/assignment-status", icon: FiCheckSquare, label: "과제 현황" },
    // 결과 대시보드(결과 목록) 메뉴 추가
    { href: "/submissions", icon: FiGrid, label: "결과 목록" },
  ];

  return (
    <div className="w-64 bg-white text-slate-800 flex flex-col border-r border-slate-200 shrink-0">
      <div className="p-4 border-b border-slate-200 flex items-center space-x-3 h-20">
        <img src="/logo.png" alt="RuleMakers Logo" className="h-10 w-10 rounded-lg object-cover" />
        <div>
          <h2 className="text-xl font-bold font-lexend text-slate-900">RuleMakers</h2>
          <span className="text-sm text-slate-500">
            {isSuperAdmin ? '통합 관리자' : '학원 관리자'}
          </span>
        </div>
      </div>
      <nav className="flex-grow p-2">
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href}
            className={`flex items-center space-x-3 py-3 px-4 rounded-lg transition-colors duration-200 text-sm font-medium ${
              pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))
                ? "bg-primary-light text-primary font-semibold"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <link.icon className="w-5 h-5" />
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-200">
        <p className="text-sm font-semibold truncate text-slate-700" title={user?.academyName || user?.name || '관리자'}>
          {user?.academyName || user?.name || '관리자'}
        </p>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full mt-2 btn btn-danger"
        >
          <FiLogOut/>
          <span>로그아웃</span>
        </button>
      </div>
    </div>
  );
}

