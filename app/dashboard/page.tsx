// /app/dashboard/page.tsx (최종 수정 버전)
'use client';

import { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Submission, Student, Academy, Question } from "@/types";
import { FiEye, FiEyeOff, FiFileText, FiRefreshCw } from "react-icons/fi";
import DetailsModal from "@/components/ui/DetailsModal";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [students, setStudents] = useState<Record<string, Student>>({});
    const [academies, setAcademies] = useState<Academy[]>([]);
    const [questions, setQuestions] = useState<Record<string, Question>>({});

    // UI 상태
    const [filteredSubmissions, setFilteredSubmissions] = useState<Submission[]>([]);
    const [selectedAcademy, setSelectedAcademy] = useState('all');
    const [showDeleted, setShowDeleted] = useState(false);
    const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
    const [dataLoading, setDataLoading] = useState(true);

    // 데이터 로딩 함수 (수정된 로직 적용)
    const fetchData = useCallback(async () => {
        if (!user) return;
        setDataLoading(true);

        try {
            // 1. 학생 정보 먼저 로드
            const studentSnapshot = await getDocs(collection(db, "students"));
            const studentData: Record<string, Student> = {};
            studentSnapshot.forEach(doc => studentData[doc.id] = { id: doc.id, ...doc.data() } as Student);
            setStudents(studentData);

            // 2. SuperAdmin인 경우 학원 정보 로드
            if (user.role === 'superadmin') {
                const academyQuery = query(collection(db, "academies"), where("isDeleted", "==", false));
                const academySnapshot = await getDocs(academyQuery);
                const academyData = academySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Academy));
                setAcademies(academyData);
            }

            // 3. 제출 결과 로드 (역할에 따라 분기)
            let submissionData: Submission[] = [];
            if (user.role === 'academyadmin' && user.academyId) {
                // 학원 관리자: 해당 학원 학생 ID 목록을 통해 submissions 데이터 필터링
                const studentIdsInAcademy = Object.values(studentData)
                    .filter(student => student.academyId === user.academyId)
                    .map(student => student.id);

                if (studentIdsInAcademy.length > 0) {
                    // Firestore 'in' 쿼리는 최대 30개 값을 지원하므로, ID 목록을 30개씩 분할
                    const submissionPromises = [];
                    for (let i = 0; i < studentIdsInAcademy.length; i += 30) {
                        const chunk = studentIdsInAcademy.slice(i, i + 30);
                        const submissionsQuery = query(collection(db, "submissions"), where("userId", "in", chunk));
                        submissionPromises.push(getDocs(submissionsQuery));
                    }
                    
                    const submissionSnapshots = await Promise.all(submissionPromises);
                    submissionData = submissionSnapshots.flatMap(snapshot =>
                        snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission))
                    );
                }
            } else {
                // SuperAdmin: 모든 submissions 데이터 로드
                const submissionsQuery = query(collection(db, "submissions"));
                const submissionSnapshot = await getDocs(submissionsQuery);
                submissionData = submissionSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
            }

            submissionData.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
            setSubmissions(submissionData);

        } catch (error) {
            console.error("데이터 로딩 중 오류 발생:", error);
        } finally {
            setDataLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!authLoading && user) {
            fetchData();
        }
    }, [user, authLoading, fetchData]);

    // 필터링 로직 (기존 로직 유지, SuperAdmin 전용 필터)
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

    // 상세 보기 핸들러
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
        setSubmissions(prev => prev.map(sub => 
            sub.id === id ? { ...sub, isDeleted: !currentStatus } : sub
        ));
    };

    if (authLoading || dataLoading) {
        return <LoadingSpinner />;
    }

    return (
        <div className="p-8 overflow-y-auto h-full bg-gray-50">
            <header className="mb-8">
                <h1 className="text-3xl font-bold font-lexend text-slate-800">결과 대시보드</h1>
                <p className="mt-2 text-md text-slate-500">학생 답안을 확인하고 관리합니다.</p>
            </header>
            
            <div className="bg-white p-6 rounded-lg shadow-sm mb-6 flex justify-between items-center border border-slate-200">
                <div className="flex items-center gap-4">
                    {user?.role === 'superadmin' && (
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
                                if (!sub || !sub.id) return null;
                                const student = students[sub.userId];
                                const studentAcademy = academies.find(a => a.id === student?.academyId);
                                
                                return (
                                <tr key={sub.id} className={`hover:bg-slate-50 ${sub.isDeleted ? 'bg-gray-50 text-gray-400' : ''}`}>
                                    <td className="table-cell">{new Date(sub.createdAt.toMillis()).toLocaleString('ko-KR')}</td>
                                    <td className="table-cell">{sub.mainChapter} ({sub.assignmentId ? '과제' : '자율학습'})</td>
                                    {user?.role === 'superadmin' && (
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
                                    <td colSpan={user?.role === 'superadmin' ? 6 : 5} className="text-center py-16 text-slate-500">
                                        표시할 데이터가 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
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