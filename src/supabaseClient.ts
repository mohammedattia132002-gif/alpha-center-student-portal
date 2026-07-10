/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';
import { StudentProfile, AttendanceRecord, PaymentRecord, GradeRecord, Exam, ExamAttempt, ExamQuestion, AttendanceStatus, GroupTimeSlot } from './types';

// Read configuration gracefully from import.meta.env
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
const PORTAL_TENANT_ID =
  (import.meta as any).env?.VITE_TENANT_ID ||
  (import.meta as any).env?.VITE_DEV_BYPASS_TENANT_ID ||
  'af975d96-5310-48b8-a5df-f88518ef0557';
const PORTAL_DEVICE_ID = 'student-portal-web';
const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=256&h=256&auto=format&fit=crop';

// Lazy initialization of Supabase client to prevent immediate startup crash
let _supabaseClient: any = null;
type SnapshotEntry = {
  student?: Record<string, any>;
  attendance?: any[];
  payments?: any[];
  grades?: any[];
};

type StudentSnapshotsMap = Record<string, SnapshotEntry>;
export type PortalDataReadKey = 'profile' | 'attendance' | 'payments' | 'grades' | 'exams';
export type PortalDataReadSource = 'live' | 'cache' | 'snapshot';

export interface PortalDataReadMeta {
  at: number;
  source: PortalDataReadSource;
}

interface SavedExamResult {
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  correctAnswersCount: number;
  wrongAnswersCount: number;
  unansweredAnswersCount: number;
  assessmentDate: string;
  alreadySubmitted: boolean;
}

const lastPortalDataReads: Partial<Record<PortalDataReadKey, PortalDataReadMeta>> = {};
let studentSnapshotsPromise: Promise<StudentSnapshotsMap> | null = null;

function recordPortalDataRead(key: PortalDataReadKey, source: PortalDataReadSource): void {
  lastPortalDataReads[key] = {
    at: Date.now(),
    source,
  };
}

export function getPortalDataReadMeta(key: PortalDataReadKey): PortalDataReadMeta | null {
  return lastPortalDataReads[key] ?? null;
}

async function loadStudentSnapshots(): Promise<StudentSnapshotsMap> {
  if (!studentSnapshotsPromise) {
    studentSnapshotsPromise = import('../data/student-snapshots.json')
      .then((module) => (module.default ?? module) as StudentSnapshotsMap)
      .catch((error) => {
        console.warn('Failed to load student snapshots fallback.', error);
        return {} as StudentSnapshotsMap;
      });
  }

  return studentSnapshotsPromise;
}

async function getStudentSnapshotEntry(studentId: string): Promise<SnapshotEntry | null> {
  if (!studentId) {
    return null;
  }

  const studentSnapshots = await loadStudentSnapshots();
  return studentSnapshots[studentId] ?? null;
}

async function findSnapshotEntryForLogin(
  normalizedCode: string,
  cleanPhone: string,
): Promise<SnapshotEntry | null> {
  const studentSnapshots = await loadStudentSnapshots();
  const snapshotEntry = Object.values(studentSnapshots).find((entry) => {
    const student = entry.student;
    if (!student) return false;
    const codeMatches = normalizeStudentCode(student.student_code) === normalizedCode;
    const phoneMatches =
      matchesPhoneValue(student.student_phone, cleanPhone) ||
      matchesPhoneValue(student.parent_phone, cleanPhone);
    return codeMatches && phoneMatches;
  });

  return snapshotEntry ?? null;
}

export function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!_supabaseClient) {
    try {
      _supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
      console.warn("فشل الاتصال بـ Supabase. سيتم استخدام النسخة المحلية.", e);
    }
  }
  return _supabaseClient;
}

// Indicator of whether real Supabase connection is established
export const isSupabaseConfigured = () => {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY && getSupabase() !== null;
};

function toAsciiDigits(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.charCodeAt(0) - 0x06F0));
}

