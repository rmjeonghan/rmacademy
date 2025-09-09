// /app/assignments/page.tsx
'use client';

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Academy, Class, Assignment } from "@/types";
import { curriculumData } from "@/data/curriculum";
import { FiPlus, FiTrash2, FiBookOpen } from "react-icons/fi"; // 아이콘 추가

// 단원 선택 모달
function ChapterSelectModal({ isOpen, onClose, onConfirm, initialSelectedIds }: any) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedIds));

    const handleCheckboxChange = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="modal-content bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col">
                <header className="p-4 border-b border-slate-200 flex justify-between items-center bg-blue-600 text-white rounded-t-lg"> {/* 모달 헤더 스타일 */}
                    <h2 className="text-xl font-bold">과제 범위 단원 선택</h2>
                    <button onClick={onClose} className="text-white hover:text-blue-200 text-3xl font-light">&times;</button>
                </header>
                <div className="flex-grow overflow-y-auto max-h-[70vh] p-4">
                    {Object.entries(curriculumData).map(([subject, chapters]) => (
                        <div key={subject} className="mb-4">
                            <h3 className="text-lg font-semibold my-2 sticky top-0 bg-white py-2 border-b border-slate-100">{subject}</h3>
                            {chapters.map(chapter => (
                                <div key={chapter.id} className="ml-4 mb-3">
                                    <h4 className="font-semibold text-slate-800">{chapter.name}</h4>
                                    <ul className="pl-4 mt-1 space-y-1">
                                        {chapter.subChapters.map(subChapterString => {
                                            const [id, ...nameParts] = subChapterString.split(':');
                                            const name = nameParts.join(':').trim();
                                            return (
                                                <li key={id}>
                                                    <label className="flex items-center space-x-2 cursor-pointer p-1 rounded hover:bg-gray-100 transition-colors">
                                                        <input type="checkbox" checked={selectedIds.has(id)} onChange={() => handleCheckboxChange(id)} className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500"/>
                                                        <span className="text-sm text-slate-700">{name} <span className="text-xs text-slate-500">({id})</span></span>
                                                    </label>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
                <footer className="p-4 bg-gray-50 border-t border-slate-200 text-right rounded-b-lg">
                    <button onClick={() => onConfirm(Array.from(selectedIds))} className="btn-primary">선택 완료</button>
                </footer>
            </div>
        </div>
    );
}

export default function AssignmentsPage() {
    const { data: session } = useSession();
    const isSuperAdmin = session?.user.role === 'superadmin';

    // 데이터 상태
    const [academies, setAcademies] = useState<Academy[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    
    // 입력 폼 상태
    const [selectedAcademyId, setSelectedAcademyId] = useState('');
    const [selectedClassId, setSelectedClassId] = useState('');
    const [title, setTitle] = useState('');
    const [week, setWeek] = useState(1);
    const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
    const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // 데이터 로딩
    useEffect(() => {
        if (!session) return;
        if (isSuperAdmin) {
            onSnapshot(collection(db, "academies"), snap => setAcademies(snap.docs.map(d=>({id: d.id, ...d.data()} as Academy))));
        } else {
            // 학원 관리자는 자신의 학원 ID를 기본으로 사용
            if (session.user.academyId) {
                setSelectedAcademyId(session.user.academyId!);
            }
        }
    }, [session, isSuperAdmin]);

    useEffect(() => {
        // 선택된 학원의 수업 목록 가져오기
        if (selectedAcademyId) {
             onSnapshot(query(collection(db, "classes"), where("academyId", "==", selectedAcademyId)), snap => {
                setClasses(snap.docs.map(d=>({id: d.id, ...d.data()} as Class)));
            });
        }
    }, [selectedAcademyId]);

    useEffect(() => {
        // 선택된 수업의 과제 목록 가져오기
        if (!selectedAcademyId || !selectedClassId) {
            setAssignments([]);
            return;
        }
        const q = query(collection(db, "academyAssignments"), where("academyId", "==", selectedAcademyId), where("classId", "==", selectedClassId));
        const unsub = onSnapshot(q, snap => {
            const data = snap.docs.map(d => ({id: d.id, ...d.data()} as Assignment));
            data.sort((a,b) => b.createdAt.toMillis() - a.createdAt.toMillis());
            setAssignments(data);
        });
        return () => unsub();
    }, [selectedAcademyId, selectedClassId]);

    // 핸들러
    const handleSaveAssignment = async () => {
        if (!selectedAcademyId || !selectedClassId || !title.trim() || selectedDays.size === 0 || selectedUnitIds.length === 0) {
            alert("모든 필드를 올바르게 입력해주세요.");
            return;
        }

        const today = new Date();
        const promises = Array.from(selectedDays).map(dayIndex => {
            const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
            // 마감일을 해당 주차의 요일로 설정 (예: 다음 주 월요일)
            const dueDate = new Date();
            const currentDay = dueDate.getDay();
            const distance = (dayIndex + 7 - currentDay) % 7;
            dueDate.setDate(dueDate.getDate() + distance);
            dueDate.setDate(dueDate.getDate() + 7); // 한 주 뒤로 설정

            const newAssignment = {
                academyId: selectedAcademyId,
                classId: selectedClassId,
                title,
                dayTitle: `${week}주차 ${dayNames[dayIndex]}요일 과제`,
                assignedUnitIds: selectedUnitIds,
                dueDate: Timestamp.fromDate(dueDate),
                week,
                createdAt: serverTimestamp(),
            };
            return addDoc(collection(db, "academyAssignments"), newAssignment);
        });
        await Promise.all(promises);
        alert(`${promises.length}개의 일일 과제가 등록되었습니다.`);
        // 폼 초기화
        setTitle('');
        setSelectedDays(new Set());
        setSelectedUnitIds([]);
    };

    const handleDeleteAssignment = async (id: string) => {
        if (confirm("정말로 이 과제를 삭제하시겠습니까?")) {
            await deleteDoc(doc(db, "academyAssignments", id));
        }
    };

    const WeekdayButton = ({ day, index }: { day: string, index: number }) => (
        <button 
            onClick={() => {
                const newDays = new Set(selectedDays);
                if (newDays.has(index)) newDays.delete(index);
                else newDays.add(index);
                setSelectedDays(newDays);
            }}
            className={`assignment-btn ${selectedDays.has(index) ? 'active' : ''}`}
        >
            {day}
        </button>
    );

    return (
        <div className="p-8 overflow-y-auto h-full bg-gray-50">
            <header className="mb-8">
                <h1 className="text-3xl font-bold font-lexend text-slate-800">{isSuperAdmin ? "학원 과제 관리" : "수업 과제 관리"}</h1>
                <p className="mt-2 text-md text-slate-500">학습 계획 설정과 유사한 UI로 과제를 할당합니다.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 과제 생성 패널 */}
                <div className="bg-white p-6 rounded-lg shadow-sm space-y-4 border border-slate-200">
                    <h2 className="text-xl font-semibold text-slate-800">새 과제 할당</h2>
                    {isSuperAdmin && (
                        <div>
                            <label className="form-label">대상 학원</label>
                            <select value={selectedAcademyId} onChange={e => {setSelectedAcademyId(e.target.value); setSelectedClassId('');}} className="form-select">
                                <option value="">학원 선택</option>
                                {academies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="form-label">대상 수업</label>
                         <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} className="form-select" disabled={!selectedAcademyId || !classes.length}>
                            <option value="">수업 선택</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">과제 이름</label>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 1주차 역학 시스템 정복" className="form-input" />
                    </div>
                     <div>
                        <label className="form-label">과제 주차</label>
                        <select value={week} onChange={e => setWeek(Number(e.target.value))} className="form-select">
                            {[1,2,3,4,5,6,7,8].map(w => <option key={w} value={w}>{w}주차</option>)}
                        </select>
                    </div>
                    <div>
                      <h3 className="form-label">과제 요일 선택</h3>
                      <div className="grid grid-cols-7 gap-2">
                        {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => <WeekdayButton key={i} day={day} index={i}/>)}
                      </div>
                    </div>
                     <div>
                        <label className="form-label">과제 범위</label>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-600 min-h-[40px] flex items-center">
                            {selectedUnitIds.length > 0 ? (
                                <span className="flex items-center space-x-2">
                                    <FiBookOpen className="text-blue-500"/>
                                    <span>총 {selectedUnitIds.length}개 소단원 선택됨</span>
                                </span>
                            ) : (
                                <span className="text-gray-400">선택된 단원이 없습니다.</span>
                            )}
                        </div>
                        <button onClick={() => setIsModalOpen(true)} className="mt-2 w-full btn-secondary">단원 선택하기</button>
                    </div>
                    <button onClick={handleSaveAssignment} className="w-full btn-primary py-3">과제 저장하기</button>
                </div>

                {/* 할당된 과제 목록 */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h2 className="text-xl font-semibold mb-4 text-slate-800">할당된 과제 목록</h2>
                    <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto">
                        {assignments.length > 0 ? assignments.map(assign => (
                            <div key={assign.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-slate-800">{assign.title} ({assign.dayTitle})</p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            마감일: {new Date(assign.dueDate.toMillis()).toLocaleDateString('ko-KR')} | 범위: 총 {assign.assignedUnitIds.length}개 소단원
                                        </p>
                                    </div>
                                    <button onClick={() => handleDeleteAssignment(assign.id)} className="text-red-500 hover:text-red-700 p-2 rounded hover:bg-red-100 transition-colors" title="과제 삭제"><FiTrash2/></button>
                                </div>
                            </div>
                        )) : <p className="text-center text-slate-500 py-4">선택된 수업에 할당된 과제가 없습니다.</p>}
                    </div>
                </div>
            </div>
            
            <ChapterSelectModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={(ids: string[]) => {
                    setSelectedUnitIds(ids);
                    setIsModalOpen(false);
                }}
                initialSelectedIds={selectedUnitIds}
            />
        </div>
    );
}