// /app/assignments/page.tsx (과제 시작일 기능 추가 최종 버전)
'use client';

import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Academy, Class, Assignment } from "@/types";
import { curriculumData } from "@/data/curriculum";
import { FiPlus, FiTrash2, FiBookOpen } from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

// 단원 선택 모달 (기존과 동일)
function ChapterSelectModal({ isOpen, onClose, onConfirm, initialSelectedIds }: any) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedIds));

    const handleCheckboxChange = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="modal-content bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col">
                <header className="p-4 border-b border-slate-200 flex justify-between items-center bg-blue-600 text-white rounded-t-lg">
                    <h2 className="text-xl font-bold">과제 범위 단원 선택</h2>
                    <button onClick={onClose} className="text-white hover:text-blue-200 text-3xl font-light">&times;</button>
                </header>
                <div className="flex-grow overflow-y-auto max-h-[70vh] p-4">
                    {Object.entries(curriculumData).map(([subject, chapters]) => (
                        <div key={subject} className="mb-4">
                            <h3 className="text-lg font-semibold my-2 sticky top-0 bg-white py-2 border-b border-slate-100">{subject}</h3>
                            {(chapters as any[]).map(chapter => (
                                <div key={chapter.id} className="ml-4 mb-3">
                                    <h4 className="font-semibold text-slate-800">{chapter.name}</h4>
                                    <ul className="pl-4 mt-1 space-y-1">
                                        {chapter.subChapters.map((subChapterString: string) => {
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
    const { user, loading: authLoading } = useAuth();
    const isSuperAdmin = user?.role === 'superadmin';

    // 데이터 상태
    const [academies, setAcademies] = useState<Academy[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    
    // --- 👇 입력 폼 상태 수정 ---
    const [selectedAcademyId, setSelectedAcademyId] = useState('');
    const [selectedClassId, setSelectedClassId] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]); // 오늘 날짜로 초기화
    const [title, setTitle] = useState('');
    const [selectedDays, setSelectedDays] = useState<Map<number, Date>>(new Map()); // 요일 인덱스와 실제 날짜를 함께 저장
    const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    // --- 수정 끝 ---


    // 데이터 로딩 (기존과 동일)
    useEffect(() => {
        if (!user) return;
        if (isSuperAdmin) {
            onSnapshot(collection(db, "academies"), snap => setAcademies(snap.docs.map(d=>({id: d.id, ...d.data()} as Academy))));
        } else if (user.academyId) {
            setSelectedAcademyId(user.academyId);
        }
    }, [user, isSuperAdmin]);

    useEffect(() => {
        if (selectedAcademyId) {
             onSnapshot(query(collection(db, "classes"), where("academyId", "==", selectedAcademyId)), snap => {
                setClasses(snap.docs.map(d=>({id: d.id, ...d.data()} as Class)));
            });
        }
    }, [selectedAcademyId]);

    useEffect(() => {
        if (!selectedAcademyId || !selectedClassId) {
            setAssignments([]);
            return;
        }
        const q = query(collection(db, "academyAssignments"), where("academyId", "==", selectedAcademyId), where("classId", "==", selectedClassId));
        const unsub = onSnapshot(q, snap => {
            const data = snap.docs.map(d => ({id: d.id, ...d.data()} as Assignment))
                .filter(assign => assign.createdAt);
            data.sort((a,b) => b.createdAt.toMillis() - a.createdAt.toMillis());
            setAssignments(data);
        });
        return () => unsub();
    }, [selectedAcademyId, selectedClassId]);

    // --- 👇 핸들러 함수 수정 ---
    const handleSaveAssignment = async () => {
        if (!selectedAcademyId || !selectedClassId || !title.trim() || selectedDays.size === 0 || selectedUnitIds.length === 0) {
            alert("모든 필드를 올바르게 입력해주세요.");
            return;
        }

        const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
        const promises = Array.from(selectedDays.entries()).map(([dayIndex, dueDate]) => {
            const newAssignment = {
                academyId: selectedAcademyId,
                classId: selectedClassId,
                title,
                dayTitle: `${dayNames[dayIndex]}요일 과제`, // dayTitle 간소화
                assignedUnitIds: selectedUnitIds,
                dueDate: Timestamp.fromDate(dueDate),
                createdAt: serverTimestamp(),
            };
            return addDoc(collection(db, "academyAssignments"), newAssignment);
        });
        await Promise.all(promises);
        alert(`${promises.length}개의 일일 과제가 등록되었습니다.`);
        setTitle('');
        setSelectedDays(new Map());
        setSelectedUnitIds([]);
    };

    const handleDeleteAssignment = async (id: string) => {
        if (confirm("정말로 이 과제를 삭제하시겠습니까?")) {
            await deleteDoc(doc(db, "academyAssignments", id));
        }
    };

    // 요일 버튼 컴포넌트 수정
    const WeekdayButton = ({ day, dayIndex }: { day: string, dayIndex: number }) => {
        const baseDate = new Date(startDate + 'T00:00:00'); // 시간 정보 추가하여 정확한 날짜 계산
        const startDay = baseDate.getDay();
        
        const date = new Date(baseDate);
        let dayDiff = dayIndex - startDay;
        if (dayDiff < 0) {
            dayDiff += 7; // 다음 주로 넘김
        }
        date.setDate(baseDate.getDate() + dayDiff);

        const isSelected = selectedDays.has(dayIndex);
        
        const handleClick = () => {
            const newDays = new Map(selectedDays);
            if (isSelected) {
                newDays.delete(dayIndex);
            } else {
                newDays.set(dayIndex, date);
            }
            setSelectedDays(newDays);
        }

        return (
            <button 
                onClick={handleClick}
                className={`assignment-btn flex flex-col items-center justify-center p-2 ${isSelected ? 'active' : ''}`}
            >
                <span className="font-semibold">{day}</span>
                <span className="text-xs mt-1">{`${date.getMonth() + 1}/${date.getDate()}`}</span>
            </button>
        );
    };

    if(authLoading) {
        return <LoadingSpinner />;
    }

    return (
        <div className="p-8 overflow-y-auto h-full bg-gray-50">
            <header className="mb-8">
                <h1 className="text-3xl font-bold font-lexend text-slate-800">{isSuperAdmin ? "학원 과제 관리" : "수업 과제 관리"}</h1>
                <p className="mt-2 text-md text-slate-500">날짜를 기반으로 유연하게 과제를 할당합니다.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-lg shadow-sm space-y-4 border border-slate-200">
                    <h2 className="text-xl font-semibold text-slate-800">새 과제 할당</h2>
                    
                    {/* --- 👇 UI 순서 및 내용 변경 --- */}
                    {isSuperAdmin && (
                        <div>
                            <label className="form-label">1. 대상 학원</label>
                            <select value={selectedAcademyId} onChange={e => {setSelectedAcademyId(e.target.value); setSelectedClassId('');}} className="form-select">
                                <option value="">학원 선택</option>
                                {academies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="form-label">1. 대상 수업</label>
                         <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} className="form-select" disabled={!selectedAcademyId || !classes.length}>
                            <option value="">수업 선택</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">2. 과제 시작일</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-input"/>
                    </div>
                    <div>
                        <label className="form-label">3. 과제 이름</label>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 1주차 역학 시스템" className="form-input" />
                    </div>
                    <div>
                      <h3 className="form-label">4. 과제 요일 및 마감일 선택</h3>
                      <div className="grid grid-cols-7 gap-2">
                        {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => <WeekdayButton key={i} day={day} dayIndex={i}/>)}
                      </div>
                    </div>
                    <div>
                        <label className="form-label">5. 과제 범위</label>
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
                    {/* --- 변경 끝 --- */}

                    <button onClick={handleSaveAssignment} className="w-full btn-primary py-3">선택한 요일에 과제 저장하기</button>
                </div>

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