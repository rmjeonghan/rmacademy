// /app/dashboard/page.tsx
'use client';

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, limit, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Academy, Student, Submission } from "@/types";
import Card from "@/components/ui/Card";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { FiUsers, FiClock, FiCheckCircle } from 'react-icons/fi';

export default function DashboardPage() {
    const { data: session } = useSession();
    const [stats, setStats] = useState({ academies: 0, students: 0, pending: 0 });
    const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
    const [studentsMap, setStudentsMap] = useState<Record<string, Student>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!session) return;
        setLoading(true);
        const { role, academyId } = session.user;

        // 학생 정보 전체 로드 (이름 매핑용)
        const unsubStudentsMap = onSnapshot(collection(db, "students"), (snapshot) => {
            const map: Record<string, Student> = {};
            snapshot.forEach(doc => map[doc.id] = { id: doc.id, ...doc.data() } as Student);
            setStudentsMap(map);
        });

        // 통계 데이터
        if (role === 'superadmin') {
            const unsubAcademies = onSnapshot(collection(db, "academies"), snap => {
                setStats(prev => ({ ...prev, academies: snap.docs.filter(d => !d.data().isDeleted).length }));
            });
            const unsubStudents = onSnapshot(collection(db, "students"), snap => {
                setStats(prev => ({ ...prev, students: snap.docs.filter(d => !d.data().isDeleted).length, pending: snap.docs.filter(s => s.data().status === 'pending').length }));
            });
            return () => { unsubAcademies(); unsubStudents(); unsubStudentsMap(); }
        } else { // 학원 관리자
             const studentQuery = query(collection(db, "students"), where("academyId", "==", academyId!));
             const unsubStudents = onSnapshot(studentQuery, snap => {
                setStats({ academies: 1, students: snap.docs.filter(d => !d.data().isDeleted).length, pending: snap.docs.filter(s => s.data().status === 'pending').length });
            });
            return () => { unsubStudents(); unsubStudentsMap(); }
        }
    }, [session]);
    
    // 최근 제출 결과
    useEffect(() => {
        if(!session) return;
        const { role, academyId } = session.user;
        const q = role === 'superadmin' 
            ? query(collection(db, "submissions"), orderBy("createdAt", "desc"), limit(5))
            : query(collection(db, "submissions"), where("academyId", "==", academyId!), orderBy("createdAt", "desc"), limit(5));
        
        const unsub = onSnapshot(q, (snap) => {
            setRecentSubmissions(snap.docs.map(d => ({id: d.id, ...d.data()} as Submission)));
            setLoading(false);
        });
        return () => unsub();
    }, [session]);

    if (loading) return <LoadingSpinner />;
    
    return (
        <div className="p-8 overflow-y-auto h-full">
            <header className="mb-8">
                <h1 className="text-3xl font-bold font-lexend text-slate-800">대시보드</h1>
                <p className="mt-2 text-md text-slate-500">{session?.user.academyName || 'RuleMakers'} 현황 요약</p>
            </header>

            {/* 통계 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {session?.user.role === 'superadmin' && (
                    <Card title="총 학원 수" className="bg-blue-50">
                        <div className="flex items-center text-3xl font-bold text-blue-600">
                            <FiUsers className="mr-4"/> {stats.academies}
                        </div>
                    </Card>
                )}
                 <Card title="총 학생 수" className="bg-green-50">
                    <div className="flex items-center text-3xl font-bold text-green-600">
                        <FiCheckCircle className="mr-4"/> {stats.students}
                    </div>
                </Card>
                 <Card title="승인 대기 학생" className="bg-yellow-50">
                    <div className="flex items-center text-3xl font-bold text-yellow-600">
                        <FiClock className="mr-4"/> {stats.pending}
                    </div>
                </Card>
            </div>

            {/* 최근 제출 결과 */}
            <Card title="최근 제출 결과" description="가장 최근에 제출된 5개의 학습 결과입니다.">
                 <div className="divide-y divide-slate-100">
                    {recentSubmissions.length > 0 ? recentSubmissions.map(sub => (
                        <div key={sub.id} className="p-3 flex justify-between items-center">
                            <div>
                                <p className="font-semibold">{studentsMap[sub.userId]?.studentName || '알 수 없는 학생'}</p>
                                <p className="text-sm text-slate-500">{sub.mainChapter} ({sub.assignmentId ? '과제' : '자율학습'})</p>
                            </div>
                             <div className="text-right">
                                <span className="px-2.5 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">{sub.score}점</span>
                                <p className="text-xs text-slate-400 mt-1">{new Date(sub.createdAt.toDate()).toLocaleString('ko-KR')}</p>
                            </div>
                        </div>
                    )) : <p className="text-center py-8 text-slate-500">최근 제출된 결과가 없습니다.</p>}
                 </div>
            </Card>
        </div>
    );
}

