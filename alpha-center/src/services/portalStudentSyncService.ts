import { supabaseAdapter } from '../core/data/adapters/SupabaseAdapter';
import { RepositoryInitializer } from '../repositories/RepositoryInitializer';
import { getStudentService } from '../core/di/Container';
import { studentDetailsService } from './studentDetailsService';
import type { StudentUnified } from '../models/StudentUnified';
import type { GroupUnified } from '../models/GroupUnified';
import type { AttendanceUnified } from '../models/AttendanceUnified';
import type { PaymentUnified } from '../models/PaymentUnified';
import type { GradeUnified } from '../models/GradeUnified';
import { portalJoinRequestsService } from './portalJoinRequestsService';

type PortalSnapshotPayload = {
  student: {
    id: string;
    student_code: string;
    student_name: string;
    student_phone: string;
    parent_phone: string;
    grade: string;
    group_name: string;
    created_at: string;
    profile_img?: string;
  };
  attendance: Array<{
    id: string;
    date: string;
    status: 'present' | 'absent' | 'late';
    check_in_time?: string;
    delay_minutes?: number;
    session_name: string;
    note?: string;
  }>;
  payments: Array<{
    id: string;
    title: string;
    amount: number;
    status: 'paid' | 'pending' | 'overdue';
    paid_at?: string;
    due_date: string;
    invoice_no: string;
  }>;
  grades: Array<{
    id: string;
    exam_name: string;
    exam_date: string;
    score: number;
    max_score: number;
    percentage: number;
    class_average: number;
    rank: number;
    note?: string;
  }>;
  notifications: Array<{
    id: string;
    title: string;
    content: string;
    type: 'grade' | 'attendance' | 'payment' | 'exam' | 'system';
    created_at: string;
    is_read: boolean;
  }>;
  updated_at: string;
};

type StudentServiceShape = {
  getAllStudents: (limit?: number) => Promise<StudentUnified[]>;
  getStudentById: (id: string) => Promise<StudentUnified | null>;
};

type GroupRepositoryShape = {
  findAll: (limit?: number, offset?: number) => Promise<GroupUnified[]>;
};

const normalizeText = (value: unknown): string => String(value ?? '').trim();
const normalizePhone = (value: unknown): string => String(value ?? '').replace(/\D/g, '').trim();

const resolveStudentId = (student: Partial<StudentUnified> | null | undefined): string =>
  normalizeText(student?.id);

const resolveStudentCode = (student: Partial<StudentUnified> | null | undefined): string =>
  normalizeText((student as any)?.studentCode ?? (student as any)?.student_code ?? student?.id);

const resolveParentPhone = (student: Partial<StudentUnified> | null | undefined): string =>
  normalizePhone((student as any)?.parentPhone ?? (student as any)?.parent_phone);

const resolveStudentPhone = (student: Partial<StudentUnified> | null | undefined): string =>
  normalizePhone((student as any)?.phone);

const resolveGrade = (student: Partial<StudentUnified> | null | undefined): string =>
  normalizeText((student as any)?.grade ?? (student as any)?.gradeLevel ?? (student as any)?.grade_level);

const resolveGroupId = (student: Partial<StudentUnified> | null | undefined): string =>
  normalizeText((student as any)?.groupId ?? (student as any)?.group_id);

const formatTime = (value: unknown): string | undefined => {
  const text = normalizeText(value);
  if (!text) return undefined;
  if (/^\d{2}:\d{2}/.test(text)) return text.slice(0, 5);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
};

const mapAttendanceStatus = (value: unknown): 'present' | 'absent' | 'late' => {
  const status = normalizeText(value).toLowerCase();
  if (status === 'late') return 'late';
  if (status === 'present') return 'present';
  return 'absent';
};

const mapPaymentStatus = (payment: PaymentUnified): 'paid' | 'pending' | 'overdue' => {
  const explicit = normalizeText((payment as any).status).toLowerCase();
  if (explicit === 'pending' || explicit === 'overdue' || explicit === 'paid') {
    return explicit;
  }

  const amount = Number(payment.amount || 0);
  const dueDate = normalizeText(payment.due_date);
  if (!amount && dueDate) {
    const parsedDueDate = new Date(dueDate);
    if (!Number.isNaN(parsedDueDate.getTime()) && parsedDueDate.getTime() < Date.now()) {
      return 'overdue';
    }
    return 'pending';
  }

  return 'paid';
};

const mergePaymentsById = (rows: PaymentUnified[]): PaymentUnified[] => {
  const byId = new Map<string, PaymentUnified>();
  for (const row of rows) {
    const id = normalizeText(row.id);
    if (!id) continue;
    byId.set(id, { ...(byId.get(id) || {}), ...row });
  }
  return Array.from(byId.values());
};

