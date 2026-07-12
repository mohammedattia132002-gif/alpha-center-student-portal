/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  dbAdapter,
  isSupabaseConfigured,
} from '../supabaseClient';
import { AttendanceRecord, Exam, GradeRecord, GroupTimeSlot, PaymentRecord, StudentProfile } from '../types';
import studentSnapshots from '../../data/student-snapshots.json';

interface JoinRequestPayload {
  student_name: string;
  phone?: string;
  parent_phone: string;
  grade: string;
  academic_stage?: string;
  academic_group?: string;
  gender?: string;
}

interface JoinRequestResponse {
  success: boolean;
  error?: string;
}

export const isWorkersApiConfigured = isSupabaseConfigured;

const READ_RETRY_DELAYS_MS = [250, 750];

type SnapshotAttendanceRecord = {
  id?: string;
  date?: string;
  status?: string;
  check_in_time?: string;
  session_name?: string;
};

type StudentSnapshot = {
  attendance?: SnapshotAttendanceRecord[];
};

const studentSnapshotMap = studentSnapshots as Record<string, StudentSnapshot>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getErrorStatus(error: unknown): number | null {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const rawStatus = record.status ?? record.statusCode ?? record.code;
  const numericStatus = Number(rawStatus);
  return Number.isFinite(numericStatus) ? numericStatus : null;
}

function isRetryableReadError(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status !== null) {
    return status === 408 || status === 425 || status === 429 || status >= 500;
  }

  const message = String(error instanceof Error ? error.message : error || '').toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('temporarily unavailable') ||
    message.includes('connection') ||
    message.includes('offline')
  );
}

function toAttendanceStatus(value: unknown): AttendanceRecord['status'] {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'present' || status === 'late' || status === 'excused') return status;
  return 'absent';
}

function getSnapshotAttendance(studentId: string): AttendanceRecord[] {
  const snapshot = studentSnapshotMap[String(studentId || '').trim()];
  if (!snapshot?.attendance?.length) return [];

  return snapshot.attendance.map((record, index) => ({
    id: String(record.id || `snapshot-attendance-${studentId}-${record.date || index}`),
    date: String(record.date || ''),
    subject: String(record.session_name || 'الحصة').trim() || 'الحصة',
    time: String(record.check_in_time || ''),
    status: toAttendanceStatus(record.status),
    lecturer: 'سنتر ألفا',
  }));
}

function mergeAttendanceRecords(liveRecords: AttendanceRecord[], snapshotRecords: AttendanceRecord[]): AttendanceRecord[] {
  const merged = new Map<string, AttendanceRecord>();

  for (const record of snapshotRecords) {
    merged.set(record.id, record);
  }
  for (const record of liveRecords) {
    merged.set(record.id, record);
  }

  return Array.from(merged.values()).sort((left, right) => {
    const rightTime = new Date(right.date).getTime();
    const leftTime = new Date(left.date).getTime();
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  });
}

async function withReadRetry<T>(operationName: string, read: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= READ_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      lastError = error;
      if (attempt >= READ_RETRY_DELAYS_MS.length || !isRetryableReadError(error)) {
        throw error;
      }

      console.warn(`[portal] retrying ${operationName} after transient read failure`, error);
      await sleep(READ_RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
}

export async function clearAuthData(): Promise<void> {
  try {
    window.localStorage.removeItem('portal_session_token');
    window.localStorage.removeItem('portal_session_token_enc');
  } catch {
    // Auth cache cleanup is best-effort only.
  }
}

interface PortalCenterRecord {
  id: string;
  name: string;
  teacher_name?: string;
  subject_name?: string;
  portal_subdomain?: string;
}

export interface PortalGroupOption {
  id: string;
  name: string;
  gradeLevel: string;
}

export type PortalJoinFieldKey =
  | 'student_name'
  | 'parent_phone'
  | 'student_phone'
  | 'academic_stage'
  | 'grade'
  | 'academic_group'
  | 'gender';

export type PortalJoinFieldConfig = {
  visible: boolean;
  required: boolean;
};

export type PortalJoinSettings = {
  fields: Record<PortalJoinFieldKey, PortalJoinFieldConfig>;
  stages: Record<string, boolean>;
  grades: Record<string, boolean>;
};

export async function fetchCenterBySubdomain(subdomain: string): Promise<PortalCenterRecord | null> {
  const config = await dbAdapter.getCenterConfig();
  if (!config) return null;

  const hasValue = config.centerName || config.teacherName || config.subjectName;
  if (!hasValue) return null;

  return {
    id: subdomain,
    name: config.centerName ?? '',
    teacher_name: config.teacherName ?? '',
    subject_name: config.subjectName ?? '',
    portal_subdomain: subdomain,
  };
}

export async function fetchActiveGroups(): Promise<PortalGroupOption[]> {
  return dbAdapter.getActiveGroups();
}

export async function fetchPortalJoinSettings(): Promise<PortalJoinSettings> {
  return dbAdapter.getPortalJoinSettings();
}

export async function loginStudent(phoneNumber: string, studentCode: string): Promise<StudentProfile | null> {
  const loginResponse = await dbAdapter.login(studentCode, phoneNumber);

  if (loginResponse.success) {
    return loginResponse.student ?? null;
  }

  if (loginResponse.error) {
    throw new Error(loginResponse.error);
  }

  return null;
}

export async function fetchAttendance(studentId: string): Promise<AttendanceRecord[]> {
  const [liveRecords, snapshotRecords] = await Promise.all([
    withReadRetry('attendance', () => dbAdapter.getAttendance(studentId)),
    Promise.resolve(getSnapshotAttendance(studentId)),
  ]);

  return mergeAttendanceRecords(liveRecords, snapshotRecords);
}

export async function fetchPayments(studentId: string): Promise<PaymentRecord[]> {
  return withReadRetry('payments', () => dbAdapter.getPayments(studentId));
}

export async function fetchGrades(studentId: string): Promise<GradeRecord[]> {
  return withReadRetry('grades', () => dbAdapter.getGrades(studentId));
}

export async function fetchGroupTimes(studentId: string): Promise<GroupTimeSlot[]> {
  return withReadRetry('groupTimes', () => dbAdapter.getGroupTimes(studentId));
}

export async function fetchExams(student: StudentProfile): Promise<Exam[]> {
  return withReadRetry('exams', () => dbAdapter.getExams(student));
}

export async function payInvoice(invoiceId: string, _amount?: number): Promise<{ success: boolean; error?: unknown }> {
  const paidDate = new Date().toISOString().slice(0, 10);
  return dbAdapter.payInvoice(invoiceId, paidDate);
}

export async function submitJoinRequest(request: JoinRequestPayload): Promise<JoinRequestResponse> {
  await dbAdapter.createJoinRequest({
    studentName: request.student_name,
    parentPhone: request.parent_phone || request.phone || '',
    studentPhone: request.phone || '',
    academicStage: request.academic_stage || 'المرحلة الثانوية',
    grade: request.grade,
    academicGroup: request.academic_group || 'غير محدد',
    gender: request.gender || 'ذكر',
  });

  return { success: true };
}
