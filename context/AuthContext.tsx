// context/AuthContext.tsx
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

// 세션에 추가할 사용자 정보 타입 정의
export interface CustomUser extends User {
  role?: 'superadmin' | 'academyadmin';
  academyId?: string;
  academyName?: string;
}

interface AuthContextType {
  user: CustomUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // 🔽 [수정된 부분] customUserData 변수가 null일 수도 있다고 타입을 변경했습니다.
        let customUserData: CustomUser | null = { ...firebaseUser };

        try {
          if (firebaseUser.email?.endsWith('@rulemakers.co.kr')) {
            customUserData.role = 'superadmin';
          } else {
            const academiesRef = collection(db, "academies");
            const q = query(
              academiesRef,
              where("adminEmail", "==", firebaseUser.email),
              where("isDeleted", "==", false)
            );
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
              const academyDoc = querySnapshot.docs[0];
              // customUserData가 null이 아님을 TypeScript에 확신시켜줍니다.
              if (customUserData) {
                customUserData.role = 'academyadmin';
                customUserData.academyId = academyDoc.id;
                customUserData.academyName = academyDoc.data().name;
              }
            } else {
              // 권한 없는 사용자 로그아웃 처리
              await auth.signOut();
              customUserData = null; // 👈 이제 이 코드는 에러를 발생시키지 않습니다.
            }
          }
        } catch (error) {
          console.error("Failed to fetch user role, signing out.", error);
          await auth.signOut();
          customUserData = null; // 👈 이 코드도 마찬가지입니다.
        }
        
        setUser(customUserData);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);