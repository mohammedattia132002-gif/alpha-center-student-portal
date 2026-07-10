/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  dbAdapter,
  getPortalDataReadMeta,
  isSupabaseConfigured,
} from '../supabaseClient';
import { AttendanceRecord, Exam, GradeRecord, GroupTimeSlot, PaymentRecord, StudentProfile } from '../types';

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

export function saveToCache(key: string, cacheData: unknown): void {
  try {
    window.localStorage.setItem(`portal_cache_${key}`, JSON.stringify({ at: Date.now(), data: cacheData }));
  } catch {
    // Local cache is best-effort only.
  }
}

export function loadFromCache<T>(key: string): T | null {
  try {
    const rawCache = window.localStorage.getItem(`portal_cache_${key}`);
    if (!rawCache) return null;
    const parsedCache = JSON.parse(rawCache) as { data?: T };
    return parsedCache.data ?? null;
  } catch {
    return null;
  }
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

export async function loginStudent(phoneNumber: string, studentCode: string): Promise<StudentProfile | null> {
  const loginResponse = await dbAdapter.login(studentCode, phoneNumber);

  if (loginResponse.success) {
    const student = loginResponse.student ?? null;
    if (student && getPortalDataReadMeta('profile')?.source === 'live') {
      saveToCache('profile', student);
    }
    return student;
  }

  if (loginResponse.error) {
    throw new Error(loginResponse.error);
  }

  return null;
}

export async function fetchAttendance(studentId: string): Promise<AttendanceRecord[]> {
  const attendanceRecords = await dbAdapter.getAttendance(studentId);
  if (getPortalDataReadMeta('attendance')?.source === 'live') {
    saveToCache(`attendance_${studentId}`, attendanceRecords);
  }
  return attendanceRecords;
}

export async function fetchPayments(studentId: string): Promise<PaymentRecord[]> {
  const paymentRecords = await dbAdapter.getPayments(studentId);
  if (getPortalDataReadMeta('payments')?.source === 'live') {
    saveToCache(`payments_${studentId}`, paymentRecords);
  }
  return paymentRecords;
}

export async function fetchGrades(studentId: string): Promise<GradeRecord[]> {
  const gradeRecords = await dbAdapter.getGrades(studentId);
  if (getPortalDataReadMeta('grades')?.source === 'live') {
    saveToCache(`grades_${studentId}`, gradeRecords);
  }
  return gradeRecords;
}

export async function fetchGroupTimes(studentId: string): Promise<GroupTimeSlot[]> {
  const records = await dbAdapter.getGroupTimes(studentId);
  if (getPortalDataReadMeta('profile')?.source === 'live') {
    saveToCache(`groupTimes_${studentId}`, records);
  }
  return records;
}

export async function fetchExams(student: StudentProfile): Promise<Exam[]> {
  const examRecords = await dbAdapter.getExams(student);
  if (getPortalDataReadMeta('exams')?.source === 'live') {
    saveToCache(`exams_${student.id}`, examRecords);
  }
  return examRecords;
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
