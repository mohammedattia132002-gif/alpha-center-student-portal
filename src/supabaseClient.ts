/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';
import { StudentProfile, AttendanceRecord, PaymentRecord, GradeRecord, Exam, ExamAttempt, ExamQuestion, AttendanceStatus, GroupTimeSlot } from './types';
import { fetchAllRows } from './lib/supabasePagination';

// Read configuration gracefully from import.meta.env
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
const PORTAL_TENANT_ID =
  (import.meta as any).env?.VITE_TENANT_ID ||
  (import.meta as any).env?.VITE_DEV_BYPASS_TENANT_ID ||
  'af975d96-5310-48b8-a5df-f88518ef0557';
const PORTAL_DEVICE_ID = 'student-portal-web';
const PLATFORM_EXAM_ASSETS_BUCKET = 'secure-files';
const PLATFORM_QUESTION_SELECT_COLUMNS = [
  'id',
  'exam_id',
  'question_text',
  'points',
  'order_index',
  'question_type',
  'page_number',
  'image_url',
  'image_storage_path',
  'deleted_at',
].join(',');
const PLATFORM_CHOICE_SELECT_COLUMNS = [
  'id',
  'question_id',
  'choice_text',
  'order_index',
  'deleted_at',
].join(',');
const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=256&h=256&auto=format&fit=crop';

// Lazy initialization of Supabase client to prevent immediate startup crash
let _supabaseClient: any = null;
export type PortalDataReadKey = 'profile' | 'attendance' | 'payments' | 'grades' | 'exams' | 'groupTimes';
export type PortalDataReadSource = 'live';
export type PortalJoinFieldKey =
  | 'student_name'
  | 'student_code'
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

export interface PortalDataReadMeta {
  at: number;
  source: PortalDataReadSource;
}

type PortalReadDiagnosticContext = Record<string, unknown>;

type FetchRowsWithFallbackOptions = {
  orderVariants?: string[][];
  continueOnEmpty?: boolean;
  diagnosticContext?: PortalReadDiagnosticContext;
};

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

function normalizePortalReadError(error: unknown): unknown {
  if (!error || typeof error !== 'object') return error;
  const record = error as Record<string, unknown>;
  return {
    message: record.message,
    code: record.code,
    details: record.details,
    hint: record.hint,
  };
}

function logPortalReadError(tableName: string, context: PortalReadDiagnosticContext, error: unknown): void {
  console.warn('[portal] Supabase read failed. Check RLS tenant policies and sync status.', {
    table: tableName,
    tenantId: PORTAL_TENANT_ID,
    ...context,
    error: normalizePortalReadError(error),
  });
}

function isMissingColumnError(error: unknown, columnName: string): boolean {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  return record.code === '42703' && String(record.message || '').includes(columnName);
}

function logPortalReadErrorUnlessMissingColumn(
  tableName: string,
  context: PortalReadDiagnosticContext,
  error: unknown,
  columnName: string,
): void {
  if (isMissingColumnError(error, columnName)) return;
  logPortalReadError(tableName, context, error);
}

function logPortalEmptyRead(tableName: string, context: PortalReadDiagnosticContext): void {
  console.warn('[portal] Supabase read returned 0 rows. If desktop has data, check RLS tenant policies and sync status.', {
    table: tableName,
    tenantId: PORTAL_TENANT_ID,
    ...context,
  });
}

export const DEFAULT_PORTAL_JOIN_SETTINGS: PortalJoinSettings = {
  fields: {
    student_name: { visible: true, required: true },
    student_code: { visible: true, required: false },
    parent_phone: { visible: true, required: true },
    student_phone: { visible: true, required: false },
    academic_stage: { visible: true, required: true },
    grade: { visible: true, required: true },
    academic_group: { visible: true, required: false },
    gender: { visible: true, required: false },
  },
  stages: {},
  grades: {},
};

const PORTAL_JOIN_FIELD_KEYS = Object.keys(DEFAULT_PORTAL_JOIN_SETTINGS.fields) as PortalJoinFieldKey[];

