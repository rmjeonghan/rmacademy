// /app/management/page.tsx (수정 완료)
'use client';

import { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc, orderBy, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Academy, Class, Student } from "@/types";
import { FiPlus, FiUserCheck, FiUserX, FiTrash2, FiRefreshCw, FiAlertTriangle, FiRotateCcw } from "react-icons/fi";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/context/AuthContext";

interface AcademyWithDetails extends Academy {
  classCount: number;
  studentCount: number;
}

export default function ManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';

  // Data States
  const [academies, setAcademies] = useState<AcademyWithDetails[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [activeStudents, setActiveStudents] = useState<Student[]>([]);
  const [pendingStudents, setPendingStudents] = useState<Student[]>([]);

  // UI & Loading States
  const [loading, setLoading] = useState({ page: true, students: false, academies: false });
  const [selectedAcademyId, setSelectedAcademyId] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);

  // Form States
  const [newAcademyName, setNewAcademyName] = useState("");
  const [newAcademyEmail, setNewAcademyEmail] = useState("");
  const [newClassName, setNewClassName] = useState("");
  const [selectedClassForStudent, setSelectedClassForStudent] = useState<Record<string, string>>({});

  // --- 데이터 로딩 함수들 ---
  const fetchAcademiesWithDetails = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoading(prev => ({ ...prev, academies: true }));
    try {
      const academyQuery = query(collection(db, "academies"), where("isDeleted", "==", showDeleted), orderBy("name"));
      const academySnapshot = await getDocs(academyQuery);
      const academyData = await Promise.all(academySnapshot.docs.map(async (academyDoc) => {
        const academy = { id: academyDoc.id, ...academyDoc.data() } as Academy;
        const classQuery = query(collection(db, "classes"), where("academyId", "==", academy.id), where("isDeleted", "==", false));
        const classSnapshot = await getDocs(classQuery);
        const studentQuery = query(collection(db, "students"), where("academyId", "==", academy.id), where("isDeleted", "==", false));
        const studentSnapshot = await getDocs(studentQuery);
        return { ...academy, classCount: classSnapshot.size, studentCount: studentSnapshot.size };
      }));
      
      setAcademies(academyData);
      if (academyData.length > 0 && !selectedAcademyId && !showDeleted) {
        setSelectedAcademyId(academyData[0].id);
      }
    } catch (error) {
      console.error("학원 상세 데이터 로드 실패:", error);
    } finally {
      setLoading(prev => ({ ...prev, academies: false }));
    }
  }, [isSuperAdmin, selectedAcademyId, showDeleted]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(prev => ({ ...prev, page: true }));
    try {
      if (isSuperAdmin) {
        await fetchAcademiesWithDetails();
      } else if (user.academyId) {
        setSelectedAcademyId(user.academyId);
      }
    } catch (error) {
      console.error("초기 데이터 로드 실패:", error);
    } finally {
      setLoading(prev => ({ ...prev, page: false }));
    }
  }, [user, isSuperAdmin, fetchAcademiesWithDetails]);

  const fetchClassesAndStudents = useCallback(async () => {
    if (!selectedAcademyId) {
      setClasses([]);
      setActiveStudents([]);
      setPendingStudents([]);
      return;
    }
    
    setLoading(prev => ({...prev, students: true}));
    try {
      const classQuery = query(collection(db, "classes"), where("academyId", "==", selectedAcademyId), where("isDeleted", "==", showDeleted), orderBy("name"));
      const classSnapshot = await getDocs(classQuery);
      setClasses(classSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));

      if (!showDeleted) {
        const studentsQuery = query(collection(db, "students"), where("academyId", "==", selectedAcademyId), where("isDeleted", "==", false));
        const studentSnapshot = await getDocs(studentsQuery);
        const allStudents = studentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
        
        setActiveStudents(allStudents.filter(s => s.status === 'active'));
        setPendingStudents(allStudents.filter(s => s.status === 'pending'));
      } else {
        const deletedStudentsQuery = query(collection(db, "students"), where("academyId", "==", selectedAcademyId), where("isDeleted", "==", true));
        const studentSnapshot = await getDocs(deletedStudentsQuery);
        setActiveStudents(studentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
        setPendingStudents([]);
      }

    } catch(error) {
        console.error("반/학생 목록 로드 실패: ", error);
    } finally {
        setLoading(prev => ({...prev, students: false}));
    }
  }, [selectedAcademyId, showDeleted]);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [authLoading, fetchData, showDeleted]);

  useEffect(() => {
    fetchClassesAndStudents();
  }, [fetchClassesAndStudents, showDeleted]);

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
    if (isSuperAdmin) fetchAcademiesWithDetails();
  };
  
  const handleDelete = async (collectionName: 'academies' | 'classes' | 'students', id: string, type: 'soft' | 'hard') => {
    const messages = {
      academies: {
        soft: "학원을 삭제(숨김) 처리하시겠습니까? 나중에 복구할 수 있습니다.",
        hard: "학원을 영구적으로 삭제합니다. 관련된 모든 반, 학생 정보가 함께 삭제되며 복구할 수 없습니다. 계속하시겠습니까?"
      },
      classes: {
        soft: "반을 삭제(숨김) 처리하시겠습니까?",
        hard: "반을 영구적으로 삭제합니다. 소속된 학생들의 반 정보가 초기화됩니다. 계속하시겠습니까?"
      },
      students: {
        soft: "학생을 삭제(탈퇴) 처리하시겠습니까?",
        hard: "학생 정보를 영구적으로 삭제하시겠습니까? 복구할 수 없습니다."
      }
    };

    if (!window.confirm(messages[collectionName][type])) return;

    try {
      if (type === 'soft') {
        await updateDoc(doc(db, collectionName, id), { isDeleted: true });
      } else { // Hard delete
        if (collectionName === 'academies') {
            const batch = writeBatch(db);
            const classQuery = query(collection(db, "classes"), where("academyId", "==", id));
            const classSnapshot = await getDocs(classQuery);
            classSnapshot.forEach(doc => batch.delete(doc.ref));

            const studentQuery = query(collection(db, "students"), where("academyId", "==", id));
            const studentSnapshot = await getDocs(studentQuery);
            studentSnapshot.forEach(doc => batch.delete(doc.ref));

            batch.delete(doc(db, "academies", id));
            await batch.commit();
        } else if (collectionName === 'classes') {
            const batch = writeBatch(db);
            const studentQuery = query(collection(db, "students"), where("classId", "==", id));
            const studentSnapshot = await getDocs(studentQuery);
            studentSnapshot.forEach(studentDoc => {
                batch.update(studentDoc.ref, { classId: "" });
            });
            batch.delete(doc(db, "classes", id));
            await batch.commit();
        } else {
            await deleteDoc(doc(db, collectionName, id));
        }
      }

      if (collectionName === 'academies') {
        fetchData();
      } else {
        fetchClassesAndStudents();
        if (isSuperAdmin) fetchAcademiesWithDetails();
      }
    } catch (error) {
        console.error(`${collectionName} 삭제 실패:`, error);
        alert("삭제 중 오류가 발생했습니다.");
    }
  };

  const handleRestore = async (collectionName: 'academies' | 'classes' | 'students', id: string) => {
    if (!window.confirm("이 항목을 복구하시겠습니까?")) return;
    try {
      await updateDoc(doc(db, collectionName, id), { isDeleted: false });
      
      if (collectionName === 'academies') {
        fetchData();
      } else {
        fetchClassesAndStudents();
      }
    } catch (error) {
      console.error(`${collectionName} 복구 실패:`, error);
      alert("복구 중 오류가 발생했습니다.");
    }
  };

  // ✅ *** 수정된 부분 시작 ***
  const handleStudentAction = async (studentId: string, action: 'approve' | 'reject') => {
    if (action === 'approve') {
      const classIdToAssign = selectedClassForStudent[studentId];
      // 반이 선택되었는지 확인
      if (!classIdToAssign) {
        alert("먼저 배정할 반을 선택해야 합니다.");
        return;
      }
      
      if (window.confirm("이 학생의 가입을 승인하시겠습니까?")) {
        try {
          // 학생의 상태를 'active'로 변경하고 선택된 반 ID를 할당
          await updateDoc(doc(db, "students", studentId), {
            status: 'active',
            classId: classIdToAssign,
          });
          // 로컬 상태에서도 제거
          setSelectedClassForStudent(prev => {
            const newState = {...prev};
            delete newState[studentId];
            return newState;
          });
          // 목록 새로고침
          fetchClassesAndStudents();
          if (isSuperAdmin) fetchAcademiesWithDetails();
        } catch (error) {
          console.error("학생 승인 실패:", error);
          alert("학생 승인 중 오류가 발생했습니다.");
        }
      }
    } else if (action === 'reject') {
      if (window.confirm("이 학생의 가입 요청을 거절하시겠습니까? 해당 정보는 영구적으로 삭제됩니다.")) {
        try {
          // 학생 문서를 데이터베이스에서 삭제
          await deleteDoc(doc(db, "students", studentId));
          // 목록 새로고침
          fetchClassesAndStudents();
          if (isSuperAdmin) fetchAcademiesWithDetails();
        } catch (error) {
          console.error("학생 거절(삭제) 실패:", error);
          alert("학생 거절 처리 중 오류가 발생했습니다.");
        }
      }
    }
  };
  // ✅ *** 수정된 부분 끝 ***

  const handleStudentClassChange = async (studentId: string, newClassId: string) => {
    if(!newClassId) return;
    try {
      await updateDoc(doc(db, "students", studentId), { classId: newClassId });
      // 로컬 상태 즉시 업데이트
      setActiveStudents(prev => prev.map(s => s.id === studentId ? {...s, classId: newClassId} : s));
    } catch (error) {
      console.error("학생 반 변경 실패: ", error);
      alert("학생 반 변경 중 오류가 발생했습니다.");
    }
  };

  if (authLoading || loading.page) {
    return <div className="flex h-full w-full items-center justify-center"><LoadingSpinner /></div>;
  }

  return (
    <div className="p-8 h-full overflow-y-auto bg-slate-50">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-lexend text-slate-800">
            {isSuperAdmin ? "통합 관리" : "수업 및 학생 관리"}
          </h1>
          <p className="mt-2 text-md text-slate-500">
            {isSuperAdmin ? "전체 학원 현황을 보고 관리합니다." : "소속 학원의 수업과 학생을 관리합니다."}
          </p>
        </div>
        <button onClick={() => {fetchData(); fetchClassesAndStudents();}} className="btn-secondary" title="새로고침">
            <FiRefreshCw className="inline"/>
        </button>
      </header>
      
      <div className="mb-6 flex items-center justify-end">
          <label htmlFor="showDeleted" className="mr-2 text-sm font-medium text-slate-600">삭제된 항목 보기</label>
          <input 
              type="checkbox" 
              id="showDeleted"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
      </div>

      {isSuperAdmin && (
        <>
          <div className="mb-8 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold mb-4 font-lexend text-slate-700">{showDeleted ? '삭제된 학원' : '학원 현황'}</h2>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {loading.academies ? <LoadingSpinner/> : academies.map(a => (
                <div key={a.id} className="grid grid-cols-4 gap-4 items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-semibold text-slate-800 col-span-1">{a.name}</span>
                  {!showDeleted && (
                    <>
                      <div className="text-sm text-slate-500">반 {a.classCount}개</div>
                      <div className="text-sm text-slate-500">학생 {a.studentCount}명</div>
                    </>
                  )}
                  <div className={`flex justify-end space-x-2 ${showDeleted ? 'col-start-4' : ''}`}>
                    {showDeleted ? (
                      <>
                        <button onClick={() => handleRestore('academies', a.id)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full" title="학원 복구"><FiRotateCcw /></button>
                        <button onClick={() => handleDelete('academies', a.id, 'hard')} className="p-2 text-red-600 hover:bg-red-100 rounded-full" title="학원 영구 삭제"><FiAlertTriangle /></button>
                      </>
                    ) : (
                      <button onClick={() => handleDelete('academies', a.id, 'soft')} className="p-2 text-yellow-600 hover:bg-yellow-100 rounded-full" title="학원 숨기기"><FiTrash2 /></button>
                    )}
                  </div>
                </div>
              ))}
              {academies.length === 0 && !loading.academies && <p className="text-sm text-center text-gray-400 py-4">{showDeleted ? '삭제된 학원이 없습니다.' : '등록된 학원이 없습니다.'}</p>}
            </div>
          </div>
        
          {!showDeleted && (
            <div className="mb-6">
              <label className="form-label">관리할 학원 선택</label>
              <select value={selectedAcademyId} onChange={e => setSelectedAcademyId(e.target.value)} className="form-select max-w-xs">
                 <option value="">학원을 선택하세요</option>
                {academies.filter(a => !a.isDeleted).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          {isSuperAdmin && !showDeleted && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold mb-4 font-lexend text-slate-700">신규 학원 등록</h2>
              <form onSubmit={handleAddAcademy} className="mb-4 space-y-3">
                <input type="text" value={newAcademyName} onChange={e => setNewAcademyName(e.target.value)} placeholder="새 학원 이름" className="form-input" />
                <input type="email" value={newAcademyEmail} onChange={e => setNewAcademyEmail(e.target.value)} placeholder="관리자 이메일" className="form-input" />
                <button type="submit" className="btn-primary w-full"><FiPlus className="inline mr-2"/>학원 추가</button>
              </form>
            </div>
          )}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold mb-4 font-lexend text-slate-700">{showDeleted ? '삭제된 반' : '반 관리'}</h2>
            {!showDeleted && (
              <form onSubmit={handleAddClass} className="flex gap-2 mb-4">
                <input type="text" value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="새 반 이름" className="form-input" disabled={!selectedAcademyId} />
                <button type="submit" className="btn-primary" disabled={!selectedAcademyId}><FiPlus/></button>
              </form>
            )}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {classes.map(c => (
                <div key={c.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-slate-700">{c.name}</span>
                  <div className="flex space-x-2">
                    {showDeleted ? (
                        <>
                           <button onClick={() => handleRestore('classes', c.id)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full" title="반 복구"><FiRotateCcw /></button>
                           <button onClick={() => handleDelete('classes', c.id, 'hard')} className="p-2 text-red-600 hover:bg-red-100 rounded-full" title="반 영구 삭제"><FiAlertTriangle /></button>
                        </>
                    ) : (
                        <button onClick={() => handleDelete('classes', c.id, 'soft')} className="p-2 text-yellow-600 hover:bg-yellow-100 rounded-full" title="반 숨기기"><FiTrash2 /></button>
                    )}
                  </div>
                </div>
              ))}
              {classes.length === 0 && <p className="text-sm text-center text-gray-400 py-4">{showDeleted ? '삭제된 반이 없습니다.' : '등록된 반이 없습니다.'}</p>}
            </div>
          </div>
        </div>

        <div className="space-y-8">
            {!showDeleted && (
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
            )}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold mb-4 font-lexend text-slate-700">{showDeleted ? '삭제된 학생' : '등록 학생 관리'}</h2>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                    {loading.students ? <LoadingSpinner/> : activeStudents.length > 0 ? activeStudents.map(student => (
                        <div key={student.id} className="grid grid-cols-3 items-center gap-2 p-3 bg-gray-50 rounded-lg">
                            <span className="font-medium text-slate-700 col-span-1">{student.studentName}</span>
                             <div className="col-span-1">
                                {!showDeleted && (
                                    <select 
                                        value={student.classId || ""}
                                        onChange={(e) => handleStudentClassChange(student.id, e.target.value)}
                                        className="form-select text-sm w-full"
                                    >
                                        <option value="">반 미배정</option>
                                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                )}
                            </div>
                            <div className="text-right col-span-1 flex justify-end space-x-2">
                               {showDeleted ? (
                                   <>
                                     <button onClick={() => handleRestore('students', student.id)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full" title="학생 복구"><FiRotateCcw /></button>
                                     <button onClick={() => handleDelete('students', student.id, 'hard')} className="p-2 text-red-600 hover:bg-red-100 rounded-full" title="학생 영구 삭제"><FiAlertTriangle /></button>
                                   </>
                               ) : (
                                  <button onClick={() => handleDelete('students', student.id, 'soft')} className="p-2 text-yellow-600 hover:bg-yellow-100 rounded-full" title="학생 숨기기 (탈퇴)"><FiTrash2 /></button>
                               )}
                            </div>
                        </div>
                    )) : <p className="text-sm text-center text-gray-400 py-4">{showDeleted ? '삭제된 학생이 없습니다.' : '등록된 학생이 없습니다.'}</p>}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}