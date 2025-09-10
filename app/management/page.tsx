// /app/management/page.tsx (UI 개선, 역할 분리, 학생 반 이동 기능 추가 최종 버전)
'use client';

import { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Academy, Class, Student } from "@/types";
import { FiPlus, FiUserCheck, FiUserX, FiTrash2, FiRefreshCw, FiMove } from "react-icons/fi";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/context/AuthContext";

export default function ManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';

  // Data States
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [activeStudents, setActiveStudents] = useState<Student[]>([]);
  const [pendingStudents, setPendingStudents] = useState<Student[]>([]);
  
  // UI & Loading States
  const [loading, setLoading] = useState({ page: true, students: false });
  const [selectedAcademyId, setSelectedAcademyId] = useState('');

  // Form States
  const [newAcademyName, setNewAcademyName] = useState("");
  const [newAcademyEmail, setNewAcademyEmail] = useState("");
  const [newClassName, setNewClassName] = useState("");
  const [selectedClassForStudent, setSelectedClassForStudent] = useState<Record<string, string>>({});

  // --- 데이터 로딩 함수들 ---
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(prev => ({ ...prev, page: true }));

    try {
      if (isSuperAdmin) {
        const academyQuery = query(collection(db, "academies"), where("isDeleted", "==", false), orderBy("name"));
        const academySnapshot = await getDocs(academyQuery);
        const academyData = academySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Academy));
        setAcademies(academyData);
        if (academyData.length > 0 && !selectedAcademyId) {
          setSelectedAcademyId(academyData[0].id);
        }
      } else if (user.academyId) {
        setSelectedAcademyId(user.academyId);
      }
    } catch (error) {
      console.error("학원 데이터 로드 실패:", error);
    } finally {
      setLoading(prev => ({ ...prev, page: false }));
    }
  }, [user, isSuperAdmin, selectedAcademyId]);

  const fetchClassesAndStudents = useCallback(async () => {
    if (!selectedAcademyId) {
      setClasses([]);
      setActiveStudents([]);
      setPendingStudents([]);
      return;
    }
    
    setLoading(prev => ({...prev, students: true}));
    try {
      // 반 목록 로딩
      const classQuery = query(collection(db, "classes"), where("academyId", "==", selectedAcademyId), where("isDeleted", "==", false), orderBy("name"));
      const classSnapshot = await getDocs(classQuery);
      setClasses(classSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));

      // 학생 목록 로딩
      const studentsQuery = query(collection(db, "students"), where("academyId", "==", selectedAcademyId), where("isDeleted", "==", false));
      const studentSnapshot = await getDocs(studentsQuery);
      const allStudents = studentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      
      setActiveStudents(allStudents.filter(s => s.status === 'active'));
      setPendingStudents(allStudents.filter(s => s.status === 'pending'));

    } catch(error) {
        console.error("반/학생 목록 로드 실패: ", error);
    } finally {
        setLoading(prev => ({...prev, students: false}));
    }
  }, [selectedAcademyId]);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [authLoading, fetchData]);

  useEffect(() => {
    fetchClassesAndStudents();
  }, [fetchClassesAndStudents]);


  // --- 핸들러 함수들 ---
  const handleAddAcademy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAcademyName.trim() || !newAcademyEmail.trim()) return;
    await addDoc(collection(db, "academies"), { name: newAcademyName, adminEmail: newAcademyEmail, isDeleted: false, createdAt: serverTimestamp() });
    setNewAcademyName(""); setNewAcademyEmail("");
    fetchData();
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim() || !selectedAcademyId) return;
    await addDoc(collection(db, "classes"), { academyId: selectedAcademyId, name: newClassName, isDeleted: false, createdAt: serverTimestamp() });
    setNewClassName("");
    fetchClassesAndStudents();
  };

  const handleDelete = async (collectionName: 'academies' | 'classes', id: string) => {
    const confirmation = collectionName === 'academies' ? "학원을 삭제하면 복구할 수 없습니다. 계속하시겠습니까?" : "반을 삭제하시겠습니까?";
    if (!window.confirm(confirmation)) return;
    await updateDoc(doc(db, collectionName, id), { isDeleted: true });
    if (collectionName === 'academies') fetchData();
    else fetchClassesAndStudents();
  };

  const handleStudentAction = async (studentId: string, action: 'approve' | 'reject' | 'delete') => {
    const classId = selectedClassForStudent[studentId];
    if (action === 'approve' && !classId) {
      alert("학생을 승인하려면 먼저 반을 배정해야 합니다.");
      return;
    }
    
    const confirmationMessage = {
      reject: "정말로 이 학생의 가입 요청을 거절하시겠습니까?",
      delete: "정말로 이 학생을 학원에서 삭제(탈퇴) 처리하시겠습니까?",
    };

    if ((action === 'reject' || action === 'delete') && !window.confirm(confirmationMessage[action])) {
      return;
    }

    const updateData = {
      approve: { status: 'active', classId },
      reject: { isDeleted: true, status: 'rejected' },
      delete: { isDeleted: true, status: 'deleted' },
    }[action];

    await updateDoc(doc(db, "students", studentId), updateData);
    fetchClassesAndStudents();
  };

  // ✅ 학생 반 이동 핸들러
  const handleStudentClassChange = async (studentId: string, newClassId: string) => {
    if(!newClassId) return;
    await updateDoc(doc(db, "students", studentId), { classId: newClassId });
    // UI 즉시 반영
    setActiveStudents(prev => prev.map(s => s.id === studentId ? {...s, classId: newClassId} : s));
  };

  if (authLoading || loading.page) {
    return <div className="flex h-full w-full items-center justify-center"><LoadingSpinner /></div>;
  }

  return (
    <div className="p-8 h-full overflow-y-auto bg-slate-50">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-lexend text-slate-800">
            {isSuperAdmin ? "학원 및 학생 관리" : "수업 및 학생 관리"}
          </h1>
          <p className="mt-2 text-md text-slate-500">
            {isSuperAdmin ? "학원을 등록하고 학원별 정보를 관리합니다." : "소속 학원의 수업과 학생을 관리합니다."}
          </p>
        </div>
        <button onClick={() => {fetchData(); fetchClassesAndStudents();}} className="btn-secondary" title="새로고침">
            <FiRefreshCw className="inline"/>
        </button>
      </header>

      {isSuperAdmin && (
        <div className="mb-6">
          <label className="form-label">관리할 학원 선택</label>
          <select value={selectedAcademyId} onChange={e => setSelectedAcademyId(e.target.value)} className="form-select max-w-xs">
            {academies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Academy & Class Management */}
        <div className="space-y-8">
          {isSuperAdmin && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold mb-4 font-lexend text-slate-700">학원 관리</h2>
              <form onSubmit={handleAddAcademy} className="mb-4 space-y-3">
                <input type="text" value={newAcademyName} onChange={e => setNewAcademyName(e.target.value)} placeholder="새 학원 이름" className="form-input" />
                <input type="email" value={newAcademyEmail} onChange={e => setNewAcademyEmail(e.target.value)} placeholder="관리자 이메일" className="form-input" />
                <button type="submit" className="btn-primary w-full"><FiPlus className="inline mr-2"/>학원 추가</button>
              </form>
            </div>
          )}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold mb-4 font-lexend text-slate-700">반 관리</h2>
            <form onSubmit={handleAddClass} className="flex gap-2 mb-4">
              <input type="text" value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="새 반 이름" className="form-input" disabled={!selectedAcademyId} />
              <button type="submit" className="btn-primary" disabled={!selectedAcademyId}><FiPlus/></button>
            </form>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {classes.map(c => (
                <div key={c.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-slate-700">{c.name}</span>
                  <button onClick={() => handleDelete('classes', c.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-full" title="반 삭제"><FiTrash2 /></button>
                </div>
              ))}
              {classes.length === 0 && <p className="text-sm text-center text-gray-400 py-4">등록된 반이 없습니다.</p>}
            </div>
          </div>
        </div>

        {/* Right Column: Student Management */}
        <div className="space-y-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold mb-4 font-lexend text-slate-700">가입 대기 학생</h2>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                    {loading.students ? <LoadingSpinner/> : pendingStudents.length > 0 ? pendingStudents.map(student => (
                        <div key={student.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="font-medium text-yellow-800">{student.studentName}</span>
                                <div className="space-x-1">
                                    <button onClick={() => handleStudentAction(student.id, 'approve')} className="p-2 text-green-600 hover:bg-green-100 rounded-full" title="승인"><FiUserCheck /></button>
                                    <button onClick={() => handleStudentAction(student.id, 'reject')} className="p-2 text-red-600 hover:bg-red-100 rounded-full" title="거절"><FiUserX /></button>
                                </div>
                            </div>
                            <select
                                value={selectedClassForStudent[student.id] || ""}
                                onChange={(e) => setSelectedClassForStudent(prev => ({...prev, [student.id]: e.target.value}))}
                                className="form-select text-sm"
                            >
                                <option value="">배정할 반을 선택하세요</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    )) : <p className="text-sm text-center text-gray-400 py-4">가입 대기 중인 학생이 없습니다.</p>}
                </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold mb-4 font-lexend text-slate-700">등록 학생 관리</h2>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                    {loading.students ? <LoadingSpinner/> : activeStudents.length > 0 ? activeStudents.map(student => (
                        <div key={student.id} className="grid grid-cols-3 items-center gap-2 p-3 bg-gray-50 rounded-lg">
                            <span className="font-medium text-slate-700 col-span-1">{student.studentName}</span>
                            {/* ✅ 학생 반 이동 기능 UI */}
                            <div className="col-span-1">
                                <select 
                                    value={student.classId || ""}
                                    onChange={(e) => handleStudentClassChange(student.id, e.target.value)}
                                    className="form-select text-sm w-full"
                                >
                                    <option value="">반 미배정</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="text-right col-span-1">
                                <button onClick={() => handleStudentAction(student.id, 'delete')} className="p-2 text-red-500 hover:bg-red-100 rounded-full" title="학생 삭제"><FiTrash2 /></button>
                            </div>
                        </div>
                    )) : <p className="text-sm text-center text-gray-400 py-4">등록된 학생이 없습니다.</p>}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}