function normalizeIdentity(value: unknown): string {
  return toAsciiDigits(value)
    .normalize('NFKC')
    .replace(/[\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[\u0623\u0625\u0622]/g, '\u0627')
    .replace(/\u0649/g, '\u064A')
    .replace(/\u0629/g, '\u0647')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeStudentCode(value: unknown): string {
  return normalizeIdentity(value).replace(/[\s\-_./\\]+/g, '');
}

function normalizePhoneNumber(value: unknown): string {
  const digits = toAsciiDigits(value).replace(/\D+/g, '');
  if (!digits) return '';

  if (digits.startsWith('0020') && digits.length >= 13) {
    return `0${digits.slice(4)}`;
  }
  if (digits.startsWith('20') && digits.length >= 12) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

function getPhoneSearchVariants(value: unknown): string[] {
  const normalized = normalizePhoneNumber(value);
  if (!normalized) return [];

  const variants = new Set<string>([normalized]);
  if (normalized.startsWith('0')) {
    variants.add(normalized.slice(1));
    variants.add(`20${normalized.slice(1)}`);
    variants.add(`0020${normalized.slice(1)}`);
  }
  if (normalized.startsWith('20')) {
    variants.add(`0${normalized.slice(2)}`);
    variants.add(`0020${normalized.slice(2)}`);
  }
  if (normalized.startsWith('0020')) {
    variants.add(`0${normalized.slice(4)}`);
    variants.add(`20${normalized.slice(4)}`);
  }

  return Array.from(variants).filter(Boolean);
}

function matchesPhoneValue(value: unknown, input: string): boolean {
  const normalizedValue = normalizePhoneNumber(value);
  const normalizedInput = normalizePhoneNumber(input);
  if (!normalizedValue || !normalizedInput) return false;
  return (
    normalizedValue === normalizedInput ||
    normalizedValue.endsWith(normalizedInput) ||
    normalizedInput.endsWith(normalizedValue)
  );
}

function outstandingBalanceFromStudent(row: Record<string, any> | null | undefined): number {
  const amount = Number(row?.balance ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return amount < 0 ? Math.abs(amount) : 0;
}

function formatDateOnly(value: unknown): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString().slice(0, 10);
  }

  const parsed = new Date(String(value ?? ''));
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

function formatTimeLabel(value: unknown): string {
  const text = String(value ?? '').trim();
  if (/^\d{2}:\d{2}/.test(text)) return text.slice(0, 5);

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return 'غير محدد';
  return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
}

function safeUuid(value: unknown): string | null {
  const token = String(value ?? '').trim();
  return token || null;
}

function getAttendanceSessionId(row: Record<string, any>): string | null {
  return safeUuid(row?.operational_session_id) || safeUuid(row?.session_id);
}

function getDateSortTime(value: unknown): number {
  const parsed = new Date(String(value ?? '')).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function mergePaymentRecords(records: PaymentRecord[]): PaymentRecord[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = record.id || record.invoiceNo;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

function nowEpochMs(): number {
  return Date.now();
}

function toPaymentStatus(value: unknown): 'paid' | 'pending' | 'overdue' {
  const token = String(value ?? '').trim().toLowerCase();
  if (token === 'pending' || token === 'overdue' || token === 'paid') return token;
  return token ? 'paid' : 'pending';
}

function inferPaymentCategory(text: unknown): 'tuition' | 'exam_fees' | 'books' | 'activities' {
  const value = String(text ?? '').toLowerCase();
  if (value.includes('exam') || value.includes('امتح')) return 'exam_fees';
  if (value.includes('book') || value.includes('كتاب')) return 'books';
  if (value.includes('activity') || value.includes('نشاط')) return 'activities';
  return 'tuition';
}

function percentageToGpa(percentage: number): number {
  if (percentage >= 95) return 4.0;
  if (percentage >= 90) return 4.0;
  if (percentage >= 85) return 3.3;
  if (percentage >= 80) return 3.0;
  if (percentage >= 75) return 2.3;
  if (percentage >= 70) return 2.0;
  if (percentage >= 60) return 1.0;
  return 0;
}

function percentageToLetter(percentage: number): string {
  if (percentage >= 95) return 'A+';
  if (percentage >= 90) return 'A';
  if (percentage >= 85) return 'B+';
  if (percentage >= 80) return 'B';
  if (percentage >= 75) return 'C+';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

function mapGradeCategory(value: unknown): GradeRecord['category'] {
  const token = String(value ?? '').trim().toLowerCase();
  if (token === 'final') return 'final';
  if (token === 'practical') return 'practical';
  if (token === 'assignments' || token === 'assignment' || token === 'project') return 'assignments';
  return 'midterm';
}

function buildJoinReferenceCode(): string {
  return `JR-${Date.now().toString(36).toUpperCase()}`;
}

// app_settings.setting_value is a JSON column. The desktop stores plain scalar strings,
// but supabase-js may hand them back either already-parsed or as a JSON-encoded string.
function parseSettingValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      try {
        const parsed = JSON.parse(trimmed);
        return typeof parsed === 'string' ? parsed.trim() : String(parsed).trim();
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  return String(value).trim();
}

async function resolveGroupName(client: any, studentRow: Record<string, any>): Promise<string> {
  const studentId = safeUuid(studentRow?.id);
  const fallbackGroupId = safeUuid(studentRow?.group_id);
  let groupId = fallbackGroupId;

  if (studentId) {
    const { data: enrollments } = await client
      .from('enrollments')
      .select('group_id,is_active,start_date,end_date,updated_at,deleted_at')
      .eq('student_id', studentId)
      .order('updated_at', { ascending: false })
      .limit(10);

    if (Array.isArray(enrollments)) {
      const today = formatDateOnly(new Date());
      const activeEnrollment = enrollments.find((row: any) => {
        if (row?.deleted_at) return false;
        if (row?.is_active === false) return false;
        const startDate = String(row?.start_date || '').trim();
        const endDate = String(row?.end_date || '').trim();
        if (startDate && startDate > today) return false;
        if (endDate && endDate < today) return false;
        return true;
      });
      if (activeEnrollment?.group_id) {
        groupId = String(activeEnrollment.group_id);
      }
    }
  }

  if (!groupId) return 'المجموعة التعليمية';

  const { data: groupRow } = await client
    .from('groups')
    .select('name')
    .eq('id', groupId)
    .maybeSingle();

  return String(groupRow?.name || '').trim() || 'المجموعة التعليمية';
}

async function resolveStudentGroupSummary(client: any, studentId: string): Promise<Record<string, any> | null> {
  const { data: studentRow } = await client
    .from('students')
    .select('id,group_id,grade_level')
    .eq('tenant_id', PORTAL_TENANT_ID)
    .eq('id', studentId)
    .maybeSingle();

  let groupId = safeUuid(studentRow?.group_id);
  const { data: enrollments } = await client
    .from('enrollments')
    .select('group_id,is_active,start_date,end_date,updated_at,deleted_at')
    .eq('student_id', studentId)
    .order('updated_at', { ascending: false })
    .limit(10);

  if (Array.isArray(enrollments)) {
    const today = formatDateOnly(new Date());
    const activeEnrollment = enrollments.find((row: any) => {
      if (row?.deleted_at) return false;
      if (row?.is_active === false) return false;
      const startDate = String(row?.start_date || '').trim();
      const endDate = String(row?.end_date || '').trim();
      if (startDate && startDate > today) return false;
      if (endDate && endDate < today) return false;
      return true;
    });
    if (activeEnrollment?.group_id) {
      groupId = String(activeEnrollment.group_id);
    }
  }

  if (!groupId) return null;

  const { data: groupRow } = await client
    .from('groups')
    .select('id,name,grade,grade_level,subject,teacher,teacher_name')
    .eq('id', groupId)
    .maybeSingle();

  return groupRow || { id: groupId, grade_level: studentRow?.grade_level };
}

type PortalExamStudent = Pick<
  StudentProfile,
  'id' | 'studentCode' | 'studentPhone' | 'parentPhone' | 'department' | 'academicYear'
>;

function audienceValuesMatch(left: unknown, right: unknown): boolean {
  const normalizedLeft = normalizeIdentity(left);
  const normalizedRight = normalizeIdentity(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function parseTextArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? '').trim()).filter(Boolean);
  }

  const raw = String(value ?? '').trim();
  if (!raw) return [];
  if (raw.startsWith('{') && raw.endsWith('}')) {
    return raw.slice(1, -1).split(',').map((entry) => entry.replace(/^"|"$/g, '').trim()).filter(Boolean);
  }

  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((entry) => String(entry ?? '').trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  return raw.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function examMatchesStudentAudience(
  exam: Record<string, any>,
  student: PortalExamStudent | undefined,
  groupSummary: Record<string, any> | null,
): boolean {
  const examGradeLevel = String(exam.grade_level || '').trim();
  if (examGradeLevel) {
    const studentGradeCandidates = [student?.academicYear, groupSummary?.grade_level, groupSummary?.grade];
    if (!studentGradeCandidates.some((grade) => audienceValuesMatch(examGradeLevel, grade))) {
      return false;
    }
  }

  const allowedGroups = parseTextArray(exam.allowed_groups);
  if (allowedGroups.length === 0) return true;

  const studentGroupCandidates = [student?.department, groupSummary?.id, groupSummary?.name];
  return allowedGroups.some((allowedGroup) =>
    studentGroupCandidates.some((studentGroup) => audienceValuesMatch(allowedGroup, studentGroup)),
  );
}

function readPlatformQuestionType(question: Record<string, any>, choicesCount: number): 'mcq' | 'numeric' {
  const rawType = String(question.question_type || '').trim().toLowerCase();
  if (rawType === 'numeric') return 'numeric';
  if (rawType === 'mcq' || rawType === 'multiple_choice') return 'mcq';
  return choicesCount > 0 ? 'mcq' : 'numeric';
}

async function buildStudentProfile(client: any, studentRow: Record<string, any>): Promise<StudentProfile> {
  const groupName = await resolveGroupName(client, studentRow);
  return {
    id: String(studentRow.id || ''),
    name: String(studentRow.name || 'ط·ط§ظ„ط¨'),
    avatar: String(studentRow.photo_url || '').trim() || DEFAULT_AVATAR,
    department: groupName,
    academicYear: String(studentRow.grade_level || 'ط؛ظٹط± ظ…ط­ط¯ط¯'),
    gpa: 0,
    totalCredits: 0,
    unpaidFees: outstandingBalanceFromStudent(studentRow),
    attendanceRate: 100,
    studentCode: String(studentRow.student_code || ''),
    studentPhone: normalizePhoneNumber(studentRow.phone) || undefined,
    parentPhone: normalizePhoneNumber(studentRow.parent_phone) || undefined,
  };
}


// Adapter helper for the portal's Supabase-backed data access.
export const dbAdapter = {
  // Authentication check (Supabase only)
  async login(studentCode: string, phone: string): Promise<{ success: boolean; student?: StudentProfile; error?: string }> {
    const cleanCode = studentCode.trim();
    const cleanPhone = phone.trim();
    const normalizedCode = normalizeStudentCode(cleanCode);

    const checkSnapshotFallback = async () => {
      const snapshotEntry = await findSnapshotEntryForLogin(normalizedCode, cleanPhone);

      if (snapshotEntry) {
        const s = (snapshotEntry as any).student;
        const mappedStudent: StudentProfile = {
          id: String(s.id || ''),
          name: String(s.student_name || 'طالب'),
          avatar: DEFAULT_AVATAR,
          department: String(s.group_name || 'المجموعة الأكاديمية').trim() || 'المجموعة الأكاديمية',
          academicYear: String(s.grade || 'غير حدد'),
          gpa: 0,
          totalCredits: 0,
          unpaidFees: 0,
          attendanceRate: 100,
          studentCode: String(s.student_code || ''),
          studentPhone: normalizePhoneNumber(s.student_phone) || undefined,
          parentPhone: normalizePhoneNumber(s.parent_phone) || undefined,
        };
        recordPortalDataRead('profile', 'snapshot');
        return { success: true, student: mappedStudent };
      }
      return null;
    };

    if (!isSupabaseConfigured()) {
      const snapshotRes = await checkSnapshotFallback();
      if (snapshotRes) return snapshotRes;
      return { success: false, error: 'Supabase غير مهيأ. لا يمكن تسجيل الدخول الآن.' };
    }

    const client = getSupabase();
    try {
      const phoneVariants = getPhoneSearchVariants(cleanPhone);
      const codeVariants = Array.from(
        new Set([cleanCode, toAsciiDigits(cleanCode), normalizeIdentity(cleanCode), normalizedCode].filter(Boolean)),
      );
      const phoneClause = phoneVariants
        .flatMap((variant) => [`phone.eq.${variant}`, `parent_phone.eq.${variant}`])
        .join(',');

      let candidates: Record<string, any>[] = [];
      if (phoneClause) {
        const { data, error } = await client
          .from('students')
          .select('*')
          .eq('tenant_id', PORTAL_TENANT_ID)
          .eq('is_active', true)
          .is('deleted_at', null)
          .or(phoneClause)
          .limit(50);

        if (error) throw error;
        candidates = Array.isArray(data) ? data : [];
      }

      let matchedRows = candidates.filter((row) => {
        const studentCodeMatches = codeVariants.some(
          (variant) => normalizeStudentCode(row?.student_code) === normalizeStudentCode(variant),
        );
        const phoneMatches =
          matchesPhoneValue(row?.phone, cleanPhone) || matchesPhoneValue(row?.parent_phone, cleanPhone);
        return studentCodeMatches && phoneMatches;
      });

      if (matchedRows.length === 0 && codeVariants.length > 0) {
        let { data, error } = await client
          .from('students')
          .select('*')
          .eq('tenant_id', PORTAL_TENANT_ID)
          .eq('is_active', true)
          .is('deleted_at', null)
          .in('student_code', codeVariants)
          .limit(20);

        if (error) throw error;
        let codeRows = Array.isArray(data) ? data : [];

        if (codeRows.length === 0 && normalizedCode) {
          const fuzzy = await client
            .from('students')
            .select('*')
            .eq('tenant_id', PORTAL_TENANT_ID)
            .eq('is_active', true)
            .is('deleted_at', null)
            .ilike('student_code', `%${cleanCode}%`)
            .limit(50);

          if (fuzzy.error) throw fuzzy.error;
          codeRows = Array.isArray(fuzzy.data) ? fuzzy.data : [];
        }

        matchedRows = codeRows.filter((row) => {
          const studentCodeMatches = normalizeStudentCode(row?.student_code) === normalizedCode;
          const phoneMatches =
            matchesPhoneValue(row?.phone, cleanPhone) || matchesPhoneValue(row?.parent_phone, cleanPhone);
          return studentCodeMatches && phoneMatches;
        });
      }

      if (matchedRows.length === 0) {
        return { success: false, error: 'بيانات الدخول غير صحيحة. تأكد من كود الطالب ورقم الهاتف.' };
      }

      if (matchedRows.length > 1) {
        return { success: false, error: 'تم العثور على أكثر من طالب بنفس البيانات. راجع كود الطالب ثم حاول مرة أخرى.' };
      }

      const mappedStudent = await buildStudentProfile(client, matchedRows[0]);
      recordPortalDataRead('profile', 'live');
      return { success: true, student: mappedStudent };
    } catch (e) {
      console.error('Supabase Auth error:', e);
      return { success: false, error: 'حدث خطأ أثناء الاتصال بقاعدة البيانات. حاول مرة أخرى بعد قليل.' };
    }
  },

  // Read center white-label config from the desktop-synced app_settings table.
  // The desktop app persists teacher_name / subject_name / center_name there per tenant,
  // so the portal must read the same source instead of hardcoding a teacher name.
  async getCenterConfig(): Promise<{ centerName?: string; teacherName?: string; subjectName?: string } | null> {
    if (!isSupabaseConfigured()) return null;

    const client = getSupabase();
    try {
      const { data, error } = await client
        .from('app_settings')
        .select('setting_key,setting_value')
        .eq('tenant_id', PORTAL_TENANT_ID)
        .in('setting_key', ['teacher_name', 'subject_name', 'center_name'])
        .is('deleted_at', null);

      if (error || !Array.isArray(data)) return null;

      const settings = new Map<string, string>();
      for (const row of data) {
        const key = String((row as any)?.setting_key || '').trim();
        if (key) settings.set(key, parseSettingValue((row as any)?.setting_value));
      }

      return {
        centerName: settings.get('center_name') || undefined,
        teacherName: settings.get('teacher_name') || undefined,
        subjectName: settings.get('subject_name') || undefined,
      };
    } catch (e) {
      console.error('Supabase center config error:', e);
      return null;
    }
  },

// Read the real active groups defined on the desktop so the join-request form
  // offers actual center groups instead of hardcoded placeholders.
  // Falls back to snapshot fallback data when Supabase has no results.
  async getActiveGroups(): Promise<Array<{ id: string; name: string; gradeLevel: string }>> {
    if (!isSupabaseConfigured()) {
      return this.getGroupSnapshots();
    }

    const client = getSupabase();
    try {
      const { data, error } = await client
        .from('groups')
        .select('id,name,grade_level,is_active')
        .eq('tenant_id', PORTAL_TENANT_ID)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data
          .map((row: any) => ({
            id: String(row?.id || ''),
            name: String(row?.name || '').trim(),
            gradeLevel: String(row?.grade_level || '').trim(),
          }))
          .filter((group) => group.id && group.name);
      }
    } catch (e) {
      console.error('Supabase groups fetch error:', e);
    }

    return this.getGroupSnapshots();
  },

  // Fallback: extract unique groups from student snapshots
  getGroupSnapshots(): Array<{ id: string; name: string; gradeLevel: string }> {
    try {
      const raw = localStorage.getItem('portal_cache_profile');
      if (!raw) return [];
      const parsed = JSON.parse(raw) as { data?: { department?: string } };
      const department = parsed?.data?.department;
      if (department) {
        return [{ id: 'snapshot-group', name: department, gradeLevel: '' }];
      }
    } catch {}
    return [];
  },

// Load group schedule times for the student's group
  async getGroupTimes(studentId: string): Promise<GroupTimeSlot[]> {
    if (!isSupabaseConfigured()) return [];

    const client = getSupabase();
    try {
      const groupSummary = await resolveStudentGroupSummary(client, studentId);
      const groupId = safeUuid(groupSummary?.id);
      if (!groupId) return [];

      const { data, error } = await client
        .from('group_times')
        .select('*')
        .eq('tenant_id', PORTAL_TENANT_ID)
        .eq('group_id', groupId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('weekday', { ascending: true })
        .order('start_time', { ascending: true });

      if (error || !Array.isArray(data)) return [];

      return data.map((row: any) => ({
        id: String(row.id),
        weekday: Number(row.weekday),
        startTime: formatTimeLabel(row.start_time),
        endTime: formatTimeLabel(row.end_time),
        room: String(row.room || '').trim(),
        teacherName: String(row.teacher_name || '').trim(),
      }));
    } catch (e) {
      console.error('Supabase group times fetch error:', e);
      return [];
    }
  },

  // Insert Join Request
  async createJoinRequest(request: {
    studentName: string;
    parentPhone: string;
    studentPhone: string;
    academicStage: string;
    grade: string;
    academicGroup: string;
    gender: string;
  }): Promise<{ success: boolean; message: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('تعذر إرسال طلب الانضمام لأن اتصال Supabase غير مهيأ.');
    }

    const client = getSupabase();
    try {
      const { error } = await client.from('join_requests').insert({
        reference_code: buildJoinReferenceCode(),
        student_name: request.studentName.trim(),
        parent_phone: normalizePhoneNumber(request.parentPhone),
        student_phone: normalizePhoneNumber(request.studentPhone) || null,
        academic_stage: request.academicStage.trim(),
        academic_grade: request.grade.trim(),
        desired_group: request.academicGroup.trim() || 'غير محدد',
        note: request.gender.trim() ? `النوع: ${request.gender.trim()}` : null,
        status: 'pending',
        created_at: nowIso(),
        updated_at: nowIso(),
      });

      if (error) {
        console.error('Supabase Join Request error:', error);
        throw new Error('تعذر إرسال طلب الانضمام إلى الإدارة. حاول مرة أخرى بعد التأكد من الاتصال.');
      }

      return {
        success: true,
        message: 'تم تسجيل طلب الانضمام بنجاح، وسيتم التواصل معكم بعد مراجعته من الإدارة.',
      };
    } catch (e) {
      console.error('Supabase Join Request exception:', e);
      if (e instanceof Error) throw e;
      throw new Error('حدث خطأ أثناء الاتصال بقاعدة البيانات. لم يتم تسجيل الطلب.');
    }
  },

  // Load attendance
  async getAttendance(studentId: string): Promise<AttendanceRecord[]> {
    let supabaseRecords: AttendanceRecord[] = [];
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      try {
        const { data, error } = await client
          .from('attendance')
          .select('*')
          .eq('tenant_id', PORTAL_TENANT_ID)
          .eq('student_id', studentId)
          .is('deleted_at', null)
          .order('date', { ascending: false })
          .order('recorded_at', { ascending: false })
          .limit(1000);

        if (!error && Array.isArray(data)) {
          const legacySessionIds = Array.from(
            new Set(data.map((row: any) => safeUuid(row?.session_id)).filter((value): value is string => Boolean(value))),
          );
          const operationalSessionIds = Array.from(
            new Set(data.map((row: any) => safeUuid(row?.operational_session_id)).filter((value): value is string => Boolean(value))),
          );

          const [{ data: legacyRows }, { data: operationalRows }, fallbackGroup] = await Promise.all([
            legacySessionIds.length
              ? client.from('sessions').select('id,group_id,start_time,starts_at,date,metadata').in('id', legacySessionIds)
              : Promise.resolve({ data: [] as any[] }),
            operationalSessionIds.length
              ? client
                  .from('daily_sessions')
                  .select('id,group_id,start_time,date,group_name_snapshot,teacher_snapshot,lifecycle_state')
                  .in('id', operationalSessionIds)
              : Promise.resolve({ data: [] as any[] }),
            resolveStudentGroupSummary(client, studentId).catch(() => null),
          ]);

          const sessionRows = [
            ...(Array.isArray(legacyRows) ? legacyRows : []),
            ...(Array.isArray(operationalRows) ? operationalRows : []),
          ];
          const groupIds = Array.from(
            new Set(
              [
                ...sessionRows.map((row: any) => safeUuid(row?.group_id)),
                safeUuid(fallbackGroup?.id),
              ].filter((value): value is string => Boolean(value)),
            ),
          );

          const { data: groupRows } = groupIds.length
            ? await client.from('groups').select('id,name,subject,teacher,teacher_name').in('id', groupIds)
            : { data: [] as any[] };

          const sessionMap = new Map(sessionRows.map((row: any) => [String(row.id), row]));
          const groupMap = new Map((Array.isArray(groupRows) ? groupRows : []).map((row: any) => [String(row.id), row]));
          if (fallbackGroup?.id && !groupMap.has(String(fallbackGroup.id))) {
            groupMap.set(String(fallbackGroup.id), fallbackGroup);
          }

          supabaseRecords = data.map((row: any) => {
            const session = sessionMap.get(String(getAttendanceSessionId(row) || ''));
            const group = groupMap.get(String(session?.group_id || fallbackGroup?.id || ''));
            const metadataName =
              typeof session?.metadata === 'object' && session?.metadata
                ? String((session.metadata as Record<string, unknown>).title || (session.metadata as Record<string, unknown>).name || '')
                : '';
            const status = String(row.status || '').trim().toLowerCase();

            return {
              id: String(row.id),
              date: formatDateOnly(row.date || row.recorded_at || row.client_timestamp),
              subject: String(group?.subject || group?.name || session?.group_name_snapshot || metadataName || 'الحصة الدراسية').trim(),
              time: formatTimeLabel(session?.start_time || session?.starts_at || row.recorded_at || row.client_timestamp),
              status: status === 'late' ? 'late' : status === 'present' ? 'present' : status === 'excused' ? 'excused' : 'absent',
              lecturer: String(group?.teacher_name || group?.teacher || session?.teacher_snapshot || 'سنتر ألفا').trim(),
              remarks: String(row.note || row.reason || '').trim() || undefined,
            };
          });
        }
      } catch (e) {
        console.error(e);
      }
    }

    let snapshotRecords: AttendanceRecord[] = [];
    const snapshotEntry = await getStudentSnapshotEntry(studentId);
    if (snapshotEntry && Array.isArray(snapshotEntry.attendance)) {
      snapshotRecords = snapshotEntry.attendance.map((row: any) => {
      const status = String(row.status || '').trim().toLowerCase();
      return {
        id: String(row.id),
        date: formatDateOnly(row.date || row.recorded_at),
        subject: String(row.session_name || row.subject || 'الحصة الدراسية').trim(),
        time: formatTimeLabel(row.check_in_time || row.time),
        status: status === 'late' ? 'late' : status === 'present' ? 'present' : status === 'excused' ? 'excused' : 'absent',
        lecturer: String(row.lecturer || 'سنتر ألفا').trim(),
        remarks: String(row.note || row.reason || '').trim() || undefined,
      };
      });
    }

    const mergedMap = new Map<string, AttendanceRecord>();
    snapshotRecords.forEach((rec) => mergedMap.set(rec.id, rec));
    supabaseRecords.forEach((rec) => mergedMap.set(rec.id, rec));

    const finalRecords = Array.from(mergedMap.values());
    if (finalRecords.length > 0) {
      recordPortalDataRead('attendance', !isSupabaseConfigured() ? 'snapshot' : 'live');
      return finalRecords.sort((left, right) => getDateSortTime(right.date) - getDateSortTime(left.date));
    }

    recordPortalDataRead('attendance', !isSupabaseConfigured() ? 'snapshot' : 'live');
    return [];
  },

  // Load payments
  async getPayments(studentId: string): Promise<PaymentRecord[]> {
    let supabaseRecords: PaymentRecord[] = [];
    let isOutstanding = false;
    let outstandingAmt = 0;
    let studentCode = '';
    
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      try {
        const [{ data, error }, { data: studentRow }] = await Promise.all([
          client
            .from('payments')
            .select('*')
            .eq('tenant_id', PORTAL_TENANT_ID)
            .eq('student_id', studentId)
            .is('deleted_at', null)
            .order('paid_at', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1000),
          client
            .from('students')
            .select('id,student_code,balance')
            .eq('tenant_id', PORTAL_TENANT_ID)
            .eq('id', studentId)
            .maybeSingle(),
        ]);

        if (studentRow) {
          studentCode = (studentRow as any).student_code || '';
          outstandingAmt = outstandingBalanceFromStudent(studentRow as Record<string, any>);
          if (outstandingAmt > 0) {
            isOutstanding = true;
          }
        }

        if (!error && Array.isArray(data)) {
          const paymentRows: PaymentRecord[] = data.map((row: any) => ({
            id: String(row.id),
            title: String(row.notes || row.method || 'دفعة مالية').trim(),
            amount: Number(row.amount || 0),
            dueDate: formatDateOnly(row.date || row.paid_at || row.created_at),
            paidDate: row.paid_at ? formatDateOnly(row.paid_at) : undefined,
            status: toPaymentStatus(row.status || (row.paid_at ? 'paid' : 'pending')),
            invoiceNo: String(row.receipt_no || row.id),
            category: inferPaymentCategory(row.notes || row.method),
          }));
          let rows = paymentRows;

          try {
            const { data: ledgerRows, error: ledgerError } = await client
              .from('financial_ledger')
              .select('id,student_id,payment_id,reference_id,reference_type,entry_type,account_code,amount,currency,created_at,deleted_at,transaction_id')
              .eq('tenant_id', PORTAL_TENANT_ID)
              .eq('student_id', studentId)
              .eq('reference_type', 'payment')
              .eq('entry_type', 'debit')
              .is('deleted_at', null)
              .order('created_at', { ascending: false });

            if (!ledgerError && Array.isArray(ledgerRows) && ledgerRows.length > 0) {
              const knownPayments = new Map(data.map((row: any) => [String(row.id), row]));
              const missingPaymentIds = Array.from(
                new Set(
                  ledgerRows
                    .map((row: any) => safeUuid(row?.payment_id) || safeUuid(row?.reference_id))
                    .filter((value: string | null): value is string => Boolean(value) && !knownPayments.has(value)),
                ),
              );
              if (missingPaymentIds.length > 0) {
                const { data: linkedPaymentRows } = await client
                  .from('payments')
                  .select('*')
                  .eq('tenant_id', PORTAL_TENANT_ID)
                  .in('id', missingPaymentIds);
                if (Array.isArray(linkedPaymentRows)) {
                  linkedPaymentRows.forEach((row: any) => knownPayments.set(String(row.id), row));
                }
              }

              const ledgerPaymentRows: PaymentRecord[] = ledgerRows.map((ledger: any) => {
                const paymentId = safeUuid(ledger?.payment_id) || safeUuid(ledger?.reference_id) || '';
                const payment = knownPayments.get(paymentId);
                return {
                  id: String(payment?.id || paymentId || ledger.id),
                  title: String(payment?.notes || payment?.method || ledger?.account_code || 'دفعة مالية').trim(),
                  amount: Number(payment?.amount ?? ledger?.amount ?? 0),
                  dueDate: formatDateOnly(payment?.date || payment?.paid_at || payment?.created_at || ledger?.created_at),
                  paidDate: payment?.paid_at ? formatDateOnly(payment.paid_at) : formatDateOnly(ledger?.created_at),
                  status: toPaymentStatus(payment?.status || payment?.paid_at || 'paid'),
                  invoiceNo: String(payment?.receipt_no || ledger?.transaction_id || ledger?.id),
                  category: inferPaymentCategory(payment?.notes || payment?.method || ledger?.account_code),
                };
              });
              rows = mergePaymentRecords([...paymentRows, ...ledgerPaymentRows]);
            }
          } catch {
            rows = paymentRows;
          }

          supabaseRecords = rows;
        }
      } catch (e) {
        console.error(e);
      }
    }

    let snapshotRecords: PaymentRecord[] = [];
    if (!isSupabaseConfigured()) {
      const snapshotEntry = await getStudentSnapshotEntry(studentId);
      if (snapshotEntry) {
        if (Array.isArray(snapshotEntry.payments)) {
          snapshotRecords = snapshotEntry.payments.map((row: any) => ({
          id: String(row.id),
          title: String(row.title || 'دفعة مالية').trim(),
          amount: Number(row.amount || 0),
          dueDate: formatDateOnly(row.due_date),
          paidDate: row.paid_at ? formatDateOnly(row.paid_at) : undefined,
          status: toPaymentStatus(row.status || (row.paid_at ? 'paid' : 'pending')),
          invoiceNo: String(row.invoice_no || row.id),
          category: inferPaymentCategory(row.title),
          }));
        }
        if (!studentCode && snapshotEntry.student) {
          studentCode = snapshotEntry.student.student_code || '';
        }
      }
    }

    const mergedMap = new Map<string, PaymentRecord>();
    snapshotRecords.forEach((rec) => mergedMap.set(rec.id, rec));
    supabaseRecords.forEach((rec) => mergedMap.set(rec.id, rec));

    let finalRecords = Array.from(mergedMap.values());

    if (isOutstanding && !finalRecords.some((row) => row.status === 'pending' || row.status === 'overdue')) {
      finalRecords.unshift({
        id: `balance-${studentId}`,
        title: 'رصيد مستحق',
        amount: outstandingAmt,
        dueDate: new Date().toISOString().slice(0, 10),
        status: 'pending',
        invoiceNo: `BAL-${String(studentCode || studentId).slice(-6).toUpperCase()}`,
        category: 'tuition',
      });
    }

    if (finalRecords.length > 0) {
      recordPortalDataRead('payments', !isSupabaseConfigured() ? 'snapshot' : 'live');
      return finalRecords.sort((left, right) => getDateSortTime(right.paidDate || right.dueDate) - getDateSortTime(left.paidDate || left.dueDate));
    }

    recordPortalDataRead('payments', !isSupabaseConfigured() ? 'snapshot' : 'live');
    return [];
  },

  // Load grades
  async getGrades(studentId: string): Promise<GradeRecord[]> {
    let supabaseRecords: GradeRecord[] = [];

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      try {
        const { data, error } = await client
          .from('grades')
          .select('*')
          .eq('tenant_id', PORTAL_TENANT_ID)
          .eq('student_id', studentId)
          .is('deleted_at', null)
          .order('assessment_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1000);

        if (!error && Array.isArray(data)) {
          supabaseRecords = data.map((row: any) => ({
            id: String(row.id),
            subjectCode: String(row.assessment_id || row.id || '').slice(0, 12).toUpperCase(),
            subjectName: String(row.subject || 'تقييم').trim(),
            category: mapGradeCategory(row.type),
            score: Number(row.score || 0),
            maxScore: Number(row.max_score || 0),
            gradeLetter: String(row.letter_grade || percentageToLetter(Number(row.percentage || 0)) || 'N/A'),
            date: formatDateOnly(row.assessment_date || row.created_at),
            feedback: String(row.remarks || '').trim() || undefined,
            gpaWeight: percentageToGpa(Number(row.percentage || 0)),
            passed: Number(row.percentage || 0) >= 60,
            sourceExamId: String(row.assessment_id || '').trim() || undefined,
          }));
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Merge snapshot grades
    let snapshotRecords: GradeRecord[] = [];
    if (!isSupabaseConfigured()) {
      const snapshotEntry = await getStudentSnapshotEntry(studentId);
      if (snapshotEntry && Array.isArray(snapshotEntry.grades)) {
        snapshotRecords = snapshotEntry.grades.map((row: any) => {
        // Support both legacy snapshot fields (exam_name/exam_date/percentage) and standard fields
        const rawPercentage = Number(row.percentage || 0);
        const percentage = row.max_score > 0
          ? Number(((Number(row.score || 0) / Number(row.max_score)) * 100).toFixed(2))
          : rawPercentage;
        const finalPercentage = percentage || rawPercentage;
        const maxScore = Number(row.max_score || 100);
        const score = Number(row.score ?? (finalPercentage * maxScore / 100));
        return {
          id: String(row.id),
          subjectCode: String(row.subject_code || row.assessment_id || row.id || '').slice(0, 12).toUpperCase(),
          subjectName: String(row.subject_name || row.exam_name || row.subject || 'تقييم').trim(),
          category: mapGradeCategory(row.category || row.type || 'midterm'),
          score,
          maxScore,
          gradeLetter: String(row.grade_letter || row.letter_grade || percentageToLetter(finalPercentage) || 'N/A'),
          date: formatDateOnly(row.date || row.exam_date || row.assessment_date || row.created_at),
          feedback: String(row.feedback || row.remarks || '').trim() || undefined,
          gpaWeight: percentageToGpa(finalPercentage),
          passed: finalPercentage >= 60,
          sourceExamId: String(row.assessment_id || '').trim() || undefined,
        };
        });
      }
    }

    const mergedMap = new Map<string, GradeRecord>();
    snapshotRecords.forEach((rec) => mergedMap.set(rec.id, rec));
    supabaseRecords.forEach((rec) => mergedMap.set(rec.id, rec));

    const finalRecords = Array.from(mergedMap.values());
    if (finalRecords.length > 0) {
      recordPortalDataRead('grades', !isSupabaseConfigured() ? 'snapshot' : 'live');
      return finalRecords.sort((a, b) => getDateSortTime(b.date) - getDateSortTime(a.date));
    }

    recordPortalDataRead('grades', !isSupabaseConfigured() ? 'snapshot' : 'live');
    return [];
  },

  // Insert excuse/attendance
  async createExcuse(excuse: {
    studentId: string;
    date: string;
    subject: string;
    timeSlot: string;
    status: AttendanceStatus;
    lecturer: string;
    remarks: string;
  }): Promise<{ success: boolean; error?: any }> {
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      try {
        const { error } = await client.from('attendance').insert({
          id: crypto.randomUUID(),
          tenant_id: PORTAL_TENANT_ID,
          student_id: excuse.studentId,
          status: excuse.status,
          client_timestamp: nowIso(),
          recorded_at: nowIso(),
          idempotency_key: `portal-excuse-${Date.now()}`,
          version: 1,
          created_at: nowEpochMs(),
          updated_at: nowEpochMs(),
          deleted_at: null,
          date: excuse.date,
          device_id: PORTAL_DEVICE_ID,
        });
        if (!error) return { success: true };
        console.error('Error creating excuse in Supabase:', error);
        return { success: false, error };
      } catch (e) {
        console.error(e);
        return { success: false, error: e };
      }
    }
    return { success: false, error: 'Supabase is not configured.' };
  },

  // Pay Invoice
  async payInvoice(invoiceId: string, paidDate: string): Promise<{ success: boolean; error?: any }> {
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      try {
        const { error } = await client
          .from('payments')
          .update({
            status: 'paid',
            paid_at: new Date(`${paidDate}T12:00:00`).toISOString(),
            updated_at: nowEpochMs(),
          })
          .eq('tenant_id', PORTAL_TENANT_ID)
          .eq('id', invoiceId);
        if (!error) return { success: true };
        console.error('Error paying invoice in Supabase:', error);
        return { success: false, error };
      } catch (e) {
        console.error(e);
        return { success: false, error: e };
      }
    }
    return { success: false, error: 'Supabase is not configured.' };
  },

  // Insert Grade
  async insertGrade(grade: Omit<GradeRecord, 'id'> & { id?: string }, studentId: string): Promise<{ success: boolean; error?: any }> {
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      try {
        const { data: studentRow } = await client
          .from('students')
          .select('id,name,grade_level')
          .eq('tenant_id', PORTAL_TENANT_ID)
          .eq('id', studentId)
          .maybeSingle();

        const percentage = grade.maxScore > 0 ? Number(((grade.score / grade.maxScore) * 100).toFixed(2)) : 0;
        const { error } = await client
          .from('grades')
          .upsert(
            {
              id: String(grade.id || grade.sourceExamId || crypto.randomUUID()),
              tenant_id: PORTAL_TENANT_ID,
              student_id: studentId,
              student_name: String((studentRow as any)?.name || '').trim() || null,
              subject: grade.subjectName,
              grade_level: String((studentRow as any)?.grade_level || '').trim() || null,
              type: grade.category,
              score: grade.score,
              max_score: grade.maxScore,
              assessment_date: grade.date,
              group_id: null,
              teacher_name: 'Student Portal',
              remarks: grade.feedback || null,
              percentage,
              letter_grade: grade.gradeLetter || percentageToLetter(percentage),
              assessment_id: grade.sourceExamId || null,
              version: 1,
              device_id: PORTAL_DEVICE_ID,
              created_at: nowIso(),
              updated_at: nowIso(),
              deleted_at: null,
            },
            { onConflict: 'id' },
          );
        if (!error) return { success: true };
        console.error('Error inserting grade in Supabase:', error);
        return { success: false, error };
      } catch (e) {
        console.error(e);
        return { success: false, error: e };
      }
    }
    return { success: false, error: 'Supabase is not configured.' };
  },

  // Insert Exam Result
  async insertExamResult(result: {
    examId: string;
    studentId: string;
    studentCode: string;
    studentPhone?: string;
    tenantId?: string;
    answers: Record<string, string>;
  }): Promise<{ success: boolean; error?: any; result?: SavedExamResult }> {
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      try {
        const resultTenantId = String(result.tenantId || '').trim() || PORTAL_TENANT_ID;
        const { data, error } = await client.rpc('portal_submit_platform_exam_result', {
          p_tenant_id: resultTenantId,
          p_exam_id: result.examId,
          p_student_id: result.studentId,
          p_student_code: result.studentCode,
          p_student_phone: result.studentPhone || '',
          p_answers: result.answers,
        });

        if (error) {
          console.error('Error submitting platform exam result in Supabase:', error);
          return { success: false, error };
        }

        const savedRow = Array.isArray(data) ? data[0] : data;
        if (!savedRow) {
          return { success: false, error: 'No exam result was returned from Supabase.' };
        }

        const maxScore = Number(savedRow.max_score || 0);
        const score = Number(savedRow.score || 0);
        const percentage = Number(savedRow.percentage ?? (maxScore > 0 ? (score / maxScore) * 100 : 0));

        return {
          success: true,
          result: {
            score,
            maxScore,
            percentage,
            passed: Boolean(savedRow.passed),
            correctAnswersCount: Number(savedRow.correct_answers_count || 0),
            wrongAnswersCount: Number(savedRow.wrong_answers_count || 0),
            unansweredAnswersCount: Number(savedRow.unanswered_answers_count || 0),
            assessmentDate: String(savedRow.assessment_date || new Date().toISOString()),
            alreadySubmitted: Boolean(savedRow.already_submitted),
          },
        };
      } catch (e) {
        console.error(e);
        return { success: false, error: e };
      }
    }
    return { success: false, error: 'Supabase is not configured.' };
  },

  // Load exams
  async getExams(student?: PortalExamStudent): Promise<Exam[]> {
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      try {
        const { data: platformExamRows, error: platformExamsError } = await client
          .from('platform_exams')
          .select('*')
          .eq('tenant_id', PORTAL_TENANT_ID)
          .eq('active', true)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (!platformExamsError && Array.isArray(platformExamRows) && platformExamRows.length > 0) {
          const groupSummary = student?.id ? await resolveStudentGroupSummary(client, student.id) : null;
          const visibleExamRows = platformExamRows.filter((exam: any) =>
            examMatchesStudentAudience(exam, student, groupSummary),
          );

          if (visibleExamRows.length === 0) {
            recordPortalDataRead('exams', 'live');
            return [];
          }

          let completedPlatformExamIds = new Set<string>();

          const studentVerificationPhone = student?.studentPhone || student?.parentPhone || '';
          if (student?.id && studentVerificationPhone) {
            const { data: completedExamRows, error: completedExamsError } = await client.rpc(
              'portal_completed_platform_exam_ids',
              {
                p_tenant_id: PORTAL_TENANT_ID,
                p_student_id: student.id,
                p_student_code: student.studentCode,
                p_student_phone: studentVerificationPhone,
              },
            );

            if (!completedExamsError && Array.isArray(completedExamRows)) {
              completedPlatformExamIds = new Set(
                completedExamRows.map((row: any) => String(row.exam_id || '').trim()).filter(Boolean),
              );
            } else if (completedExamsError) {
              throw completedExamsError;
            }
          }

          const platformExams = await Promise.all(
            visibleExamRows.map(async (exam: any) => {
              const { data: platformQuestionRows, error: platformQuestionsError } = await client
                .from('platform_questions')
                .select('id,exam_id,question_text,points,order_index,question_type,page_number')
                .eq('exam_id', exam.id)
                .is('deleted_at', null)
                .order('order_index', { ascending: true });

              if (platformQuestionsError || !Array.isArray(platformQuestionRows)) {
                throw platformQuestionsError || new Error('platform_questions_invalid_response');
              }

              const questions: ExamQuestion[] = await Promise.all(
                platformQuestionRows.map(async (question: any) => {
                  const { data: platformChoiceRows, error: platformChoicesError } = await client
                    .from('platform_choices')
                    .select('id,question_id,choice_text,order_index')
                    .eq('question_id', question.id)
                    .is('deleted_at', null)
                    .order('order_index', { ascending: true });

                  if (platformChoicesError || !Array.isArray(platformChoiceRows)) {
                    throw platformChoicesError || new Error('platform_choices_invalid_response');
                  }

                  const choices = platformChoiceRows.map((choice: any) => ({
                    id: String(choice.id || ''),
                    text: String(choice.choice_text || '').trim(),
                  }));

                  return {
                    id: String(question.id || ''),
                    text: String(question.question_text || '').trim(),
                    options: choices,
                    points: Number(question.points || 1),
                    questionType: readPlatformQuestionType(question, choices.length),
                    pageNumber: Number(question.page_number || 0) || undefined,
                  };
                }),
              );

              const description = typeof exam.description === 'string' ? exam.description.trim() : '';
              const totalQuestionPoints = questions.reduce((sum, question) => sum + question.points, 0);

              return {
                id: String(exam.id || ''),
                tenantId: String(exam.tenant_id || '').trim() || undefined,
                gradeLevel: String(exam.grade_level || '').trim() || undefined,
                code: String(exam.id || '').slice(0, 8).toUpperCase(),
                title: String(exam.title || '').trim(),
                subject: String(exam.subject || '').trim(),
                durationMinutes: Number(exam.duration_minutes || 30),
                totalPoints: totalQuestionPoints || Number(exam.max_score || 20),
                questionsCount: questions.length,
                questions,
                instructions: description
                  ? [description]
                  : [
                      'اقرأ التعليمات جيداً قبل البدء في الاختبار.',
                      'سيتم حفظ نتيجتك مباشرة في المنصة بعد الإرسال.',
                      'لا تغادر صفحة الاختبار أثناء الحل حتى لا يتم إنهاء الجلسة.',
                    ],
                passingScorePercent: 60,
                status: completedPlatformExamIds.has(String(exam.id || '').trim())
                  ? 'completed'
                  : (exam.active ? 'available' : 'expired'),
              } as Exam;
            }),
          );

          recordPortalDataRead('exams', 'live');
          return platformExams;
        }

      } catch (e) {
        console.error("Error loading exams from Supabase:", e);
      }
    }
    recordPortalDataRead('exams', isSupabaseConfigured() ? 'live' : 'snapshot');
    return [];
  }
};
