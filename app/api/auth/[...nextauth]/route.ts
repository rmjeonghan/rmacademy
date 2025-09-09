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
    // signIn 콜백: 로그인 시 역할(role) 부여 로직
    async signIn({ user }) {
      if (!user.email) return false;

      // 1. 통합 관리자(superadmin) 확인
      if (user.email.endsWith('@rulemakers.co.kr')) {
        return true; // 로그인 승인
      }

      // 2. 학원 관리자(academyadmin) 확인
      const academiesRef = collection(db, "academies");
      const q = query(academiesRef, where("adminEmail", "==", user.email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        return true; // 등록된 학원 관리자, 로그인 승인
      }

      // 3. 권한 없는 사용자 로그인 거부 시, 에러 메시지와 함께 리디렉션
      return '/login?error=PermissionDenied'; 
    },

    // jwt 콜백: JWT 토큰에 역할, 학원 정보 추가
    async jwt({ token, user }) {
      if (user?.email) {
        // 통합 관리자 역할 부여
        if (user.email.endsWith('@rulemakers.co.kr')) {
          token.role = 'superadmin';
        } else {
          // 학원 관리자 역할 및 정보 부여
          const academiesRef = collection(db, "academies");
          const q = query(academiesRef, where("adminEmail", "==", user.email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const academyDoc = querySnapshot.docs[0];
            const academyData = academyDoc.data() as Academy;
            token.role = 'academyadmin';
            token.academyId = academyDoc.id;
            token.academyName = academyData.name;
          }
        }
      }
      return token;
    },

    // session 콜백: 클라이언트 세션 객체에 역할, 학원 정보 추가
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as "superadmin" | "academyadmin";
        session.user.academyId = token.academyId as string;
        session.user.academyName = token.academyName as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login', // 커스텀 로그인 페이지
    error: '/login', // 에러 발생 시 리디렉션
  }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };