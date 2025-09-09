// /app/submissions/page.tsx
'use client';

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { collection, query, where, onSnapshot, doc, getDocs, updateDoc, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Submission, Student, Academy, Question } from "@/types";
import { FiFilter, FiEye, FiEyeOff } from "react-icons/fi";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import DetailsModal from "@/components/ui/DetailsModal";
import Card from "@/components/ui/Card";

export default function SubmissionsPage() {
    const { data: session } = useSession();
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [students, setStudents] = useState<Record<string, Student>>({});
    const [academies, setAcademies] = useState<Academy[]>([]);
    const [questions, setQuestions] = useState<Record<string, Question>>({});
    
    const [filteredSubmissions, setFilteredSubmissions] = useState<Submission[]>([]);
    const [selectedAcademy, setSelectedAcademy] = useState('all');
    const [showDeleted, setShowDeleted] = useState(false);
    const [loading, setLoading] = useState(true);
    
    const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

    const fetchStudentsAndAcademies = useCallback(async () => {
        onSnapshot(collection(db, "students"), (snapshot) => {
            const studentData: Record<string, Student> = {};
            snapshot.forEach(doc => studentData[doc.id] = { id: doc.id, ...doc.data() } as Student);
            setStudents(studentData);
        });

        if (session?.user.role === 'superadmin') {
            onSnapshot(collection(db, "academies"), (snapshot) => {
                const academyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Academy));
                setAcademies(academyData.filter(a => !a.isDeleted));
            });
        }
    }, [session]);

    useEffect(() => {
        if(!session) return;
        fetchStudentsAndAcademies();

        const submissionsQuery = session.user.role === 'academyadmin'
            ? query(collection(db, "submissions"), where("academyId", "==", session.user.academyId!), orderBy("createdAt", "desc"))
            : query(collection(db, "submissions"), orderBy("createdAt", "desc"));
            
        const unsubSubmissions = onSnapshot(submissionsQuery, (snapshot) => {
            const submissionData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
            setSubmissions(submissionData);
            setLoading(false);
        });

        return () => { unsubSubmissions(); };
    }, [session, fetchStudentsAndAcademies]);

    useEffect(() => {
        let result = submissions;
        if (session?.user.role === 'superadmin' && selectedAcademy !== 'all') {
            result = result.filter(sub => students[sub.userId]?.academyId === selectedAcademy);
        }
        if (!showDeleted) {
            result = result.filter(sub => !sub.isDeleted);
        }
        setFilteredSubmissions(result);
    }, [submissions, selectedAcademy, showDeleted, students, session]);
    
    const handleShowDetails = async (submission: Submission) => { /* 이전과 동일 */ };
    const toggleDeleteStatus = async (id: string, currentStatus: boolean) => { /* 이전과 동일 */ };

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold font-lexend text-slate-800">결과 목록</h1>
                <p className="mt-2 text-md text-slate-500">학생 답안을 확인하고 관리합니다.</p>
            </header>
            
            <Card>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4">
                    {session?.user.role === 'superadmin' && (
                        <div className="w-full sm:w-auto">
                            <label htmlFor="filterAcademy" className="form-label">학원 필터</label>
                            <select id="filterAcademy" value={selectedAcademy} onChange={(e) => setSelectedAcademy(e.target.value)} className="form-select">
                                <option value="all">전체 학원</option>
                                {academies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                    )}
                    <button onClick={() => setShowDeleted(!showDeleted)} className="btn btn-secondary w-full sm:w-auto mt-4 sm:mt-0">
                        {showDeleted ? <FiEyeOff/> : <FiEye/>}
                        <span>{showDeleted ? "숨김 기록 닫기" : "숨김 기록 보기"}</span>
                    </button>
                </div>

                {loading ? <LoadingSpinner /> : (
                  <div className="overflow-x-auto">
                      <table className="min-w-full">
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
                                  const student = students[sub.userId];
                                  const studentAcademy = academies.find(a => a.id === student?.academyId);
                                  return (
                                  <tr key={sub.id} className={`cursor-pointer hover:bg-slate-50 ${sub.isDeleted ? 'opacity-50' : ''}`} onClick={() => !sub.isDeleted && handleShowDetails(sub)}>
                                      <td className="table-cell text-xs">{new Date(sub.createdAt.toDate()).toLocaleString('ko-KR')}</td>
                                      <td className="table-cell">{sub.mainChapter} <span className="text-xs text-slate-400">({sub.assignmentId ? '과제' : '자율'})</span></td>
                                      {session?.user.role === 'superadmin' && <td className="table-cell">{studentAcademy?.name || '개인'}</td>}
                                      <td className="table-cell font-medium text-slate-800">{student?.studentName || '알 수 없음'}</td>
                                      <td className="table-cell"><span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">{sub.score}점</span></td>
                                      <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                                          <button onClick={() => toggleDeleteStatus(sub.id, sub.isDeleted)} className={`text-xs font-semibold rounded-full px-3 py-1 ${sub.isDeleted ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                              {sub.isDeleted ? '복구' : '숨김'}
                                          </button>
                                      </td>
                                  </tr>
                              )}) : (
                                <tr><td colSpan={6} className="text-center py-16 text-slate-500">표시할 데이터가 없습니다.</td></tr>
                              )}
                          </tbody>
                      </table>
                  </div>
                )}
            </Card>

            {selectedSubmission && <DetailsModal submission={selectedSubmission} student={students[selectedSubmission.userId]} questions={questions} onClose={() => setSelectedSubmission(null)} />}
        </div>
    );
}