function normalizePortalJoinSettings(value: unknown): PortalJoinSettings {
  const parsed = typeof value === 'string' && value.trim() ? JSON.parse(value) : value;
  const record = parsed && typeof parsed === 'object' ? parsed as Partial<PortalJoinSettings> : {};
  const fields = { ...DEFAULT_PORTAL_JOIN_SETTINGS.fields };
  const stages: Record<string, boolean> = {};
  const grades: Record<string, boolean> = {};

  for (const key of PORTAL_JOIN_FIELD_KEYS) {
    const fallback = DEFAULT_PORTAL_JOIN_SETTINGS.fields[key];
    const row = record.fields?.[key];
    const field = row && typeof row === 'object' ? row as Partial<PortalJoinFieldConfig> : {};
    const visible = typeof field.visible === 'boolean' ? field.visible : fallback.visible;
    const required = visible && (typeof field.required === 'boolean' ? field.required : fallback.required);
    fields[key] = { visible, required };
  }

  if (record.stages && typeof record.stages === 'object') {
    for (const [stage, visible] of Object.entries(record.stages)) {
      if (typeof visible === 'boolean') {
        stages[stage] = visible;
      }
    }
  }

  if (record.grades && typeof record.grades === 'object') {
    for (const [grade, visible] of Object.entries(record.grades)) {
      if (typeof visible === 'boolean') {
        grades[grade] = visible;
      }
    }
  }

  return { fields, stages, grades };
}

function recordPortalDataRead(key: PortalDataReadKey, source: PortalDataReadSource): void {
  lastPortalDataReads[key] = {
    at: Date.now(),
    source,
  };
}

