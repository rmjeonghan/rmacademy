// /app/submissions/page.tsx (최종 수정 버전)
'use client';

import { useState, useEffect, useCallback } from "react";
import { collection, query, where, onSnapshot, doc, getDocs, updateDoc, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Submission, Student, Academy, Question } from "@/types";
import { FiFilter, FiEye, FiEyeOff } from "react-icons/fi";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import DetailsModal from "@/components/ui/DetailsModal";
import Card from "@/components/ui/Card";
import { useAuth } from "@/context/AuthContext";

export default function SubmissionsPage() {
    const { user, loading: authLoading } = useAuth();
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [students, setStudents] = useState<Record<string, Student>>({});
    const [academies, setAcademies] = useState<Academy[]>([]);
    const [questions, setQuestions] = useState<Record<string, Question>>({});
    
    const [filteredSubmissions, setFilteredSubmissions] = useState<Submission[]>([]);
    const [selectedAcademy, setSelectedAcademy] = useState('all');
    const [showDeleted, setShowDeleted] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);
    
    const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

    const fetchStudentsAndAcademies = useCallback(async () => {
        if (!user) return;
        setDataLoading(true);

        try {
            const studentSnapshot = await getDocs(collection(db, "students"));
            const studentData: Record<string, Student> = {};
            studentSnapshot.forEach(doc => studentData[doc.id] = { id: doc.id, ...doc.data() } as Student);
            setStudents(studentData);

            if (user.role === 'superadmin') {
                const academySnapshot = await getDocs(query(collection(db, "academies"), where("isDeleted", "==", false)));
                setAcademies(academySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Academy)));
            }
        } catch (error) {
            console.error("학생/학원 정보 로딩 오류:", error);
        } finally {
            setDataLoading(false);
        }
    }, [user]);
    
    useEffect(() => {
        if (!authLoading && user) {
            fetchStudentsAndAcademies();

            let submissionsQuery;
            if (user.role === 'academyadmin' && user.academyId) {
                submissionsQuery = query(collection(db, "submissions"), where("academyId", "==", user.academyId), orderBy("createdAt", "desc"));
            } else {
                submissionsQuery = query(collection(db, "submissions"), orderBy("createdAt", "desc"));
            }

            const unsubscribe = onSnapshot(submissionsQuery, (snapshot) => {
                const submissionData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
                setSubmissions(submissionData);
            });
            
            return () => unsubscribe();
        }
    }, [user, authLoading, fetchStudentsAndAcademies]);

    useEffect(() => {
        let result = submissions;
        if (user?.role === 'superadmin' && selectedAcademy !== 'all') {
            const studentIdsInAcademy = Object.values(students)
                .filter(s => s.academyId === selectedAcademy)
                .map(s => s.id);
            result = result.filter(sub => studentIdsInAcademy.includes(sub.userId));
        }
        if (!showDeleted) {
            result = result.filter(sub => !sub.isDeleted);
        }
        setFilteredSubmissions(result);
    }, [submissions, selectedAcademy, showDeleted, students, user]);

    const handleShowDetails = async (submission: Submission) => {
        const neededQIds = submission.questionIds.filter(id => !questions[id]);
        if (neededQIds.length > 0) {
            const chunks = [];
            for (let i = 0; i < neededQIds.length; i += 30) {
                chunks.push(neededQIds.slice(i, i + 30));
            }
            const newQuestions: Record<string, Question> = {};
            for (const chunk of chunks) {
                const q = query(collection(db, "questionBank"), where("__name__", "in", chunk));
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => newQuestions[doc.id] = { id: doc.id, ...doc.data() } as Question);
            }
            setQuestions(prev => ({ ...prev, ...newQuestions }));
        }
        setSelectedSubmission(submission);
    };

    const toggleDeleteStatus = async (id: string, currentStatus: boolean) => {
        await updateDoc(doc(db, "submissions", id), { isDeleted: !currentStatus });
    };
    
    if (authLoading || dataLoading) {
        return <LoadingSpinner />;
    }

    return (
        <div className="p-8 h-full overflow-y-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold font-lexend text-slate-800">전체 결과 보기</h1>
                <p className="mt-2 text-md text-slate-500">학생들의 전체 제출 기록을 확인합니다.</p>
            </header>

            <Card>
                <div className="p-4 flex justify-between items-center border-b border-slate-200">
                    <div className="flex items-center gap-4">
                        {user?.role === 'superadmin' && (
                            <div className="flex items-center gap-2">
                                <FiFilter className="text-slate-500" />
                                <select value={selectedAcademy} onChange={(e) => setSelectedAcademy(e.target.value)} className="form-select text-sm">
                                    <option value="all">전체 학원</option>
                                    {academies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                    <button onClick={() => setShowDeleted(!showDeleted)} className="btn-secondary text-sm">
                        {showDeleted ? <FiEyeOff className="inline mr-2"/> : <FiEye className="inline mr-2"/>}
                        {showDeleted ? "숨김 기록 숨기기" : "숨김 기록 보기"}
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="table-header">제출일시</th>
                                <th className="table-header">학습 정보</th>
                                {user?.role === 'superadmin' && <th className="table-header">학원</th>}
                                <th className="table-header">학생</th>
                                <th className="table-header">점수</th>
                                <th className="table-header">관리</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {filteredSubmissions.length > 0 ? filteredSubmissions.map(sub => {
                                const student = students[sub.userId];
                                const studentAcademy = academies.find(a => a.id === student?.academyId);
                                return (
                                <tr key={sub.id} onClick={() => handleShowDetails(sub)} className={`cursor-pointer hover:bg-slate-50 ${sub.isDeleted ? 'bg-gray-100 text-gray-400' : ''}`}>
                                    <td className="table-cell">{new Date(sub.createdAt.toMillis()).toLocaleString('ko-KR')}</td>
                                    <td className="table-cell">{sub.mainChapter} ({sub.assignmentId ? '과제' : '자율학습'})</td>
                                    {user?.role === 'superadmin' && <td className="table-cell">{studentAcademy?.name || '개인'}</td>}
                                    <td className="table-cell font-medium text-slate-800">{student?.studentName || '알 수 없음'}</td>
                                    <td className="table-cell"><span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">{sub.score}점</span></td>
                                    <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                                        <button onClick={() => toggleDeleteStatus(sub.id, sub.isDeleted)} className={`text-xs font-semibold rounded-full px-3 py-1 ${sub.isDeleted ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {sub.isDeleted ? '복구' : '숨김'}
                                        </button>
                                    </td>
                                </tr>
                            )}) : (
                              <tr><td colSpan={user?.role === 'superadmin' ? 6 : 5} className="text-center py-16 text-slate-500">표시할 데이터가 없습니다.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {selectedSubmission && <DetailsModal submission={selectedSubmission} student={students[selectedSubmission.userId]} questions={questions} onClose={() => setSelectedSubmission(null)} />}
        </div>
    );
}
