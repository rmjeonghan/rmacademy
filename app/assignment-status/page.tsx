// /app/assignment-status/page.tsx
'use client';

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Academy, Class, Student, Assignment, Submission } from "@/types";

export default function AssignmentStatusPage() {
    const { data: session } = useSession();
    const isSuperAdmin = session?.user.role === 'superadmin';

    // 데이터
    const [academies, setAcademies] = useState<Academy[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    
    // 필터
    const [selectedAcademyId, setSelectedAcademyId] = useState('');
    const [selectedClassId, setSelectedClassId] = useState('');

    // 데이터 로딩
    useEffect(() => {
        if (!session) return;
        if (isSuperAdmin) {
            onSnapshot(collection(db, "academies"), snap => setAcademies(snap.docs.map(d=>({id: d.id, ...d.data()} as Academy))));
        } else {
            // academyId가 있을 때만 상태 업데이트
            if (session.user.academyId) {
                setSelectedAcademyId(session.user.academyId);
            }
        }
    }, [session, isSuperAdmin]);

    useEffect(() => {
        if (!selectedAcademyId) {
            setClasses([]);
            setSelectedClassId('');
            return;
        }
        const q = query(collection(db, "classes"), where("academyId", "==", selectedAcademyId));
        const unsub = onSnapshot(q, snap => setClasses(snap.docs.map(d=>({id: d.id, ...d.data()} as Class))));
        return () => unsub();
    }, [selectedAcademyId]);
    
    useEffect(() => {
        if (!selectedClassId) {
            setStudents([]);
            setAssignments([]);
            setSubmissions([]);
            return;
        }
        // 학생 로드
        const studentQuery = query(collection(db, "students"), where("classId", "==", selectedClassId), where("isDeleted", "==", false));
        const unsubStudents = onSnapshot(studentQuery, snap => setStudents(snap.docs.map(d => ({id:d.id, ...d.data()} as Student))));
        
        // 과제 로드
        const assignmentQuery = query(collection(db, "academyAssignments"), where("classId", "==", selectedClassId));
        const unsubAssignments = onSnapshot(assignmentQuery, snap => {
            const data = snap.docs.map(d => ({id:d.id, ...d.data()} as Assignment));
            data.sort((a,b) => a.dueDate.toMillis() - b.createdAt.toMillis()); // 생성일 대신 마감일 기준으로 정렬
            setAssignments(data);
        });

        // 제출 결과 로드
        const submissionQuery = query(collection(db, "submissions"), where("classId", "==", selectedClassId));
        const unsubSubmissions = onSnapshot(submissionQuery, snap => setSubmissions(snap.docs.map(d => ({id: d.id, ...d.data()} as Submission))));


        return () => {
            unsubStudents();
            unsubAssignments();
            unsubSubmissions();
        };
    }, [selectedClassId]);

    // 제출 현황 맵 생성
    const submissionMap = new Map(submissions.map(s => `${s.userId}_${s.assignmentId}`));
    
    return (
         <div className="p-8 overflow-y-auto h-full bg-gray-50">
            <header className="mb-8">
                <h1 className="text-3xl font-bold font-lexend text-slate-800">과제 현황</h1>
                <p className="mt-2 text-md text-slate-500">학생들의 과제 제출 현황을 간결하게 확인합니다.</p>
            </header>
            
            <div className="bg-white p-6 rounded-lg shadow-sm mb-6 flex gap-4 border border-slate-200">
                {isSuperAdmin && (
                    <div>
                        <label className="form-label">학원 선택</label>
                        <select value={selectedAcademyId} onChange={e => setSelectedAcademyId(e.target.value)} className="form-select">
                            <option value="">학원 선택</option>
                            {academies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </div>
                )}
                 <div>
                    <label className="form-label">수업 선택</label>
                    <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} className="form-select" disabled={!classes.length}>
                        <option value="">수업 선택</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            </div>

            {selectedClassId ? (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-center">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="sticky left-0 bg-slate-50 z-20 px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[120px]">학생 이름</th>
                                    {assignments.map(assign => (
                                        <th key={assign.id} className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[80px]" title={`${assign.title} (${new Date(assign.dueDate.toMillis()).toLocaleDateString('ko-KR')})`}>
                                            {assign.dayTitle.replace(' 과제', '')} <br/>
                                            <span className="font-normal text-gray-400 text-[10px]">{new Date(assign.dueDate.toMillis()).toLocaleDateString('ko-KR').slice(5)}</span> {/* 월/일만 표시 */}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                             <tbody className="bg-white divide-y divide-slate-200">
                                {students.length > 0 ? students.map(student => (
                                    <tr key={student.id} className="hover:bg-slate-50">
                                        <td className="sticky left-0 bg-white text-left px-4 py-3 whitespace-nowrap text-sm font-semibold text-slate-800 border-r border-slate-100">{student.studentName}</td>
                                        {assignments.map(assign => {
                                            const submitted = submissionMap.has(`${student.id}_${assign.id}`);
                                            return (
                                                <td key={assign.id} className="px-4 py-3">
                                                    {submitted ? <span className="text-green-600 font-bold text-lg">✅</span> : <span className="text-red-500 text-lg">❌</span>}
                                                </td>
                                            )
                                        })}
                                    </tr>
                                )) : (
                                     <tr>
                                        <td colSpan={assignments.length + 1} className="py-8 text-center text-slate-500">
                                            등록된 학생이 없거나, 선택된 수업에 학생이 없습니다.
                                        </td>
                                    </tr>
                                )}
                             </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-16 text-center text-slate-500">
                    <p className="text-lg">현황을 보려면 학원과 수업을 선택해주세요.</p>
                    <p className="mt-2 text-sm text-gray-400">학원 관리자는 소속된 학원의 수업만 선택할 수 있습니다.</p>
                </div>
            )}
        </div>
    )
}