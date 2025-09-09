// /app/dashboard/page.tsx
'use client';

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Submission, Student, Academy, Question } from "@/types";
import { FiFilter, FiEye, FiEyeOff } from "react-icons/fi";

// 상세 정보 모달 컴포넌트
function DetailsModal({ submission, student, questions, onClose }: any) {
    if (!submission) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <header className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold">{student?.studentName || '학생'} - 상세 결과</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl font-light">&times;</button>
                </header>
                <div className="p-6 overflow-y-auto">
                    <div className="space-y-4">
                        {submission.questionIds.map((qId: string, index: number) => {
                            const question = questions[qId];
                            if (!question) return <div key={index} className="p-4 rounded-lg bg-gray-100">문제 정보를 불러올 수 없습니다. (ID: {qId})</div>;
                            
                            const userAnswerIndex = submission.answers[index];
                            const isCorrect = question.answerIndex === userAnswerIndex;
                            const bgColor = isCorrect ? 'bg-green-50' : 'bg-red-50';

                            return (
                                <div key={qId} className={`p-4 rounded-lg ${bgColor}`}>
                                    <p className="font-bold whitespace-pre-wrap">{index + 1}. {question.questionText}</p>
                                    <ul className="mt-2 space-y-1 text-sm">
                                        {question.choices.map((choice: string, choiceIndex: number) => (
                                           <li key={choiceIndex} className={`${question.answerIndex === choiceIndex ? 'font-bold text-green-700' : ''} ${userAnswerIndex === choiceIndex && !isCorrect ? 'text-red-700 line-through' : ''}`}>
                                               {choiceIndex + 1}. {choice}
                                           </li>
                                        ))}
                                    </ul>
                                    <p className="text-xs mt-2">정답: {question.choices[question.answerIndex]}</p>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}


export default function DashboardPage() {
    const { data: session } = useSession();
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [students, setStudents] = useState<Record<string, Student>>({});
    const [academies, setAcademies] = useState<Academy[]>([]);
    const [questions, setQuestions] = useState<Record<string, Question>>({});
    
    // 필터링 및 UI 상태
    const [filteredSubmissions, setFilteredSubmissions] = useState<Submission[]>([]);
    const [selectedAcademy, setSelectedAcademy] = useState('all');
    const [showDeleted, setShowDeleted] = useState(false);
    
    // 모달 상태
    const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

    // 데이터 로딩
    useEffect(() => {
        // 학생 정보 로드
        const unsubStudents = onSnapshot(collection(db, "students"), (snapshot) => {
            const studentData: Record<string, Student> = {};
            snapshot.forEach(doc => studentData[doc.id] = { id: doc.id, ...doc.data() } as Student);
            setStudents(studentData);
        });

        // 학원 정보 로드 (SuperAdmin 전용)
        let unsubAcademies = () => {};
        if (session?.user.role === 'superadmin') {
            unsubAcademies = onSnapshot(collection(db, "academies"), (snapshot) => {
                const academyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Academy));
                setAcademies(academyData.filter(a => !a.isDeleted));
            });
        }
        
        // 제출 결과 로드
        const submissionsQuery = session?.user.role === 'academyadmin'
            ? query(collection(db, "submissions"), where("academyId", "==", session.user.academyId!))
            : collection(db, "submissions");
            
        const unsubSubmissions = onSnapshot(submissionsQuery, (snapshot) => {
            const submissionData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
            submissionData.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
            setSubmissions(submissionData);
        });

        return () => {
            unsubStudents();
            unsubAcademies();
            unsubSubmissions();
        };
    }, [session]);

    // 필터링 로직
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

    // 상세 보기 핸들러
    const handleShowDetails = async (submission: Submission) => {
        const neededQIds = submission.questionIds.filter(id => !questions[id]);
        if (neededQIds.length > 0) {
            // Firestore는 `in` 쿼리에 최대 30개의 값을 허용합니다.
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
    };

    return (
        <div className="p-8 overflow-y-auto h-full">
            <header className="mb-8">
                <h1 className="text-3xl font-bold font-lexend text-slate-800">결과 대시보드</h1>
                <p className="mt-2 text-md text-slate-500">학생 답안을 확인하고 관리합니다.</p>
            </header>
            
            <div className="bg-white p-6 rounded-lg shadow-sm mb-6 flex justify-between items-center">
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
                <button onClick={() => setShowDeleted(!showDeleted)} className="btn-secondary">
                    {showDeleted ? <FiEyeOff className="inline mr-2"/> : <FiEye className="inline mr-2"/>}
                    {showDeleted ? "숨김 기록 숨기기" : "숨김 기록 보기"}
                </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
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
                            {filteredSubmissions.map(sub => {
                                const student = students[sub.userId];
                                const studentAcademy = academies.find(a => a.id === student?.academyId);
                                return (
                                <tr key={sub.id} className={`hover:bg-slate-50 ${sub.isDeleted ? 'bg-gray-100 text-gray-400' : ''}`} onClick={() => !sub.isDeleted && handleShowDetails(sub)}>
                                    <td className="table-cell">{new Date(sub.createdAt.toMillis()).toLocaleString('ko-KR')}</td>
                                    <td className="table-cell">{sub.mainChapter} ({sub.assignmentId ? '과제' : '자율학습'})</td>
                                    {session?.user.role === 'superadmin' && <td className="table-cell">{studentAcademy?.name || '개인'}</td>}
                                    <td className="table-cell font-medium">{student?.studentName || '알 수 없음'}</td>
                                    <td className="table-cell"><span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">{sub.score}점</span></td>
                                    <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                                        <button onClick={() => toggleDeleteStatus(sub.id, sub.isDeleted)} className={`text-sm font-semibold ${sub.isDeleted ? 'text-green-600' : 'text-gray-500'}`}>
                                            {sub.isDeleted ? '복구' : '숨김'}
                                        </button>
                                    </td>
                                </tr>
                            )})}
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