const buildAttendanceNotifications = (rows: PortalSnapshotPayload['attendance']) =>
  rows.slice(0, 4).map((row) => ({
    id: `attendance-${row.id}`,
    title: row.status === 'present' ? 'تسجيل حضور' : row.status === 'late' ? 'تسجيل تأخير' : 'غياب',
    content: `${row.session_name} - ${row.date}`,
    type: 'attendance' as const,
    created_at: row.date,
    is_read: false,
  }));

const buildPaymentNotifications = (rows: PortalSnapshotPayload['payments']) =>
  rows.slice(0, 4).map((row) => ({
    id: `payment-${row.id}`,
    title: row.status === 'paid' ? 'دفعة مسجلة' : row.status === 'overdue' ? 'استحقاق متأخر' : 'دفعة قيد الانتظار',
    content: `${row.title} - ${row.amount}`,
    type: 'payment' as const,
    created_at: row.paid_at || row.due_date,
    is_read: false,
  }));

const buildGradeNotifications = (rows: PortalSnapshotPayload['grades']) =>
  rows.slice(0, 4).map((row) => ({
    id: `grade-${row.id}`,
    title: 'نتيجة جديدة',
    content: `${row.exam_name} - ${row.score}/${row.max_score}`,
    type: 'grade' as const,
    created_at: row.exam_date,
    is_read: false,
  }));

const computeAttendanceRate = (rows: PortalSnapshotPayload['attendance']): number => {
  if (!rows.length) return 100;
  const present = rows.filter((row) => row.status === 'present').length;
  const late = rows.filter((row) => row.status === 'late').length;
  return Number((((present + late * 0.7) / rows.length) * 100).toFixed(1));
};

const computeUnpaidFees = (rows: PortalSnapshotPayload['payments']): number =>
  Number(
    rows
      .filter((row) => row.status !== 'paid')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0)
      .toFixed(2),
  );

const percentageToGradeLetter = (percentage: number): string => {
  if (percentage >= 95) return 'A+';
  if (percentage >= 90) return 'A';
  if (percentage >= 85) return 'B+';
  if (percentage >= 80) return 'B';
  if (percentage >= 75) return 'C+';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
};

const percentageToGpa = (percentage: number): number => {
  if (percentage >= 95) return 4.0;
  if (percentage >= 90) return 4.0;
  if (percentage >= 85) return 3.3;
  if (percentage >= 80) return 3.0;
  if (percentage >= 75) return 2.3;
  if (percentage >= 70) return 2.0;
  if (percentage >= 60) return 1.0;
  return 0;
};

const computeGpa = (rows: PortalSnapshotPayload['grades']): number => {
  if (!rows.length) return 0;
  return Number(
    (rows.reduce((sum, row) => sum + percentageToGpa(Number(row.percentage || 0)), 0) / rows.length).toFixed(2),
  );
};

const inferPaymentCategory = (title: string): 'tuition' | 'exam_fees' | 'books' | 'activities' => {
  const lower = title.toLowerCase();
  if (lower.includes('exam') || title.includes('امتح')) return 'exam_fees';
  if (lower.includes('book') || title.includes('كتاب')) return 'books';
  if (lower.includes('activity') || title.includes('نشاط')) return 'activities';
  return 'tuition';
};

const buildSubjectCode = (grade: PortalSnapshotPayload['grades'][number]): string => {
  const explicit = normalizeText(grade.id);
  if (explicit) return `EX-${explicit.slice(0, 8).toUpperCase()}`;
  return `EX-${Math.abs(hashCode(grade.exam_name)).toString().slice(0, 6)}`;
};

const hashCode = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
};

class PortalStudentSyncService {
  private syncingAllPromise: Promise<number> | null = null;

