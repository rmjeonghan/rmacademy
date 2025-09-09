// /app/management/page.tsx
'use client';

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, writeBatch, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Academy, Class, Student } from "@/types";
import { FiPlus, FiUserCheck, FiUserX, FiTrash2 } from "react-icons/fi";

export default function ManagementPage() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === 'superadmin';
  
  // States
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  // Form states
  const [newAcademyName, setNewAcademyName] = useState("");
  const [newAcademyEmail, setNewAcademyEmail] = useState("");
  const [newClassName, setNewClassName] = useState("");
  const [selectedAcademyIdForStudents, setSelectedAcademyIdForStudents] = useState('');

  // Data listeners
  useEffect(() => {
    if (!session) return;
    
    // 학원/수업 목록 로드
    if (isSuperAdmin) {
      onSnapshot(query(collection(db, "academies")), snap => setAcademies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Academy))));
    } else {
      onSnapshot(query(collection(db, "classes"), where("academyId", "==", session.user.academyId!)), snap => setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Class))));
    }
    
    // 학생 목록 로드
    const targetAcademyId = isSuperAdmin ? selectedAcademyIdForStudents : session.user.academyId;
    if (targetAcademyId) {
        const q = query(collection(db, "students"), where("academyId", "==", targetAcademyId));
        const unsub = onSnapshot(q, snap => setStudents(snap.docs.map(d => ({id: d.id, ...d.data()} as Student))));
        return () => unsub();
    } else {
        setStudents([]);
    }
  }, [session, isSuperAdmin, selectedAcademyIdForStudents]);

  // Handlers
  const handleAddAcademy = async () => {
    if (!newAcademyName.trim() || !newAcademyEmail.trim()) return alert("학원 이름과 관리자 이메일을 모두 입력해주세요.");
    await addDoc(collection(db, "academies"), { name: newAcademyName, adminEmail: newAcademyEmail, createdAt: serverTimestamp(), isDeleted: false });
    setNewAcademyName(""); setNewAcademyEmail("");
  };

  const handleAddClass = async () => {
    if (!newClassName.trim() || !session?.user.academyId) return;
    await addDoc(collection(db, "classes"), { academyId: session.user.academyId, name: newClassName, createdAt: serverTimestamp(), isDeleted: false });
    setNewClassName("");
  };

  const handleStudentStatus = async (studentId: string, status: 'active' | 'rejected') => {
      await updateDoc(doc(db, "students", studentId), { status });
  };
  
  const handleDeleteStudent = async (studentId: string) => {
      if (!confirm("학생의 모든 정보(제출 결과 포함)가 영구적으로 삭제됩니다. 계속하시겠습니까?")) return;
      // 관련된 제출 결과 삭제
      const subsQuery = query(collection(db, "submissions"), where("userId", "==", studentId));
      const subsSnap = await getDocs(subsQuery);
      const batch = writeBatch(db);
      subsSnap.forEach(d => batch.delete(d.ref));
      // 학생 삭제
      batch.delete(doc(db, "students", studentId));
      await batch.commit();
  };

  const pendingStudents = students.filter(s => s.status === 'pending');
  const activeStudents = students.filter(s => s.status === 'active');

  return (
    <div className="p-8 overflow-y-auto h-full">
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-lexend text-slate-800">{isSuperAdmin ? "학원 및 학생 관리" : "수업 및 학생 관리"}</h1>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 왼쪽 패널: 학원/수업 및 승인 관리 */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4">{isSuperAdmin ? "새 학원 추가" : "새 수업 추가"}</h2>
            {isSuperAdmin ? (
              <div className="space-y-3">
                 <input type="text" value={newAcademyName} onChange={e => setNewAcademyName(e.target.value)} placeholder="학원 이름" className="w-full form-input" />
                 <input type="email" value={newAcademyEmail} onChange={e => setNewAcademyEmail(e.target.value)} placeholder="관리자 이메일" className="w-full form-input" />
                 <button onClick={handleAddAcademy} className="w-full btn-primary"><FiPlus className="inline mr-2" /> 추가</button>
              </div>
            ) : (
              <div className="flex space-x-2">
                <input type="text" value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="수업 이름" className="flex-grow form-input" />
                <button onClick={handleAddClass} className="btn-primary"><FiPlus className="inline mr-2" /> 추가</button>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
             <h2 className="text-xl font-semibold mb-4">{isSuperAdmin ? "학원 목록" : "수업 목록"}</h2>
             <div className="space-y-2">
                {(isSuperAdmin ? academies : classes).map(item => <div key={item.id} className="p-2 bg-gray-50 rounded">{item.name} {isSuperAdmin && `(${(item as Academy).adminEmail})`}</div>)}
             </div>
          </div>
          
           <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4">신규 학생 승인</h2>
            <div className="space-y-2">
                {pendingStudents.length > 0 ? pendingStudents.map(student => (
                    <div key={student.id} className="flex justify-between items-center p-2 bg-blue-50 rounded">
                        <span>{student.studentName}</span>
                        <div className="space-x-2">
                            <button onClick={() => handleStudentStatus(student.id, 'active')} className="text-green-600"><FiUserCheck/></button>
                            <button onClick={() => handleStudentStatus(student.id, 'rejected')} className="text-red-600"><FiUserX/></button>
                        </div>
                    </div>
                )) : <p className="text-sm text-center text-gray-500">승인 대기중인 학생이 없습니다.</p>}
            </div>
          </div>
        </div>
        
        {/* 오른쪽 패널: 학생 관리 */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">학생 관리</h2>
          {isSuperAdmin && (
              <div className="mb-4">
                  <label className="form-label">학원 선택</label>
                  <select value={selectedAcademyIdForStudents} onChange={e => setSelectedAcademyIdForStudents(e.target.value)} className="form-select">
                    <option value="">학생을 볼 학원 선택</option>
                    {academies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
              </div>
          )}
           <div className="space-y-2">
                {activeStudents.length > 0 ? activeStudents.map(student => (
                    <div key={student.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span>{student.studentName}</span>
                        <button onClick={() => handleDeleteStudent(student.id)} className="text-gray-400 hover:text-red-600"><FiTrash2/></button>
                    </div>
                )) : <p className="text-sm text-center text-gray-500">등록된 학생이 없습니다.</p>}
            </div>
        </div>
      </div>
    </div>
  );
}

