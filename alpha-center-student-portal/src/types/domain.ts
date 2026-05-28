export type BillingType = 'monthly' | 'per_session' | 'exempt';
export type PaymentStatus = 'paid' | 'pending';
export type PaymentMethod = 'credit_card' | 'instapay' | 'fawry';

export interface GroupSummary {
  id: string;
  name: string;
  subject?: string;
  teacherName?: string;
  gradeLevel?: string;
}

export interface StudentProfile {
  id: string;
  tenantId: string;
  name: string;
  studentCode: string;
  phone?: string;
  parentPhone?: string;
  email?: string;
  gradeLevel?: string;
  balance: number;
  billingType: BillingType;
  isActive: boolean;
  registrationDate?: string;
  avatar?: string;
  address?: string;
  school?: string;
  group?: GroupSummary;
  attendanceRate?: number;
  gpa?: number;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceRecord {
  id: string;
  date: string;
  status: AttendanceStatus;
  subject?: string;
  time?: string;
  lecturer?: string;
  notes?: string;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  dueDate?: string;
  paidAt?: string;
  status: 'paid' | 'pending';
  title?: string;
  category?: string;
  receiptNo?: string;
  monthKey?: string;
  paymentMethod?: string;
  notes?: string;
}

export interface GradeRecord {
  id: string;
  subject: string;
  subjectCode?: string;
  score: number;
  maxScore: number;
  percentage: number;
  letterGrade?: string;
  date: string;
  type?: string;
  passed?: boolean;
  notes?: string;
}

export interface ExamQuestion {
  id: string;
  text: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  points: number;
  explanation?: string;
}

export interface Exam {
  id: string;
  title: string;
  subject: string;
  durationMinutes: number;
  totalPoints: number;
  questions: ExamQuestion[];
  instructions: string[];
  passingScorePercent: number;
  status: 'available' | 'completed' | 'expired';
}

export interface ExamAttempt {
  id: string;
  examId: string;
  examTitle?: string;
  subject?: string;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  takenAt: string;
  answers: Record<string, string>;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: 'attendance' | 'payments' | 'exams' | 'system';
  timestamp: string;
  read: boolean;
}

export interface StudentDashboard {
  profile: StudentProfile;
  attendance: AttendanceRecord[];
  payments: PaymentRecord[];
  grades: GradeRecord[];
}
