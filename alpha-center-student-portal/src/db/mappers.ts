import type {
  StudentProfile,
  GroupSummary,
  AttendanceRecord,
  AttendanceStatus,
  PaymentRecord,
  GradeRecord,
  BillingType,
} from '../types/domain';

function str(value: unknown, fallback = ''): string {
  const s = String(value ?? '').trim();
  return s || fallback;
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function dateOnly(value: unknown): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (typeof value === 'number') return new Date(value).toISOString().slice(0, 10);
  const d = new Date(String(value ?? ''));
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function toBillingType(value: unknown): BillingType {
  const s = str(value).toLowerCase();
  if (s === 'per_session' || s === 'per-session') return 'per_session';
  if (s === 'exempt') return 'exempt';
  return 'monthly';
}

export function mapStudentRow(row: Record<string, any>): StudentProfile {
  return {
    id: str(row.id),
    tenantId: str(row.tenant_id),
    name: str(row.name, 'غير معروف'),
    studentCode: str(row.student_code, ''),
    phone: str(row.phone) || undefined,
    parentPhone: str(row.parent_phone) || undefined,
    email: str(row.email) || undefined,
    gradeLevel: str(row.grade_level) || undefined,
    balance: num(row.balance ?? 0),
    billingType: toBillingType(row.billing_type),
    isActive: row.is_active !== false,
    registrationDate: dateOnly(row.registration_date) || undefined,
    avatar: str(row.photo_url || row.avatar) || undefined,
    address: str(row.address) || undefined,
    school: str(row.school) || undefined,
  };
}

export function mapGroupRow(row: Record<string, any>): GroupSummary {
  return {
    id: str(row.id),
    name: str(row.name, 'المجموعة التعليمية'),
    subject: str(row.subject) || undefined,
    teacherName: str(row.teacher_name) || undefined,
    gradeLevel: str(row.grade_level) || undefined,
  };
}

export function mapAttendanceRow(row: Record<string, any>): AttendanceRecord {
  const rawStatus = str(row.status).toLowerCase();
  let status: AttendanceStatus = 'absent';
  if (rawStatus === 'present' || rawStatus === 'حاضر') status = 'present';
  else if (rawStatus === 'late' || rawStatus === 'متأخر') status = 'late';
  else if (rawStatus === 'excused' || rawStatus === 'مستأذن') status = 'excused';

  return {
    id: str(row.id),
    date: dateOnly(row.attendance_date || row.date || row.recorded_at) || new Date().toISOString().slice(0, 10),
    status: status ?? 'absent',
    subject: str(row.subject) || undefined,
    time: str(row.time_slot || row.time) || undefined,
    lecturer: str(row.lecturer || row.recorded_by) || undefined,
    notes: str(row.notes || row.remarks) || undefined,
  };
}

export function mapPaymentRow(row: Record<string, any>): PaymentRecord {
  const hasPaidAt = !!row.paid_at || row.status === 'paid' || row.status === 'complete';
  return {
    id: str(row.id),
    amount: num(row.amount ?? 0),
    dueDate: dateOnly(row.due_date || row.created_at) || undefined,
    paidAt: row.paid_at ? dateOnly(row.paid_at) : undefined,
    status: hasPaidAt ? 'paid' : 'pending',
    title: str(row.title || row.notes || row.method) || 'دفعة مالية',
    category: str(row.category) || undefined,
    receiptNo: str(row.receipt_no) || undefined,
    monthKey: str(row.month_key) || undefined,
    paymentMethod: str(row.payment_method || row.method) || undefined,
    notes: str(row.notes) || undefined,
  };
}

export function mapGradeRow(row: Record<string, any>): GradeRecord {
  const score = num(row.score ?? 0);
  const maxScore = num(row.max_score) || 100;
  const percentage = num(row.percentage) || (maxScore > 0 ? Math.round((score / maxScore) * 100) : 0);
  const letterGrade = str(row.letter_grade || row.grade_letter);
  const computedLetter = letterGrade ||
    (percentage >= 95 ? 'A+' : percentage >= 90 ? 'A' : percentage >= 85 ? 'B+' : percentage >= 80 ? 'B' : percentage >= 75 ? 'C+' : percentage >= 70 ? 'C' : percentage >= 60 ? 'D' : 'F');

  return {
    id: str(row.id),
    subject: str(row.subject || row.subject_name, ''),
    subjectCode: str(row.subject_code) || undefined,
    score,
    maxScore,
    percentage: percentage ?? 0,
    letterGrade: computedLetter || 'F',
    date: dateOnly(row.assessment_date || row.date || row.created_at) || new Date().toISOString().slice(0, 10),
    type: str(row.type || row.category) || undefined,
    passed: row.passed !== undefined ? Boolean(row.passed) : undefined,
    notes: str(row.remarks || row.feedback) || undefined,
  };
}
