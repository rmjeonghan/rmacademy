// /types/index.ts
import { Timestamp } from "firebase/firestore";

// NextAuth 세션에 추가할 커스텀 타입
declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: "superadmin" | "academyadmin";
      academyId?: string;
      academyName?: string;
    };
  }
}

// Firestore 데이터 모델
export interface Academy {
  id: string;
  name: string;
  adminEmail: string; // 학원 관리자 이메일
  createdAt: Timestamp;
  isDeleted: boolean;
}

export interface Class {
  id:string;
  academyId: string; // 소속된 학원 ID
  name: string;
  createdAt: Timestamp;
  isDeleted: boolean;
}

export interface Student {
  id: string;
  academyId: string; // 소속된 학원 ID
  classId?: string; // 소속된 수업 ID (선택)
  studentName: string;
  status: 'pending' | 'active' | 'rejected';
  isDeleted: boolean;
  createdAt: Timestamp;
}

export interface Assignment {
  id: string;
  academyId: string;
  classId: string; // 수업에 할당
  title: string;
  dayTitle: string;
  assignedUnitIds: string[];
  dueDate: Timestamp;
  week: number;
  createdAt: Timestamp;
}

export interface Submission {
    id: string;
    userId: string;
    assignmentId?: string; // 과제인 경우
    mainChapter: string;
    questionIds: string[];
    answers: (number | null)[];
    score: number;
    createdAt: Timestamp;
    isDeleted: boolean;
}

// 문제 은행 및 단원 구조
export interface Question {
    id: string;
    questionText: string;
    choices: string[];
    answerIndex: number;
    unitId: string; // 소속된 소단원 ID
}

export interface Chapter {
    id: string;
    name: string;
    subChapters: string[]; // 예: ["1-1-1: 시간과 공간", ...]
}

export interface Curriculum {
    [subject: string]: Chapter[]; // 예: "통합과학 1": [...]
}