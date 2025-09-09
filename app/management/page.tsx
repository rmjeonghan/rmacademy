// /app/management/page.tsx
'use client';

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, writeBatch, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Academy, Class, Student } from "@/types";
import { FiPlus, FiUserCheck, FiUserX, FiTrash2, FiEdit, FiSave, FiX } from "react-icons/fi";

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
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");

  // Data listeners
  useEffect(() => {
    if (!session) return;
    
    // 학원/수업 목록 로드
    if (isSuperAdmin) {
      const q = query(collection(db, "academies"), where("isDeleted", "==", false));
      const unsubscribe = onSnapshot(q, snap => setAcademies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Academy))));
      return () => unsubscribe();
    } else if (session.user.academyId) {
      const q = query(collection(db, "classes"), where("academyId", "==", session.user.academyId), where("isDeleted", "==", false));
      const unsubscribe = onSnapshot(q, snap => setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Class))));
      return () => unsubscribe();
    }
  }, [session, isSuperAdmin]);

  useEffect(() => {
    // 학생 목록 로드
    const targetAcademyId = isSuperAdmin ? selectedAcademyIdForStudents : session?.user.academyId;
    if (targetAcademyId) {
        const q = query(collection(db, "students"), where("academyId", "==", targetAcademyId), where("isDeleted", "==", false));
        const unsub = onSnapshot(q, snap => setStudents(snap.docs.map(d => ({id: d.id, ...d.data()} as Student))));
        return () => unsub();
    } else {
        setStudents([]);
    }
  }, [session, isSuperAdmin, selectedAcademyIdForStudents]);

  // Handlers
  const handleAddAcademy = async () => {
    if (!newAcademyName.trim() || !newAcademyEmail.trim()) return alert("학원 이름과 관리자 이메일을 모두 입력해주세요.");
    await addDoc(collection(db, "academies"), { 
      name: newAcademyName, 
      adminEmail: newAcademyEmail, 
      createdAt: serverTimestamp(), 
      isDeleted: false 
    });
    setNewAcademyName(""); 
    setNewAcademyEmail("");
  };

  const handleAddClass = async () => {
    if (!newClassName.trim() || !session?.user.academyId) return;
    await addDoc(collection(db, "classes"), { 
      academyId: session.user.academyId, 
      name: newClassName, 
      createdAt: serverTimestamp(), 
      isDeleted: false 
    });
    setNewClassName("");
  };

  const handleStudentStatus = async (studentId: string, status: 'active' | 'rejected') => {
      const studentRef = doc(db, "students", studentId);
      if (status === 'rejected') {
        await updateDoc(studentRef, { status, academyId: null }); // 거절 시 학원 정보 제거
      } else {
        await updateDoc(studentRef, { status });
      }
  };
  
  const handleDeleteStudent = async (studentId: string) => {
      if (!confirm("학생의 모든 정보(제출 결과 포함)가 영구적으로 삭제됩니다. 계속하시겠습니까?")) return;
      
      const batch = writeBatch(db);
      // 관련된 제출 결과 삭제
      const subsQuery = query(collection(db, "submissions"), where("userId", "==", studentId));
      const subsSnap = await getDocs(subsQuery);
      subsSnap.forEach(d => batch.delete(d.ref));
      
      // 학생 삭제
      batch.delete(doc(db, "students", studentId));
      
      await batch.commit();
  };

  const handleDeleteItem = async (type: 'academy' | 'class', id: string) => {
    if (!confirm(`정말로 삭제하시겠습니까? 관련된 하위 데이터는 복구할 수 없습니다.`)) return;
    const collectionName = type === 'academy' ? "academies" : "classes";
    await updateDoc(doc(db, collectionName, id), { isDeleted: true });
  }

  const handleEditItem = (id: string, name: string) => {
    setEditingItemId(id);
    setEditingItemName(name);
  };

  const handleUpdateItem = async (type: 'academy' | 'class') => {
    if (!editingItemId || !editingItemName.trim()) return;
    const collectionName = type === 'academy' ? "academies" : "classes";
    await updateDoc(doc(db, collectionName, editingItemId), { name: editingItemName });
    setEditingItemId(null);
    setEditingItemName("");
  };

  const pendingStudents = students.filter(s => s.status === 'pending');
  const activeStudents = students.filter(s => s.status === 'active');

  const renderItemList = (items: (Academy | Class)[], type: 'academy' | 'class') => (
    <div className="space-y-3"> {/* 간격 조정 */}
      {items.map(item => (
        <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded-lg"> {/* 카드 디자인 */}
          {editingItemId === item.id ? (
            <input 
              type="text" 
              value={editingItemName} 
              onChange={(e) => setEditingItemName(e.target.value)} 
              className="form-input py-1 text-sm"
            />
          ) : (
            <span className="text-slate-700">{item.name} {type === 'academy' && `(${(item as Academy).adminEmail})`}</span>
          )}
          <div className="space-x-2">
            {editingItemId === item.id ? (
              <>
                <button onClick={() => handleUpdateItem(type)} className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-100 transition-colors"><FiSave/></button>
                <button onClick={() => setEditingItemId(null)} className="text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100 transition-colors"><FiX/></button>
              </>
            ) : (
              <>
                <button onClick={() => handleEditItem(item.id, item.name)} className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-100 transition-colors"><FiEdit/></button>
                <button onClick={() => handleDeleteItem(type, item.id)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-100 transition-colors"><FiTrash2/></button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-8 overflow-y-auto h-full bg-gray-50">
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-lexend text-slate-800">{isSuperAdmin ? "학원 및 학생 관리" : "수업 및 학생 관리"}</h1>
        <p className="mt-2 text-md text-slate-500">
          {isSuperAdmin ? "학원과 학생 정보를 관리하고 신규 학생 승인을 처리합니다." : "소속 수업과 학생 정보를 관리하고 신규 학생 승인을 처리합니다."}
        </p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 왼쪽 패널: 학원/수업 및 승인 관리 */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <h2 className="text-xl font-semibold mb-4 text-slate-800">{isSuperAdmin ? "새 학원 추가" : "새 수업 추가"}</h2>
            {isSuperAdmin ? (
              <div className="space-y-3">
                 <div>
                    <label className="form-label">학원 이름</label>
                    <input type="text" value={newAcademyName} onChange={e => setNewAcademyName(e.target.value)} placeholder="학원 이름" className="form-input" />
                 </div>
                 <div>
                    <label className="form-label">관리자 이메일</label>
                    <input type="email" value={newAcademyEmail} onChange={e => setNewAcademyEmail(e.target.value)} placeholder="관리자 이메일 (로그인에 사용)" className="form-input" />
                 </div>
                 <button onClick={handleAddAcademy} className="w-full btn-primary"><FiPlus className="inline mr-2" /> {isSuperAdmin ? "학원 추가" : "수업 추가"}</button>
              </div>
            ) : (
              <div className="flex space-x-2">
                <input type="text" value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="수업 이름" className="flex-grow form-input" />
                <button onClick={handleAddClass} className="btn-primary"><FiPlus className="inline mr-2" /> 추가</button>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
             <h2 className="text-xl font-semibold mb-4 text-slate-800">{isSuperAdmin ? "등록된 학원 목록" : "등록된 수업 목록"}</h2>
             {isSuperAdmin ? renderItemList(academies, 'academy') : renderItemList(classes, 'class')}
          </div>
          
           <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <h2 className="text-xl font-semibold mb-4 text-slate-800">신규 학생 승인 대기</h2>
            <div className="space-y-2">
                {pendingStudents.length > 0 ? pendingStudents.map(student => (
                    <div key={student.id} className="flex justify-between items-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <span className="font-medium text-slate-700">{student.studentName}</span>
                        <div className="space-x-2">
                            <button onClick={() => handleStudentStatus(student.id, 'active')} className="p-2 text-green-600 hover:bg-green-100 rounded-full transition-colors" title="승인"><FiUserCheck/></button>
                            <button onClick={() => handleStudentStatus(student.id, 'rejected')} className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-colors" title="거절"><FiUserX/></button>
                        </div>
                    </div>
                )) : <p className="text-sm text-center text-gray-500 py-4">승인 대기중인 학생이 없습니다.</p>}
            </div>
          </div>
        </div>
        
        {/* 오른쪽 패널: 학생 관리 */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h2 className="text-xl font-semibold mb-4 text-slate-800">학생 목록 관리</h2>
          {isSuperAdmin && (
              <div className="mb-4">
                  <label className="form-label">학원 선택</label>
                  <select value={selectedAcademyIdForStudents} onChange={e => setSelectedAcademyIdForStudents(e.target.value)} className="form-select">
                    <option value="">학생을 볼 학원 선택</option>
                    {academies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
              </div>
          )}
           <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto"> {/* 높이 제한 및 스크롤 */}
                {activeStudents.length > 0 ? activeStudents.map(student => (
                    <div key={student.id} className="flex justify-between items-center p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <span className="font-medium text-slate-700">{student.studentName}</span>
                        <button onClick={() => handleDeleteStudent(student.id)} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full transition-colors" title="학생 삭제"><FiTrash2/></button>
                    </div>
                )) : <p className="text-sm text-center text-gray-500 py-4">등록된 학생이 없습니다.</p>}
            </div>
        </div>
      </div>
    </div>
  );
}