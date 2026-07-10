/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface StudentProfile {
  id: string;
  name: string;
  avatar: string;
  department: string;
  academicYear: string;
  gpa: number;
  totalCredits: number;
  unpaidFees: number;
  attendanceRate: number; // e.g. 94.5 (representing 94.5%)
  studentCode: string; // e.g., "STD-2026-9041"
  studentPhone?: string;
  parentPhone?: string;
}

export interface CenterConfig {
  centerName: string;
  teacherName: string;
  subjectName: string;
  phoneNumber: string;
  slogan: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceRecord {
  id: string;
  date: string;
  subject: string;
  time: string;
  status: AttendanceStatus;
  lecturer: string;
  remarks?: string;
}

export type PaymentStatus = 'paid' | 'pending' | 'overdue';
export type PaymentMethod = 'credit_card' | 'fawry' | 'bank_transfer' | 'instapay' | 'mopy_pay';

export interface PaymentRecord {
  id: string;
  title: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: PaymentStatus;
  invoiceNo: string;
  category: 'tuition' | 'exam_fees' | 'books' | 'activities';
}

export interface GradeRecord {
  id: string;
  subjectCode: string;
  subjectName: string;
  category: 'midterm' | 'final' | 'practical' | 'assignments';
  score: number;
  maxScore: number;
  gradeLetter: string;
  date: string;
  feedback?: string;
  gpaWeight: number; // e.g. 4.0, 3.7
  passed: boolean;
  sourceExamId?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: 'attendance' | 'payments' | 'system';
  timestamp: string;
  read: boolean;
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface ExamQuestion {
  id: string;
  text: string;
  options: QuestionOption[];
  points: number;
  questionType?: 'mcq' | 'numeric';
  pageNumber?: number;
  explanation?: string;
}

export interface Exam {
  id: string;
  code?: string;
  tenantId?: string;
  gradeLevel?: string;
  title: string;
  subject: string;
  durationMinutes: number;
  totalPoints: number;
  questionsCount: number;
  questions: ExamQuestion[];
  instructions: string[];
  passingScorePercent: number;
  status: 'available' | 'completed' | 'expired';
}

export interface ExamAttempt {
  id: string;
  examId: string;
  examTitle: string;
  subject: string;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  takenAt: string;
  answers: Record<string, string>; // questionId -> optionId
}

export interface GroupTimeSlot {
  id: string;
  weekday: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  startTime: string;
  endTime: string;
  room: string;
  teacherName: string;
}

// Compatibility aliases for legacy component imports
export type Student = StudentProfile;
export type Grade = GradeRecord;
export type Payment = PaymentRecord;
