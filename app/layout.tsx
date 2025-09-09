// /app/layout.tsx
import type { Metadata } from "next";
import { Inter, Lexend } from "next/font/google";
import "./globals.css";
import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]/route";
import Sidebar from "@/components/layout/Sidebar";
import AuthProvider from "@/components/AuthProvider";

const inter = Inter({ subsets: ["latin"], display: 'swap', variable: "--font-inter" });
const lexend = Lexend({ subsets: ["latin"], display: 'swap', variable: "--font-lexend" });

export const metadata: Metadata = {
  title: "RuleMakers 관리자 시스템",
  description: "RuleMakers 통합 및 학원 관리자 대시보드",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="ko">
      <body className={`${inter.variable} ${lexend.variable} font-sans`}>
        <AuthProvider>
          <div className="flex h-screen bg-slate-50">
            {session && <Sidebar session={session} />}
            <main className="flex-1 flex flex-col overflow-hidden">
              {children}
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}

