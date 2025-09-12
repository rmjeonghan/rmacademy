'use client';

import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Academy, Class, Student, Assignment, Question, Submission } from "@/types";
import { useAuth } from "@/context/AuthContext";
import DetailsModal from "@/components/ui/DetailsModal";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { FiFileText, FiChevronLeft, FiChevronRight } from "react-icons/fi";

interface StudentAssignment {
    id: string;
    studentId: string;
    assignmentId: string;
    classId: string;
    academyId: string;
    academyName: string;
    isCompleted: boolean;
    completedAt: any; // Timestamp
    score: string; // "8/10"과 같은 문자열 형식
    questionIds: string[];
    answers: (number | null)[];
}

export default function AssignmentStatusPage() {
    const { user, loading: authLoading } = useAuth();
    const isSuperAdmin = user?.role === 'superadmin';

    // 데이터 상태
    const [academies, setAcademies] = useState<Academy[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [studentAssignments, setStudentAssignments] = useState<StudentAssignment[]>([]);
    const [questions, setQuestions] = useState<Record<string, Question>>({});
    
    // UI 상태
    const [loading, setLoading] = useState(true);
    const [selectedAcademyId, setSelectedAcademyId] = useState('');
    const [selectedClassId, setSelectedClassId] = useState('');
    const [selectedData, setSelectedData] = useState<Submission | null>(null);
    const [isModalLoading, setIsModalLoading] = useState(false);
    // 📌 [추가] 페이지네이션 상태 추가
    const [currentPage, setCurrentPage] = useState(1);
    const [assignmentsPerPage] = useState(10); // 한 페이지에 표시할 과제 수

    // 학원 목록 로딩 (기존과 동일)
    useEffect(() => {
        if (!user) return;
        if (isSuperAdmin) {
            const unsub = onSnapshot(collection(db, "academies"), snap => setAcademies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Academy))));
            return () => unsub();
        } else if (user.academyId) {
            setSelectedAcademyId(user.academyId);
        }
    }, [user, isSuperAdmin]);

    // 학원 선택 시 수업 목록 로드 (기존과 동일)
    useEffect(() => {
        if (!selectedAcademyId) {
            setClasses([]);
            setSelectedClassId('');
            return;
        }
        const q = query(collection(db, "classes"), where("academyId", "==", selectedAcademyId), where("isDeleted", "==", false));
        const unsubscribe = onSnapshot(q, snap => setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Class))));
        return () => unsubscribe();
    }, [selectedAcademyId]);

    // 수업 선택 시 데이터 로드 (기존과 동일)
    useEffect(() => {
        if (!selectedClassId) {
            setStudents([]); 
            setAssignments([]); 
            setStudentAssignments([]); 
            setLoading(false);
            return;
        }
        setLoading(true);
        const studentQuery = query(collection(db, "students"), where("classId", "==", selectedClassId), where("isDeleted", "==", false), where("status", "==", "active"));
        const assignQuery = query(collection(db, "academyAssignments"), where("classId", "==", selectedClassId));
        const subQuery = query(collection(db, 'studentAssignments'), where('classId', '==', selectedClassId));

        const unsubStudents = onSnapshot(studentQuery, snap => setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student))));
        const unsubAssigns = onSnapshot(assignQuery, snap => setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment))));
        const unsubSubs = onSnapshot(subQuery, snap => {
            setStudentAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentAssignment)));
            setLoading(false);
        }, (error) => {
            console.error("제출 기록 조회 실패 (Firestore 색인이 필요할 수 있습니다): ", error); 
            setLoading(false);
        });
        
        return () => { unsubStudents(); unsubAssigns(); unsubSubs(); };
    }, [selectedClassId]);

    const studentAssignmentMap = useMemo(() => {
        const map = new Map<string, StudentAssignment>();
        studentAssignments.forEach(sa => {
            if (sa.studentId && sa.assignmentId) {
                map.set(`${sa.studentId}_${sa.assignmentId}`, sa);
            }
        });
        return map;
    }, [studentAssignments]);

    // --- 👇 [추가] 페이지네이션을 위한 과제 목록 계산 ---
    const sortedAssignments = useMemo(() => {
        return [...assignments].sort((a, b) => a.dueDate.toMillis() - b.dueDate.toMillis());
    }, [assignments]);

    const paginatedAssignments = useMemo(() => {
        const indexOfLastAssignment = currentPage * assignmentsPerPage;
        const indexOfFirstAssignment = indexOfLastAssignment - assignmentsPerPage;
        return sortedAssignments.slice(indexOfFirstAssignment, indexOfLastAssignment);
    }, [sortedAssignments, currentPage, assignmentsPerPage]);

    const totalPages = Math.ceil(sortedAssignments.length / assignmentsPerPage);
    // --- 페이지네이션 로직 끝 ---

    // 상세 보기 핸들러 (기존과 동일)
    const handleShowDetails = async (studentAssignment: StudentAssignment | undefined) => {
        if (!studentAssignment || !studentAssignment.questionIds || studentAssignment.questionIds.length === 0) {
            alert("상세 결과 데이터가 없습니다.");
            return;
        }
        setIsModalLoading(true);
        try {
            const neededQIds = studentAssignment.questionIds.filter(id => !questions[id]);
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
            const submissionForModal: Submission = {
                id: studentAssignment.id,
                userId: studentAssignment.studentId,
                studentId: studentAssignment.studentId,
                assignmentId: studentAssignment.assignmentId,
                classId: studentAssignment.classId,
                questionIds: studentAssignment.questionIds,
                answers: studentAssignment.answers,
                score: studentAssignment.score as any,
                completedAt: studentAssignment.completedAt,
                createdAt: studentAssignment.completedAt,
                isCompleted: studentAssignment.isCompleted,
                academyId: studentAssignment.academyId,
                academyName: studentAssignment.academyName,
                isDeleted: false,
                mainChapter: '학원 과제',
            };
            setSelectedData(submissionForModal);
        } catch (error) {
            console.error("상세 결과 로딩 중 오류 발생: ", error);
            alert("상세 결과를 불러오는 데 실패했습니다.");
        } finally {
            setIsModalLoading(false);
        }
    };
    
    if (authLoading) {
        return <div className="flex h-full w-full items-center justify-center"><LoadingSpinner /></div>
    }

    return (
        <div className="p-8 h-full overflow-y-auto bg-slate-50">
            {isModalLoading && <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"><LoadingSpinner/></div>}
            <header className="mb-8">
                <h1 className="text-3xl font-bold font-lexend text-slate-800">과제 현황</h1>
                <p className="mt-2 text-md text-slate-500">수업별 학생들의 과제 제출 현황, 점수, 상세 결과를 확인합니다.</p>
            </header>

            <div className="flex gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                {isSuperAdmin && (
                    <select value={selectedAcademyId} onChange={e => setSelectedAcademyId(e.target.value)} className="form-select">
                        <option value="">학원 선택</option>
                        {academies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                )}
                <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} className="form-select" disabled={!selectedAcademyId}>
                    <option value="">수업 선택</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
            
            {loading ? <LoadingSpinner /> : selectedClassId ? (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                                 <thead className="bg-slate-50">
                                     <tr>
                                         {/* 📌 [수정] 학생 이름 열에 sticky 속성을 추가하여 화면에 고정시킵니다. */}
                                         <th className="table-header text-left sticky left-0 bg-slate-50 z-10 px-4 py-3 min-w-[120px]">학생 이름</th>
                                         {/* 📌 [수정] 전체 assignments 대신 paginatedAssignments를 사용합니다. */}
                                         {paginatedAssignments.map(assign => (
                                             <th key={assign.id} colSpan={3} className="table-header text-center px-4 py-3 border-l" title={assign.title}>
                                                 <p className="font-semibold">{assign.title}</p>
                                                 <p className="text-xs font-normal text-slate-500 mt-1">
                                                     마감: {new Date(assign.dueDate.toMillis()).toLocaleDateString('ko-KR')}
                                                 </p>
                                             </th>
                                         ))}
                                     </tr>
                                     <tr>
                                         <th className="table-header sticky left-0 bg-slate-50 z-10 px-4 py-2"></th>
                                         {paginatedAssignments.map(assign => (
                                             <React.Fragment key={`${assign.id}-sub`}>
                                                 <th className="table-header text-center px-4 py-2 border-l font-normal">제출</th>
                                                 <th className="table-header text-center px-4 py-2 font-normal">점수</th>
                                                 <th className="table-header text-center px-4 py-2 font-normal">상세</th>
                                             </React.Fragment>
                                         ))}
                                     </tr>
                                 </thead>
                                 <tbody className="bg-white divide-y divide-slate-200">
                                     {students.length > 0 ? students.map(student => (
                                         <tr key={student.id} className="hover:bg-slate-50">
                                             {/* 📌 [수정] 학생 이름 셀에도 sticky 속성을 적용합니다. */}
                                             <td className="px-4 py-3 font-medium text-slate-800 sticky left-0 bg-white hover:bg-slate-50 z-10">{student.studentName}</td>
                                             {paginatedAssignments.map(assign => {
                                                 const studentAssignment = studentAssignmentMap.get(`${student.id}_${assign.id}`);
                                                 return (
                                                     <React.Fragment key={`${assign.id}-${student.id}`}>
                                                         <td className="px-4 py-3 text-center border-l">
                                                             {studentAssignment ? <span className="text-green-600 font-bold text-lg">✅</span> : <span className="text-red-500 text-lg">❌</span>}
                                                         </td>
                                                         <td className="px-4 py-3 text-center text-sm">
                                                             {studentAssignment ? studentAssignment.score : '-'}
                                                         </td>
                                                         <td className="px-4 py-3 text-center">
                                                             {studentAssignment && (
                                                                 <button 
                                                                     onClick={() => handleShowDetails(studentAssignment)}
                                                                     className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-50"
                                                                     title="상세 결과 보기"
                                                                 >
                                                                     <FiFileText className="w-4 h-4" />
                                                                 </button>
                                                             )}
                                                         </td>
                                                     </React.Fragment>
                                                 )
                                             })}
                                         </tr>
                                     )) : (
                                         <tr>
                                             <td colSpan={(paginatedAssignments.length * 3) + 1} className="py-16 text-center text-slate-500">
                                                 선택된 수업에 등록된 학생이 없습니다.
                                             </td>
                                         </tr>
                                     )}
                                 </tbody>
                        </table>
                    </div>
                    {/* --- 👇 [추가] 페이지네이션 컨트롤 UI --- */}
                    {totalPages > 1 && (
                        <div className="flex justify-center items-center p-4 border-t border-slate-200 bg-white">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
                                aria-label="Previous Page"
                            >
                                <FiChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="px-4 text-sm font-medium">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
                                aria-label="Next Page"
                            >
                                <FiChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                    {/* --- 페이지네이션 UI 끝 --- */}
                     {assignments.length === 0 && students.length > 0 && 
                        <div className="py-16 text-center text-slate-500">
                            아직 생성된 과제가 없습니다. '과제 관리' 페이지에서 과제를 생성해주세요.
                        </div>
                    }
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-16 text-center text-slate-500">
                    {isSuperAdmin ? (
                        <p className="text-lg">현황을 보려면 학원과 수업을 선택해주세요.</p>
                    ) : (
                        <p className="text-lg">현황을 보려면 수업을 선택해주세요.</p>
                    )}
                </div>
            )}
            {selectedData && (
                <DetailsModal 
                    submission={selectedData}
                    student={students.find(s => s.id === selectedData.userId)!}
                    questions={questions}
                    onClose={() => setSelectedData(null)}
                />
            )}
        </div>
    )
}

