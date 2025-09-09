// /app/dashboard/page.tsx (개선된 버전)
'use client';

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Submission, Student, Academy, Question } from "@/types";
import { FiEye, FiEyeOff, FiFileText, FiRefreshCw } from "react-icons/fi"; 
import DetailsModal from "@/components/ui/DetailsModal"; // 공용 모달 컴포넌트 import
import LoadingSpinner from "@/components/ui/LoadingSpinner"; // 로딩 스피너 import

export default function DashboardPage() {
    const { data: session } = useSession();
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [students, setStudents] = useState<Record<string, Student>>({});
    const [academies, setAcademies] = useState<Academy[]>([]);
    const [questions, setQuestions] = useState<Record<string, Question>>({});
    
    // UI 상태
    const [filteredSubmissions, setFilteredSubmissions] = useState<Submission[]>([]);
    const [selectedAcademy, setSelectedAcademy] = useState('all');
    const [showDeleted, setShowDeleted] = useState(false);
    const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
    const [loading, setLoading] = useState(true);

    // 데이터 로딩 함수 (getDocs 사용)
    const fetchData = useCallback(async () => {
        if (!session) return;
        setLoading(true);

        try {
            // 학생 정보 로드
            const studentSnapshot = await getDocs(collection(db, "students"));
            const studentData: Record<string, Student> = {};
            studentSnapshot.forEach(doc => studentData[doc.id] = { id: doc.id, ...doc.data() } as Student);
            setStudents(studentData);

            // 학원 정보 로드 (SuperAdmin 전용)
            if (session.user.role === 'superadmin') {
                const academyQuery = query(collection(db, "academies"), where("isDeleted", "==", false));
                const academySnapshot = await getDocs(academyQuery);
                const academyData = academySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Academy));
                setAcademies(academyData);
            }
            
            // 제출 결과 로드
            let submissionsQuery;
            if (session.user.role === 'academyadmin' && session.user.academyId) {
                submissionsQuery = query(collection(db, "submissions"), where("academyId", "==", session.user.academyId));
            } else {
                submissionsQuery = query(collection(db, "submissions"));
            }
            const submissionSnapshot = await getDocs(submissionsQuery);
            const submissionData = submissionSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
            submissionData.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
            setSubmissions(submissionData);

        } catch (error) {
            console.error("데이터 로딩 중 오류 발생:", error);
            // 여기에 사용자에게 보여줄 에러 처리 로직을 추가할 수 있습니다.
        } finally {
            setLoading(false);
        }
    }, [session]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // 필터링 로직 (기존과 동일)
    useEffect(() => {
        let result = submissions;
        if (session?.user.role === 'superadmin' && selectedAcademy !== 'all') {
            const studentIdsInAcademy = Object.values(students)
                .filter(s => s.academyId === selectedAcademy)
                .map(s => s.id);
            result = result.filter(sub => studentIdsInAcademy.includes(sub.userId));
        }
        if (!showDeleted) {
            result = result.filter(sub => !sub.isDeleted);
        }
        setFilteredSubmissions(result);
    }, [submissions, selectedAcademy, showDeleted, students, session]);

    // 상세 보기 핸들러 (기존과 동일)
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
    
    // 숨김/복구 핸들러
    const toggleDeleteStatus = async (id: string, currentStatus: boolean) => {
        await updateDoc(doc(db, "submissions", id), { isDeleted: !currentStatus });
        // 상태를 수동으로 갱신하여 UI에 즉시 반영
        setSubmissions(prev => prev.map(sub => 
            sub.id === id ? { ...sub, isDeleted: !currentStatus } : sub
        ));
    };

    return (
        <div className="p-8 overflow-y-auto h-full bg-gray-50">
            <header className="mb-8">
                <h1 className="text-3xl font-bold font-lexend text-slate-800">결과 대시보드</h1>
                <p className="mt-2 text-md text-slate-500">학생 답안을 확인하고 관리합니다.</p>
            </header>
            
            <div className="bg-white p-6 rounded-lg shadow-sm mb-6 flex justify-between items-center border border-slate-200">
                <div className="flex items-center gap-4">
                    {session?.user.role === 'superadmin' && (
                        <div>
                            <label htmlFor="filterAcademy" className="block text-sm font-medium text-gray-700 mb-1">학원 필터</label>
                            <select id="filterAcademy" value={selectedAcademy} onChange={(e) => setSelectedAcademy(e.target.value)} className="form-select">
                                <option value="all">전체 학원</option>
                                {academies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowDeleted(!showDeleted)} className="btn-secondary">
                        {showDeleted ? <FiEyeOff className="inline mr-2"/> : <FiEye className="inline mr-2"/>}
                        {showDeleted ? "숨김 기록 숨기기" : "숨김 기록 보기"}
                    </button>
                    <button onClick={fetchData} className="btn-secondary" title="새로고침">
                        <FiRefreshCw className="inline"/>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    {loading ? (
                        <LoadingSpinner />
                    ) : (
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="table-header">제출일시</th>
                                    <th className="table-header">학습 정보</th>
                                    {session?.user.role === 'superadmin' && <th className="table-header">학원</th>}
                                    <th className="table-header">학생</th>
                                    <th className="table-header">점수</th>
                                    <th className="table-header">관리</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {filteredSubmissions.length > 0 ? filteredSubmissions.map(sub => {
                                    if (!sub || !sub.id) return null;
                                    const student = students[sub.userId];
                                    const studentAcademy = academies.find(a => a.id === student?.academyId);
                                    
                                    return (
                                    <tr key={sub.id} className={`hover:bg-slate-50 ${sub.isDeleted ? 'bg-gray-50 text-gray-400' : ''}`}>
                                        <td className="table-cell">{new Date(sub.createdAt.toMillis()).toLocaleString('ko-KR')}</td>
                                        <td className="table-cell">{sub.mainChapter} ({sub.assignmentId ? '과제' : '자율학습'})</td>
                                        {session?.user.role === 'superadmin' && (
                                        <td className="table-cell">{studentAcademy?.name || '개인'}</td>
                                        )}
                                        <td className="table-cell font-medium">{student?.studentName || '알 수 없음'}</td>
                                        <td className="table-cell">
                                        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                            {sub.score}점
                                        </span>
                                        </td>
                                        <td className="table-cell space-x-2">
                                        <button 
                                            onClick={() => handleShowDetails(sub)} 
                                            className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors"
                                            title="상세 보기"
                                        >
                                            <FiFileText className="inline w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => toggleDeleteStatus(sub.id, sub.isDeleted)} 
                                            className={`p-1 rounded hover:bg-gray-100 transition-colors ${sub.isDeleted ? 'text-green-600 hover:text-green-800' : 'text-gray-500 hover:text-gray-700'}`}
                                            title={sub.isDeleted ? "복구" : "숨김"}
                                        >
                                            {sub.isDeleted ? <FiEye className="inline w-4 h-4"/> : <FiEyeOff className="inline w-4 h-4"/>}
                                        </button>
                                        </td>
                                    </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={session?.user.role === 'superadmin' ? 6 : 5} className="text-center py-16 text-slate-500">
                                            표시할 데이터가 없습니다.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {selectedSubmission && (
                <DetailsModal 
                    submission={selectedSubmission}
                    student={students[selectedSubmission.userId]}
                    questions={questions}
                    onClose={() => setSelectedSubmission(null)}
                />
            )}
        </div>
    );
}