export function getPortalDataReadMeta(key: PortalDataReadKey): PortalDataReadMeta | null {
  return lastPortalDataReads[key] ?? null;
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

const DAY_NAME_TO_WEEKDAY: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function dayNameToWeekday(value: string): number {
  const normalized = value.trim().toLowerCase();
  return normalized in DAY_NAME_TO_WEEKDAY ? DAY_NAME_TO_WEEKDAY[normalized] : 0;
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

function mergeRowsById<T extends Record<string, any>>(records: T[]): T[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = String(record.id || '').trim();
    if (!key) return true;
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

function inferExamMode(row: Record<string, any>): GradeRecord['examMode'] {
  const id = String(row.id || '').trim();
  const teacherName = String(row.teacher_name || row.teacherName || '').trim().toLowerCase();
  const remarks = String(row.remarks || '').trim().toLowerCase();
  const deviceId = String(row.device_id || row.deviceId || '').trim().toLowerCase();

  if (
    id.startsWith('platform_result_') ||
    teacherName === 'student portal' ||
    deviceId === 'student-portal-web' ||
    remarks.includes('student portal') ||
    remarks.includes('platform') ||
    remarks.includes('إلكتروني') ||
    remarks.includes('منصة')
  ) {
    return 'electronic';
  }

  return 'paper';
}

function buildJoinReferenceCode(): string {
  return `JR-${Date.now().toString(36).toUpperCase()}`;
}

function isFulfilled<T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> {
  return result.status === 'fulfilled';
}

async function fetchRowsWithFallback<T = any>(
  client: any,
  tableName: string,
  configureVariants: Array<(query: any) => any>,
  options: FetchRowsWithFallbackOptions = {},
): Promise<T[]> {
  const { orderVariants = [[]], continueOnEmpty = false, diagnosticContext = {} } = options;
  let lastError: unknown = null;
  let emptyResult: T[] | null = null;

  for (const configure of configureVariants) {
    for (const orderColumns of orderVariants) {
      try {
        const rows = await fetchAllRows<T>(client, tableName, (query) => {
          let nextQuery = configure(query);
          for (const column of orderColumns) {
            nextQuery = nextQuery.order(column, { ascending: false });
          }
          return nextQuery;
        });
        if (!continueOnEmpty || rows.length > 0) return rows;
        emptyResult = rows;
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (emptyResult) {
    logPortalEmptyRead(tableName, {
      ...diagnosticContext,
      queryVariants: configureVariants.length,
      orderVariants: orderVariants.map((columns) => columns.join(',') || 'none'),
    });
    return emptyResult;
  }
  if (lastError) throw lastError;
  return [];
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
    .select('id,name,grade_level,subject,teacher,teacher_name')
    .eq('id', groupId)
    .maybeSingle();

  return groupRow || { id: groupId, grade_level: studentRow?.grade_level };
}

async function resolveStudentEnrollmentRows(client: any, studentId: string): Promise<Array<Record<string, any>>> {
  try {
    const data = await fetchRowsWithFallback<Record<string, any>>(
      client,
      'enrollments',
      [
        (query) => query.eq('tenant_id', PORTAL_TENANT_ID).eq('student_id', studentId).is('deleted_at', null),
        (query) => query.eq('tenant_id', PORTAL_TENANT_ID).eq('student_id', studentId),
        (query) => query.eq('student_id', studentId).is('deleted_at', null),
        (query) => query.eq('student_id', studentId),
      ],
      {
        orderVariants: [['updated_at'], ['created_at'], []],
        continueOnEmpty: true,
        diagnosticContext: { studentId, relation: 'attendance-enrollments' },
      },
    );

    return mergeRowsById(data).filter((row) => {
      if (row?.deleted_at) return false;
      if (row?.is_active === false) return false;
      return true;
    });
  } catch (error) {
    logPortalReadError('attendance', { studentId, relation: 'attendance-enrollments' }, error);
    return [];
  }
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

function readDirectQuestionImageUrl(question: Record<string, any>): string {
  const rawUrl = String(question.image_url || '').trim();
  if (/^https?:\/\//i.test(rawUrl) || /^data:image\//i.test(rawUrl)) return rawUrl;
  return '';
}

function readQuestionImageStoragePath(question: Record<string, any>): string {
  const storagePath = String(question.image_storage_path || '').trim();
  if (storagePath) return storagePath;

  const legacyImageUrl = String(question.image_url || '').trim();
  return legacyImageUrl.startsWith('platform-exams/') ? legacyImageUrl : '';
}

async function resolvePlatformQuestionImage(
  client: any,
  question: Record<string, any>,
): Promise<{ imageUrl?: string; imageStoragePath?: string }> {
  const imageStoragePath = readQuestionImageStoragePath(question);
  const directImageUrl = readDirectQuestionImageUrl(question);
  if (directImageUrl) return { imageUrl: directImageUrl, imageStoragePath: imageStoragePath || undefined };
  if (!imageStoragePath) return {};

  const { data, error } = await client
    .storage
    .from(PLATFORM_EXAM_ASSETS_BUCKET)
    .createSignedUrl(imageStoragePath, 60 * 60);

  if (error) {
    console.warn('[portal] platform question image signing failed:', error);
    return { imageStoragePath };
  }

  return {
    imageUrl: String(data?.signedUrl || '').trim() || undefined,
    imageStoragePath,
  };
}

async function buildStudentProfile(client: any, studentRow: Record<string, any>): Promise<StudentProfile> {
  const groupName = await resolveGroupName(client, studentRow);
  return {
    id: String(studentRow.id || ''),
    name: String(studentRow.name || 'طالب'),
    avatar: String(studentRow.photo_url || '').trim() || DEFAULT_AVATAR,
    department: groupName,
    academicYear: String(studentRow.grade_level || 'غير محدد'),
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

    if (!isSupabaseConfigured()) {
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

      if (error) {
        logPortalReadError('app_settings', { settingKeys: ['teacher_name', 'subject_name', 'center_name'] }, error);
        return null;
      }
      if (!Array.isArray(data)) return null;
      if (data.length === 0) {
        logPortalEmptyRead('app_settings', { settingKeys: ['teacher_name', 'subject_name', 'center_name'] });
      }

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
      logPortalReadError('app_settings', { settingKeys: ['teacher_name', 'subject_name', 'center_name'] }, e);
      return null;
    }
  },

  // Read the real active groups defined on the desktop so the join-request form
  // offers actual center groups instead of hardcoded placeholders.
  async getActiveGroups(): Promise<Array<{ id: string; name: string; gradeLevel: string }>> {
    if (!isSupabaseConfigured()) {
      return [];
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

    return [];
  },

  async getPortalJoinSettings(): Promise<PortalJoinSettings> {
    if (!isSupabaseConfigured()) {
      return DEFAULT_PORTAL_JOIN_SETTINGS;
    }

    const client = getSupabase();
    try {
      const { data, error } = await client
        .from('app_settings')
        .select('setting_value')
        .eq('tenant_id', PORTAL_TENANT_ID)
        .eq('setting_key', 'portal_join_config')
        .is('deleted_at', null)
        .maybeSingle();

      if (error) {
        logPortalReadError('app_settings', { settingKey: 'portal_join_config' }, error);
        return DEFAULT_PORTAL_JOIN_SETTINGS;
      }
      if (!data) {
        logPortalEmptyRead('app_settings', { settingKey: 'portal_join_config' });
        return DEFAULT_PORTAL_JOIN_SETTINGS;
      }

      return normalizePortalJoinSettings((data as any).setting_value);
    } catch (error) {
      logPortalReadError('app_settings', { settingKey: 'portal_join_config' }, error);
      return DEFAULT_PORTAL_JOIN_SETTINGS;
    }
  },

// Load group schedule times for the student's group
  async getGroupTimes(studentId: string): Promise<GroupTimeSlot[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const client = getSupabase();
    try {
      const groupSummary = await resolveStudentGroupSummary(client, studentId);
      const groupId = safeUuid(groupSummary?.id);
      if (!groupId) {
        recordPortalDataRead('groupTimes', 'live');
        return [];
      }

      const columnSchemas: Array<{
        weekdayCol: string;
        teacherCol: string;
        dayMap?: (v: string) => number;
      }> = [
        { weekdayCol: 'weekday', teacherCol: 'teacher_name' },
        { weekdayCol: 'day', teacherCol: 'teacher', dayMap: dayNameToWeekday },
      ];

      let result: GroupTimeSlot[] | null = null;
      for (const schema of columnSchemas) {
        const { data, error } = await client
          .from('group_times')
          .select(`id, ${schema.weekdayCol}, start_time, end_time, room, ${schema.teacherCol}`)
          .eq('tenant_id', PORTAL_TENANT_ID)
          .eq('group_id', groupId)
          .eq('is_active', true)
          .is('deleted_at', null)
          .order(schema.weekdayCol, { ascending: true })
          .order('start_time', { ascending: true });

        if (error) {
          const errMsg = String(error?.message || error?.code || '').toLowerCase();
          if (errMsg.includes('does not exist') || errMsg.includes('42703') || errMsg.includes('column') || errMsg.includes('not found')) {
            continue;
          }
          logPortalReadError('groupTimes', { studentId, groupId, schema: schema.weekdayCol }, error);
          break;
        }

        if (Array.isArray(data) && data.length > 0) {
          result = data.map((row: any) => ({
            id: String(row.id),
            weekday: schema.dayMap
              ? schema.dayMap(String(row[schema.weekdayCol] || ''))
              : Number(row[schema.weekdayCol]),
            startTime: String(row.start_time || ''),
            endTime: String(row.end_time || ''),
            room: String(row.room || ''),
            teacherName: String(row[schema.teacherCol] || ''),
          })).sort((left, right) => {
            if (left.weekday !== right.weekday) return left.weekday - right.weekday;
            return left.startTime.localeCompare(right.startTime);
          });
          break;
        }
        result = [];
      }

      if (result !== null) {
        recordPortalDataRead('groupTimes', 'live');
        return result;
      }
    } catch (e) {
      logPortalReadError('groupTimes', { studentId }, e);
    }

    recordPortalDataRead('groupTimes', 'live');
    return [];
  },

  // Insert Join Request
  async createJoinRequest(request: {
    studentName: string;
    studentCode?: string;
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
      const studentCode = String(request.studentCode || '').trim();
      const note = [
        request.gender.trim() ? `النوع: ${request.gender.trim()}` : '',
        studentCode ? `كود الطالب: ${studentCode}` : '',
      ]
        .filter(Boolean)
        .join('\n') || null;

      const { error } = await client.from('join_requests').insert({
        reference_code: buildJoinReferenceCode(),
        student_name: request.studentName.trim(),
        parent_phone: normalizePhoneNumber(request.parentPhone),
        student_phone: normalizePhoneNumber(request.studentPhone) || null,
        academic_stage: request.academicStage.trim(),
        academic_grade: request.grade.trim(),
        desired_group: request.academicGroup.trim() || 'غير محدد',
        note,
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
        const enrollmentRows = await resolveStudentEnrollmentRows(client, studentId);
        const enrollmentIds = enrollmentRows
          .map((row) => safeUuid(row?.id))
          .filter((value): value is string => Boolean(value));
        const enrollmentMap = new Map(enrollmentRows.map((row) => [String(row.id), row]));
        const attendanceQueryVariants: Array<(query: any) => any> = [
          (query) => query.eq('tenant_id', PORTAL_TENANT_ID).eq('student_id', studentId).is('deleted_at', null),
          (query) => query.eq('student_id', studentId).is('deleted_at', null),
        ];
        if (enrollmentIds.length > 0) {
          attendanceQueryVariants.push((query) =>
            query.eq('tenant_id', PORTAL_TENANT_ID).in('enrollment_id', enrollmentIds).is('deleted_at', null),
          );
          attendanceQueryVariants.push((query) => query.in('enrollment_id', enrollmentIds).is('deleted_at', null));
        }

        const data = mergeRowsById(
          (
            await Promise.all(
              attendanceQueryVariants.map((configure) =>
                fetchRowsWithFallback<Record<string, any>>(
                  client,
                  'attendance',
                  [configure],
                  {
                    orderVariants: [['attendance_date'], ['date'], ['recorded_at'], ['created_at'], []],
                    continueOnEmpty: false,
                    diagnosticContext: { studentId },
                  },
                ).catch((error) => {
                  logPortalReadErrorUnlessMissingColumn('attendance', { studentId }, error, 'enrollment_id');
                  return [] as Record<string, any>[];
                }),
              ),
            )
          ).flat(),
        );

        if (Array.isArray(data)) {
          const fallbackGroup = await resolveStudentGroupSummary(client, studentId).catch(() => null);
          const sessionRows: any[] = [];
          const groupIds = Array.from(
            new Set(
              [
                ...sessionRows.map((row: any) => safeUuid(row?.group_id)),
                ...data.map((row: any) => safeUuid(row?.group_id)),
                ...data.map((row: any) => safeUuid(enrollmentMap.get(String(row.enrollment_id || ''))?.group_id)),
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
            const enrollment = enrollmentMap.get(String(row.enrollment_id || ''));
            const group = groupMap.get(String(session?.group_id || row.group_id || enrollment?.group_id || fallbackGroup?.id || ''));
            const metadataName =
              typeof session?.metadata === 'object' && session?.metadata
                ? String((session.metadata as Record<string, unknown>).title || (session.metadata as Record<string, unknown>).name || '')
                : '';
            const status = String(row.status || '').trim().toLowerCase();

            return {
              id: String(row.id),
              date: formatDateOnly(row.attendance_date || row.date || row.recorded_at || row.client_timestamp),
              subject: String(group?.subject || group?.name || session?.group_name_snapshot || metadataName || 'الحصة الدراسية').trim(),
              time: formatTimeLabel(session?.start_time || session?.starts_at || row.recorded_at || row.client_timestamp),
              status: status === 'late' ? 'late' : status === 'present' ? 'present' : status === 'excused' ? 'excused' : 'absent',
              lecturer: String(group?.teacher_name || group?.teacher || session?.teacher_snapshot || 'سنتر ألفا').trim(),
              remarks: String(row.notes || row.note || row.reason || '').trim() || undefined,
            };
          });
        }
      } catch (e) {
        logPortalReadError('attendance', { studentId }, e);
      }
    }

    const finalRecords = supabaseRecords;
    if (finalRecords.length > 0) {
      recordPortalDataRead('attendance', 'live');
      return finalRecords.sort((left, right) => getDateSortTime(right.date) - getDateSortTime(left.date));
    }

    recordPortalDataRead('attendance', 'live');
    return [];
  },

  // Load payments
  async getPayments(studentId: string): Promise<PaymentRecord[]> {
    let finalRecords: PaymentRecord[] = [];
    let isOutstanding = false;
    let outstandingAmt = 0;
    let studentCode = '';
    
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      try {
        let paymentRows: Record<string, any>[] = [];

        try {
          paymentRows = await fetchRowsWithFallback<Record<string, any>>(
            client,
            'payments',
            [
              (query) => query.eq('tenant_id', PORTAL_TENANT_ID).eq('student_id', studentId).is('deleted_at', null),
              (query) => query.eq('tenant_id', PORTAL_TENANT_ID).eq('student_id', studentId),
              (query) => query.eq('student_id', studentId).is('deleted_at', null),
              (query) => query.eq('student_id', studentId),
            ],
            {
              orderVariants: [['paid_at'], ['timestamp'], ['date'], ['payment_date'], ['created_at'], []],
              continueOnEmpty: true,
              diagnosticContext: { studentId },
            },
          );
        } catch (error) {
          logPortalReadError('payments', { studentId }, error);
        }

        let studentRow: Record<string, any> | null = null;
        try {
          const studentRowResult = await client
            .from('students')
            .select('id,student_code,balance')
            .eq('tenant_id', PORTAL_TENANT_ID)
            .eq('id', studentId)
            .maybeSingle();
          if (studentRowResult.error) {
            console.warn('[portal] optional student balance read failed:', studentRowResult.error);
          } else {
            studentRow = studentRowResult.data;
          }
        } catch (error) {
          console.warn('[portal] optional student balance read failed:', error);
        }

        if (studentRow) {
          studentCode = (studentRow as any).student_code || '';
          outstandingAmt = outstandingBalanceFromStudent(studentRow as Record<string, any>);
          if (outstandingAmt > 0) {
            isOutstanding = true;
          }
        }

        const mapPaymentRow = (row: Record<string, any>): PaymentRecord => {
          const paidAt = row.paid_at || row.timestamp || row.payment_date || row.date || row.created_at;
          const status = toPaymentStatus(row.status || (paidAt ? 'paid' : 'pending'));
          const title = row.notes || row.note || row.payment_type || row.type || row.payment_method || row.method || 'دفعة مالية';
          return {
            id: String(row.id),
            title: String(title).trim(),
            amount: Number(row.amount || 0),
            dueDate: formatDateOnly(row.date || row.payment_date || paidAt),
            paidDate: status === 'paid' && paidAt ? formatDateOnly(paidAt) : undefined,
            status,
            invoiceNo: String(row.receipt_no || row.receipt_id || row.transaction_id || row.id),
            category: inferPaymentCategory(title),
          };
        };

        const directPaymentRecords = paymentRows.map(mapPaymentRow);
        finalRecords = mergePaymentRecords(directPaymentRecords);
      } catch (e) {
        logPortalReadError('payments', { studentId }, e);
      }
    }

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
      recordPortalDataRead('payments', 'live');
      return finalRecords.sort((left, right) => getDateSortTime(right.paidDate || right.dueDate) - getDateSortTime(left.paidDate || left.dueDate));
    }

    recordPortalDataRead('payments', 'live');
    return [];
  },

  // Load grades
  async getGrades(studentId: string): Promise<GradeRecord[]> {
    let supabaseRecords: GradeRecord[] = [];

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      try {
        const data = await fetchRowsWithFallback<Record<string, any>>(
          client,
          'grades',
          [
            (query) => query.eq('tenant_id', PORTAL_TENANT_ID).eq('student_id', studentId).is('deleted_at', null),
            (query) => query.eq('tenant_id', PORTAL_TENANT_ID).eq('student_id', studentId),
            (query) => query.eq('student_id', studentId).is('deleted_at', null),
            (query) => query.eq('student_id', studentId),
          ],
          {
            orderVariants: [['assessment_date'], ['created_at'], ['updated_at'], []],
            continueOnEmpty: true,
            diagnosticContext: { studentId },
          },
        );

        if (Array.isArray(data)) {
          supabaseRecords = data.map((row: any) => ({
            id: String(row.id),
            subjectCode: String(row.assessment_id || row.id || '').slice(0, 12).toUpperCase(),
            subjectName: String(row.subject || row.exam_title || row.title || 'تقييم').trim(),
            category: mapGradeCategory(row.type),
            score: Number(row.score || 0),
            maxScore: Number(row.max_score || 0),
            gradeLetter: String(row.letter_grade || percentageToLetter(Number(row.percentage || 0)) || 'N/A'),
            date: formatDateOnly(row.assessment_date || row.created_at),
            feedback: String(row.remarks || '').trim() || undefined,
            gpaWeight: percentageToGpa(Number(row.percentage || 0)),
            passed: Number(row.percentage || 0) >= 60,
            sourceExamId: String(row.assessment_id || '').trim() || undefined,
            examMode: inferExamMode(row),
          }));
        }
      } catch (e) {
        logPortalReadError('grades', { studentId }, e);
      }
    }

    const finalRecords = supabaseRecords;
    if (finalRecords.length > 0) {
      recordPortalDataRead('grades', 'live');
      return finalRecords.sort((a, b) => getDateSortTime(b.date) - getDateSortTime(a.date));
    }

    recordPortalDataRead('grades', 'live');
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
        const platformExamRows = await fetchAllRows(client, 'platform_exams', (query) => query
          .eq('tenant_id', PORTAL_TENANT_ID)
          .eq('active', true)
          .order('created_at', { ascending: false }));

        if (Array.isArray(platformExamRows) && platformExamRows.length > 0) {
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

          const platformExamResults = await Promise.allSettled(
            visibleExamRows.map(async (exam: any) => {
              const platformQuestionRows = await fetchAllRows(client, 'platform_questions', (query) => query
                .eq('exam_id', exam.id)
                .order('order_index', { ascending: true }), undefined, PLATFORM_QUESTION_SELECT_COLUMNS);

              if (!Array.isArray(platformQuestionRows)) {
                throw new Error('platform_questions_invalid_response');
              }

              const questionResults = await Promise.allSettled(
                platformQuestionRows.map(async (question: any): Promise<ExamQuestion> => {
                  const platformChoiceRows = await fetchAllRows(client, 'platform_choices', (query) => query
                    .eq('question_id', question.id)
                    .order('order_index', { ascending: true }), undefined, PLATFORM_CHOICE_SELECT_COLUMNS);

                  if (!Array.isArray(platformChoiceRows)) {
                    throw new Error('platform_choices_invalid_response');
                  }

                  const choices = platformChoiceRows.map((choice: any) => ({
                    id: String(choice.id || ''),
                    text: String(choice.choice_text || '').trim(),
                  }));
                  const questionImage = await resolvePlatformQuestionImage(client, question);

                  return {
                    id: String(question.id || ''),
                    text: String(question.question_text || '').trim(),
                    options: choices,
                    points: Number(question.points || 1),
                    questionType: readPlatformQuestionType(question, choices.length),
                    pageNumber: Number(question.page_number || 0) || undefined,
                    imageUrl: questionImage.imageUrl,
                    imageStoragePath: questionImage.imageStoragePath,
                  };
                }),
              );
              const questions: ExamQuestion[] = questionResults
                .filter(isFulfilled)
                .map((result) => result.value);

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

          const platformExams = platformExamResults
            .filter(isFulfilled)
            .map((result) => result.value);

          recordPortalDataRead('exams', 'live');
          return platformExams;
        }

      } catch (e) {
        console.error("Error loading exams from Supabase:", e);
      }
    }
    recordPortalDataRead('exams', 'live');
    return [];
  }
};
