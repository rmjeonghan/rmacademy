// /app/api/auth/[...nextauth]/route.ts
import NextAuth, { NextAuthOptions, User } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/lib/firebase"; // Firebase 초기화 인스턴스
import { collection, query, where, getDocs, DocumentData } from "firebase/firestore";

// Academy 타입 정의
interface Academy extends DocumentData {
  id: string;
  name: string;
  adminEmail: string;
}

// NextAuth 설정
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    // 1. 로그인 시도 시 권한 확인
    async signIn({ user }) {
      if (!user.email) return false;

      // 통합 관리자(@rulemakers.co.kr)는 항상 허용
      if (user.email.endsWith('@rulemakers.co.kr')) {
        return true;
      }

      // 학원 관리자로 등록된 이메일인지 확인
      const academiesRef = collection(db, "academies");
      const q = query(academiesRef, where("adminEmail", "==", user.email), where("isDeleted", "==", false));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        return true; // 등록된 학원 관리자 허용
      }

      // 권한 없으면 로그인 페이지로 리디렉션
      return '/login?error=PermissionDenied'; 
    },

    // 2. JWT 토큰에 역할 및 학원 정보 주입
    async jwt({ token, user }) {
      if (user?.email) {
        if (user.email.endsWith('@rulemakers.co.kr')) {
          token.role = 'superadmin';
        } else {
          const academiesRef = collection(db, "academies");
          const q = query(academiesRef, where("adminEmail", "==", user.email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const academyDoc = querySnapshot.docs[0];
            token.role = 'academyadmin';
            token.academyId = academyDoc.id;
            token.academyName = academyDoc.data().name; // 학원 이름 주입
          }
        }
      }
      return token;
    },

    // 3. 클라이언트 세션 객체에 최종 정보 전달
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as "superadmin" | "academyadmin";
        session.user.academyId = token.academyId as string;
        session.user.academyName = token.academyName as string; // 학원 이름 전달
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };