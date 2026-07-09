/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * لا بيانات وهمية (mock) — القاعدة #4.
 * البيانات الحقيقية تأتي حصراً من Workers API (D1) أو الـ cache.
 * تُبقى التصديرات فارغة للحفاظ على توافق الاستيرادات.
 */

import { StudentProfile, AttendanceRecord, PaymentRecord, GradeRecord } from './types';

export const initialStudentProfile: StudentProfile = {
  id: '',
  name: '',
  avatar: '',
  department: '',
  academicYear: '',
  gpa: 0,
  totalCredits: 0,
  unpaidFees: 0,
  attendanceRate: 100,
  studentCode: '',
};

export const initialAttendanceRecords: AttendanceRecord[] = [];

export const initialPaymentRecords: PaymentRecord[] = [];

export const initialGradeRecords: GradeRecord[] = [];