  private async postSnapshot(snapshot: PortalSnapshotPayload): Promise<void> {
    const baseUrl = portalJoinRequestsService.readPortalBaseUrl();
    const response = await fetch(`${baseUrl}/api/admin/portal-sync/student`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(snapshot),
    });
    if (!response.ok) {
      throw new Error(`portal_snapshot_sync_failed_${response.status}`);
    }
  }

  private async syncSnapshotViaSupabase(snapshot: PortalSnapshotPayload): Promise<boolean> {
    const client = supabaseAdapter.getClient();
    if (!client) return false;

    const studentId = normalizeText(snapshot.student.id);
    if (!studentId) return false;

    const tenantId = 'af975d96-5310-48b8-a5df-f88518ef0557';

    const studentRow = {
      id: studentId,
      tenant_id: tenantId,
      student_code: normalizeText(snapshot.student.student_code),
      name: normalizeText(snapshot.student.student_name),
      phone: normalizePhone(snapshot.student.student_phone) || null,
      parent_phone: normalizePhone(snapshot.student.parent_phone),
      grade_level: normalizeText(snapshot.student.grade) || null,
      group_id: normalizeText(snapshot.student.group_name) || null,
      photo_url: normalizeText(snapshot.student.profile_img) || null,
    };

    const { error: studentError } = await client.from('students').upsert(studentRow);
    if (studentError) throw studentError;

    if (snapshot.attendance.length > 0) {
      const attendanceRows = snapshot.attendance.map((row) => ({
        id: normalizeText(row.id),
        tenant_id: tenantId,
        student_id: studentId,
        date: normalizeText(row.date),
        status: row.status,
        recorded_at: row.check_in_time && row.date ? new Date(`${row.date}T${row.check_in_time}`).getTime() : null,
      }));
      const { error: attendanceInsertError } = await client.from('attendance').upsert(attendanceRows, { onConflict: 'id' });
      if (attendanceInsertError) throw attendanceInsertError;
    }

    if (snapshot.payments.length > 0) {
      const paymentRows = snapshot.payments.map((row) => {
        const rawStatus = normalizeText(row.status).toLowerCase();
        const status = rawStatus === 'paid' ? 'paid' : rawStatus === 'overdue' ? 'pending' : 'pending';
        return {
          id: normalizeText(row.id),
          tenant_id: tenantId,
          student_id: studentId,
          amount: Number(row.amount || 0),
          date: normalizeText(row.due_date) || new Date().toISOString().slice(0, 10),
          paid_at: normalizeText(row.paid_at) || null,
          status,
        };
      });
      const { error: paymentsInsertError } = await client.from('payments').upsert(paymentRows, { onConflict: 'id' });
      if (paymentsInsertError) throw paymentsInsertError;
    }

    if (snapshot.grades.length > 0) {
      const gradeRows = snapshot.grades.map((row) => {
        const percentage = Number(row.percentage || 0);
        const score = Number(row.score || 0);
        const maxScore = Number(row.max_score || 0) || 1;
        return {
          id: normalizeText(row.id),
          tenant_id: tenantId,
          student_id: studentId,
          student_name: normalizeText(snapshot.student.student_name) || null,
          subject: normalizeText(row.exam_name) || 'تقييم',
          grade_level: normalizeText(snapshot.student.grade) || null,
          type: 'assignment',
          score,
          max_score: maxScore,
          assessment_date: normalizeText(row.exam_date) || new Date().toISOString(),
          percentage,
          letter_grade: percentageToGradeLetter(percentage),
        };
      });
      const { error: gradesInsertError } = await client.from('grades').upsert(gradeRows, { onConflict: 'id' });
      if (gradesInsertError) throw gradesInsertError;
    }

    return true;
  }

  private async loadGroupsMap(): Promise<Map<string, GroupUnified>> {
    const repository = RepositoryInitializer.getGroupRepository() as unknown as GroupRepositoryShape;
    const rows = await repository.findAll(10000, 0);
    return new Map((Array.isArray(rows) ? rows : []).map((group) => [String(group.id), group] as const));
  }

  private buildAttendanceRows(rows: AttendanceUnified[]): PortalSnapshotPayload['attendance'] {
    return [...rows]
      .sort((left, right) =>
        String((right as any).timestamp ?? right.date ?? '').localeCompare(String((left as any).timestamp ?? left.date ?? '')),
      )
      .map((row) => ({
        id: String(row.id),
        date: normalizeText(row.date || (row as any).attendance_date),
        status: mapAttendanceStatus(row.status),
        check_in_time: formatTime((row as any).timestamp ?? (row as any).marked_at ?? (row as any).check_in_time),
        delay_minutes: Number((row as any).delay_minutes || 0) || undefined,
        session_name: normalizeText((row as any).session_name ?? (row as any).group_name ?? (row as any).subject) || 'الحصة',
        note: normalizeText((row as any).note) || undefined,
      }));
  }

  private buildPaymentRows(rows: PaymentUnified[]): PortalSnapshotPayload['payments'] {
    return [...rows]
      .sort((left, right) =>
        String(right.timestamp ?? right.created_at ?? '').localeCompare(String(left.timestamp ?? left.created_at ?? '')),
      )
      .map((row) => ({
        id: String(row.id),
        title: normalizeText((row as any).title ?? (row as any).description ?? row.notes ?? row.type) || 'دفعة مالية',
        amount: Number(row.amount || 0),
        status: mapPaymentStatus(row),
        paid_at: normalizeText(row.timestamp ?? (row as any).paid_at ?? row.created_at) || undefined,
        due_date: normalizeText(row.due_date ?? row.timestamp ?? (row as any).paid_at ?? row.created_at) || new Date().toISOString().slice(0, 10),
        invoice_no: normalizeText((row as any).invoice_no ?? row.receipt_id ?? row.idempotency_key ?? row.id) || String(row.id),
      }));
  }

  private buildGradeRows(rows: GradeUnified[]): PortalSnapshotPayload['grades'] {
    return [...rows]
      .sort((left, right) => String(right.assessment_date).localeCompare(String(left.assessment_date)))
      .map((row) => {
        const score = Number(row.score || 0);
        const maxScore = Number(row.max_score || 0) || 1;
        const percentage = Number(row.percentage ?? Math.round((score / maxScore) * 100));
        return {
          id: String(row.id),
          exam_name: normalizeText((row as any).exam_name ?? row.subject ?? row.type) || 'تقييم',
          exam_date: normalizeText(row.assessment_date),
          score,
          max_score: maxScore,
          percentage,
          class_average: Number((row as any).class_average ?? 0),
          rank: Number((row as any).rank ?? 0),
          note: normalizeText(row.remarks) || undefined,
        };
      });
  }

  async syncStudent(studentId: string, groupMap?: Map<string, GroupUnified>): Promise<void> {
    const safeStudentId = normalizeText(studentId);
    if (!safeStudentId) return;

    const studentService = getStudentService() as unknown as StudentServiceShape;
    const student = await studentService.getStudentById(safeStudentId);
    if (!student) return;

    const groups = groupMap ?? (await this.loadGroupsMap());
    const currentGroup = groups.get(resolveGroupId(student));
    const attendanceRows = await studentDetailsService.getAttendanceRowsByStudentId(safeStudentId);
    const paymentRows = await studentDetailsService.getPaymentRowsByStudentId(safeStudentId);
    const ledgerBackedPayments = await studentDetailsService.getLedgerBackedPaymentsByStudentId(safeStudentId, 5000);
    const gradeRows = await studentDetailsService.getGradeRowsByStudentId(safeStudentId);

    const attendance = this.buildAttendanceRows(attendanceRows);
    const payments = this.buildPaymentRows(
      mergePaymentsById([
        ...paymentRows,
        ...(Array.isArray(ledgerBackedPayments) ? (ledgerBackedPayments as PaymentUnified[]) : []),
      ]),
    );
    const grades = this.buildGradeRows(gradeRows);
    const notifications = [
      ...buildAttendanceNotifications(attendance),
      ...buildPaymentNotifications(payments),
      ...buildGradeNotifications(grades),
    ]
      .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
      .slice(0, 12);

    const snapshot: PortalSnapshotPayload = {
      student: {
        id: resolveStudentId(student),
        student_code: resolveStudentCode(student),
        student_name: normalizeText(student.name),
        student_phone: resolveStudentPhone(student),
        parent_phone: resolveParentPhone(student),
        grade: resolveGrade(student),
        group_name: normalizeText(currentGroup?.name ?? (student as any).groupName),
        created_at:
          normalizeText((student as any).registrationDate ?? (student as any).registration_date ?? student.created_at) ||
          new Date().toISOString(),
        profile_img: normalizeText((student as any).photoUrl) || undefined,
      },
      attendance,
      payments,
      grades,
      notifications,
      updated_at: new Date().toISOString(),
    };

    try {
      const synced = await this.syncSnapshotViaSupabase(snapshot);
      if (synced) return;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[PortalStudentSyncService] Supabase sync fallback', error);
      }
    }

    await this.postSnapshot(snapshot);
  }

  async syncAllStudents(limit: number = 1000): Promise<number> {
    if (this.syncingAllPromise) return this.syncingAllPromise;

    this.syncingAllPromise = (async () => {
      const studentService = getStudentService() as unknown as StudentServiceShape;
      const students = await studentService.getAllStudents(limit);
      const groupMap = await this.loadGroupsMap();
      const concurrency = 6;

      let synced = 0;
      for (let index = 0; index < students.length; index += concurrency) {
        const batch = students.slice(index, index + concurrency);
        const results = await Promise.all(
          batch.map(async (student) => {
            try {
              await this.syncStudent(String(student.id), groupMap);
              return true;
            } catch (error) {
              console.warn('[PortalStudentSyncService] syncStudent failed', {
                studentId: student.id,
                error: String((error as Error)?.message || error),
              });
              return false;
            }
          }),
        );
        synced += results.filter(Boolean).length;
      }
      return synced;
    })();

    try {
      return await this.syncingAllPromise;
    } finally {
      this.syncingAllPromise = null;
    }
  }
}

export const portalStudentSyncService = new PortalStudentSyncService();
