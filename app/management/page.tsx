// /app/management/page.tsx
'use client';

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, writeBatch, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Academy, Class, Student } from "@/types";
import { FiPlus, FiUserCheck, FiUserX, FiTrash2, FiEdit3 } from "react-icons/fi";
import Card from "@/components/ui/Card";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function ManagementPage() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === 'superadmin';
  
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newAcademyName, setNewAcademyName] = useState("");
  const [newAcademyEmail, setNewAcademyEmail] = useState("");
  const [newClassName, setNewClassName] = useState("");
  const [selectedAcademyId, setSelectedAcademyId] = useState('');
  
  // 학생-수업 배정 상태
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [assigningClassId, setAssigningClassId] = useState<string>('');


  // 데이터 로딩
  useEffect(() => {
    if (!session) return;
    setLoading(true);
    const targetAcademyId = isSuperAdmin ? selectedAcademyId : session.user.academyId!;

    let unsubscribers: (() => void)[] = [];
    
    if (isSuperAdmin) {
      unsubscribers.push(onSnapshot(collection(db, "academies"), snap => {
        setAcademies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Academy)))
      }));
    }

    if (targetAcademyId) {
        unsubscribers.push(onSnapshot(query(collection(db, "classes"), where("academyId", "==", targetAcademyId)), snap => {
            setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Class)))
        }));
        unsubscribers.push(onSnapshot(query(collection(db, "students"), where("academyId", "==", targetAcademyId)), snap => {
            setStudents(snap.docs.map(d => ({id: d.id, ...d.data()} as Student)));
            setLoading(false);
        }));
    } else {
        setClasses([]);
        setStudents([]);
        if (isSuperAdmin) setLoading(false);
    }
    
    return () => unsubscribers.forEach(unsub => unsub());
  }, [session, isSuperAdmin, selectedAcademyId]);

  // 핸들러
  const handleAddAcademy = async () => { /* 이전과 동일 */ };
  const handleAddClass = async () => { /* 이전과 동일 */ };
  const handleStudentStatus = async (studentId: string, status: 'active' | 'rejected') => { /* 이전과 동일 */ };
  const handleDeleteStudent = async (studentId: string) => { /* 이전과 동일 */ };

  const handleAssignClass = async (studentId: string) => {
    if (!assigningClassId) return;
    await updateDoc(doc(db, "students", studentId), { classId: assigningClassId });
    setEditingStudentId(null);
    setAssigningClassId('');
  };

  const pendingStudents = students.filter(s => s.status === 'pending');
  const activeStudents = students.filter(s => s.status === 'active');

  return (
    <div className="p-8 overflow-y-auto h-full">
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-lexend text-slate-800">{isSuperAdmin ? "학원 및 학생 관리" : "수업 및 학생 관리"}</h1>
      </header>
      
      {loading ? <LoadingSpinner/> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-6">
            <Card title={isSuperAdmin ? "새 학원 추가" : "새 수업 추가"}>
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
            </Card>

            <Card title={isSuperAdmin ? "학원 목록" : "수업 목록"}>
             <div className="space-y-2 max-h-60 overflow-y-auto">
                {(isSuperAdmin ? academies : classes).length > 0 ? (isSuperAdmin ? academies : classes).map(item => <div key={item.id} className="p-3 bg-gray-50 rounded-lg">{item.name} {isSuperAdmin && <span className="text-sm text-gray-500">- {(item as Academy).adminEmail}</span>}</div>) : <p className="text-center text-sm text-gray-400 py-4">목록이 없습니다.</p>}
             </div>
            </Card>
          </div>
          
          <div className="space-y-6">
             <Card title="신규 학생 승인">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                  {pendingStudents.length > 0 ? pendingStudents.map(student => (
                      <div key={student.id} className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                          <span className="font-medium">{student.studentName}</span>
                          <div className="space-x-3">
                              <button onClick={() => handleStudentStatus(student.id, 'active')} className="text-green-600 hover:text-green-800"><FiUserCheck size={20}/></button>
                              <button onClick={() => handleStudentStatus(student.id, 'rejected')} className="text-red-500 hover:text-red-700"><FiUserX size={20}/></button>
                          </div>
                      </div>
                  )) : <p className="text-sm text-center text-gray-400 py-4">승인 대기중인 학생이 없습니다.</p>}
              </div>
            </Card>
            
            <Card title="등록 학생 관리">
              {isSuperAdmin && (
                  <div className="mb-4">
                      <label className="form-label">학원 선택</label>
                      <select value={selectedAcademyId} onChange={e => setSelectedAcademyId(e.target.value)} className="form-select">
                        <option value="">학생을 볼 학원 선택</option>
                        {academies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                  </div>
              )}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                    {activeStudents.length > 0 ? activeStudents.map(student => (
                        <div key={student.id} className="p-3 bg-gray-50 rounded-lg">
                           <div className="flex justify-between items-center">
                             <div>
                               <p className="font-medium">{student.studentName}</p>
                               <p className="text-xs text-gray-500">
                                 수업: {classes.find(c => c.id === student.classId)?.name || '배정 안됨'}
                               </p>
                             </div>
                             <div className="flex items-center space-x-3">
                                <button onClick={() => { setEditingStudentId(student.id); setAssigningClassId(student.classId || ''); }} className="text-gray-500 hover:text-blue-600"><FiEdit3/></button>
                                <button onClick={() => handleDeleteStudent(student.id)} className="text-gray-500 hover:text-red-600"><FiTrash2/></button>
                             </div>
                           </div>
                           {editingStudentId === student.id && (
                             <div className="mt-3 pt-3 border-t flex space-x-2">
                               <select value={assigningClassId} onChange={e => setAssigningClassId(e.target.value)} className="form-select flex-grow">
                                 <option value="">수업 선택</option>
                                 {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                               </select>
                               <button onClick={() => handleAssignClass(student.id)} className="btn-primary">저장</button>
                               <button onClick={() => setEditingStudentId(null)} className="btn-secondary">취소</button>
                             </div>
                           )}
                        </div>
                    )) : <p className="text-sm text-center text-gray-400 py-4">등록된 학생이 없습니다.</p>}
                </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

