import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import { portalTenantId } from './tenant';
import {
  mapStudentRow,
  mapGroupRow,
  mapAttendanceRow,
  mapPaymentRow,
  mapGradeRow,
} from './mappers';
import type {
  StudentProfile,
  GroupSummary,
  AttendanceRecord,
  PaymentRecord,
  GradeRecord,
} from '../types/domain';

const LIVE = false;

interface AggregateResult {
  profile: StudentProfile | null;
  group: GroupSummary | null;
  attendance: AttendanceRecord[];
  payments: PaymentRecord[];
  grades: GradeRecord[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function dateOnly(value: unknown): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(String(value ?? ''));
  return Number.isNaN(d.getTime()) ? nowIso().slice(0, 10) : d.toISOString().slice(0, 10);
}

// Resolve the active group for a student via enrollments
async function resolveStudentGroup(
  client: any,
  studentId: string,
  studentRow?: Record<string, any>,
): Promise<{ group: GroupSummary | null; groupId: string | null }> {
  const today = dateOnly(new Date());
  let groupId: string | null = null;

  const { data: enrollments } = await client
    .from('enrollments')
    .select('group_id,is_active,start_date,end_date,deleted_at')
    .eq('student_id', studentId)
    .eq('tenant_id', portalTenantId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(10);

  if (Array.isArray(enrollments)) {
    const active = enrollments.find((e: any) => {
      if (e.deleted_at) return false;
      if (e.is_active === false) return false;
      const start = String(e.start_date || '');
      const end = String(e.end_date || '');
      if (start && start > today) return false;
      if (end && end < today) return false;
      return true;
    });
    if (active?.group_id) {
      groupId = String(active.group_id);
    }
  }

  if (!groupId && studentRow?.group_id) {
    groupId = String(studentRow.group_id);
  }

  if (!groupId) return { group: null, groupId: null };

  const { data: groupRow } = await client
    .from('groups')
    .select('id,name,subject,teacher_name,grade_level')
    .eq('id', groupId)
    .maybeSingle();

  return {
    group: groupRow ? mapGroupRow(groupRow) : { id: groupId, name: 'المجموعة التعليمية' },
    groupId,
  };
}

async function loginByCode(
  client: any,
  studentCode: string,
  phone: string,
): Promise<StudentProfile | null> {
  const phoneVariants = [phone];
  const p = phone.replace(/\D/g, '');
  if (p.startsWith('0')) phoneVariants.push(p.slice(1), `20${p.slice(1)}`);
  if (p.startsWith('20') && p.length >= 12) phoneVariants.push(`0${p.slice(2)}`);

  const phoneClause = phoneVariants
    .flatMap((v) => [`phone.eq.${v}`, `parent_phone.eq.${v}`])
    .join(',');

  const { data: candidates } = await client
    .from('students')
    .select('*')
    .eq('tenant_id', portalTenantId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .or(phoneClause)
    .limit(50);

  const rows: Record<string, any>[] = Array.isArray(candidates) ? candidates : [];

  const matched = rows.find((r) => {
    const code = String(r.student_code ?? '').trim().toLowerCase();
    const input = studentCode.trim().toLowerCase();
    return code === input;
  });

  if (matched) return mapStudentRow(matched);

  // Fallback: match by code only
  const { data: codeRows } = await client
    .from('students')
    .select('*')
    .eq('tenant_id', portalTenantId)
    .eq('student_code', studentCode)
    .eq('is_active', true)
    .is('deleted_at', null)
    .limit(10);

  const codeMatch: Record<string, any>[] = Array.isArray(codeRows) ? codeRows : [];

  const phoneMatch = codeMatch.find((r) => {
    const rp = String(r.phone ?? '').replace(/\D/g, '');
    const pp = String(r.parent_phone ?? '').replace(/\D/g, '');
    return rp === p || pp === p;
  });

  return phoneMatch ? mapStudentRow(phoneMatch) : null;
}

export const studentAggregate = {
  async login(studentCode: string, phone: string): Promise<{ success: boolean; student?: StudentProfile; error?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'لم يتم تكوين اتصال Supabase بعد.' };
    }

    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'تعذر الاتصال بقاعدة البيانات.' };

    try {
      const profile = await loginByCode(client, studentCode.trim(), phone.trim());
      if (!profile) {
        return { success: false, error: 'بيانات الدخول غير صحيحة. تأكد من كود الطالب ورقم الهاتف.' };
      }
      const { group } = await resolveStudentGroup(client, profile.id);
      profile.group = group;
      return { success: true, student: profile };
    } catch (e) {
      console.error('[studentAggregate.login]', e);
      return { success: false, error: 'حدث خطأ أثناء الاتصال بقاعدة البيانات.' };
    }
  },

  async loadDashboard(studentId: string): Promise<AggregateResult> {
    const empty: AggregateResult = {
      profile: null, group: null, attendance: [], payments: [], grades: [],
    };

    if (!isSupabaseConfigured()) return empty;

    const client = getSupabaseClient();
    if (!client) return empty;

    try {
      const { data: studentRow } = await client
        .from('students')
        .select('*')
        .eq('id', studentId)
        .eq('tenant_id', portalTenantId)
        .is('deleted_at', null)
        .maybeSingle();

      if (!studentRow) return empty;

      const profile = mapStudentRow(studentRow);
      const { group } = await resolveStudentGroup(client, studentId, studentRow);
      profile.group = group;

      const [attendanceRes, paymentsRes, gradesRes] = await Promise.all([
        client
          .from('attendance')
          .select('*')
          .eq('student_id', studentId)
          .eq('tenant_id', portalTenantId)
          .is('deleted_at', null)
          .order('date', { ascending: false })
          .order('recorded_at', { ascending: false })
          .limit(500),
        client
          .from('payments')
          .select('*')
          .eq('student_id', studentId)
          .eq('tenant_id', portalTenantId)
          .is('deleted_at', null)
          .order('paid_at', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(500),
        client
          .from('grades')
          .select('*')
          .eq('student_id', studentId)
          .eq('tenant_id', portalTenantId)
          .is('deleted_at', null)
          .order('assessment_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

      const attendance: AttendanceRecord[] = Array.isArray(attendanceRes.data)
        ? attendanceRes.data.map(mapAttendanceRow)
        : [];

      const payments: PaymentRecord[] = Array.isArray(paymentsRes.data)
        ? paymentsRes.data.map(mapPaymentRow)
        : [];

      const grades: GradeRecord[] = Array.isArray(gradesRes.data)
        ? gradesRes.data.map(mapGradeRow)
        : [];

      return { profile, group, attendance, payments, grades };
    } catch (e) {
      console.error('[studentAggregate.loadDashboard]', e);
      return empty;
    }
  },

  async getExams(): Promise<import('../types/domain').Exam[]> {
    if (!isSupabaseConfigured()) return [];

    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const { data: examsData } = await (client as any)
        .from('platform_exams')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (!Array.isArray(examsData)) return [];

      const exams: import('../types/domain').Exam[] = [];

      for (const exam of examsData) {
        const e = exam as Record<string, any>;

        const { data: questionsData } = await (client as any)
          .from('platform_questions')
          .select('*')
          .eq('exam_id', e.id)
          .order('order_index', { ascending: true });

        const questions = [];

        for (const q of (Array.isArray(questionsData) ? questionsData : [])) {
          const { data: choicesData } = await (client as any)
            .from('platform_choices')
            .select('*')
            .eq('question_id', q.id)
            .order('order_index', { ascending: true });

          const choices = (Array.isArray(choicesData) ? choicesData : []).map((c: any) => ({
            id: String(c.id),
            text: String(c.choice_text || ''),
          }));

          const correct = (Array.isArray(choicesData) ? choicesData : []).find((c: any) => c.is_correct);

          questions.push({
            id: String(q.id),
            text: String(q.question_text || ''),
            options: choices,
            correctOptionId: correct ? String(correct.id) : '',
            points: Number(q.points || 1),
            explanation: undefined,
          });
        }

        exams.push({
          id: String(e.id),
          title: String(e.title || ''),
          subject: String(e.subject || ''),
          durationMinutes: Number(e.duration_minutes || 30),
          totalPoints: Number(e.max_score || 100),
          questions,
          instructions: [],
          passingScorePercent: 60,
          status: 'available',
        });
      }

      return exams;
    } catch (e) {
      console.error('[studentAggregate.getExams]', e);
      return [];
    }
  },

  async saveExamResult(result: {
    examId: string;
    studentId: string;
    score: number;
    maxScore: number;
    percentage: number;
    passed: boolean;
    answers: Record<string, string>;
  }): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) return { success: true };

    const client = getSupabaseClient();
    if (!client) return { success: true };

    try {
      const { error } = await (client as any).from('platform_results').insert({
        exam_id: result.examId,
        student_id: result.studentId,
        score: result.score,
        max_score: result.maxScore,
        assessment_date: new Date().toISOString(),
        tenant_id: portalTenantId,
      });

      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  async createJoinRequest(request: {
    studentName: string;
    parentPhone: string;
    studentPhone?: string;
    academicStage: string;
    grade: string;
    academicGroup: string;
  }): Promise<{ success: boolean; message: string }> {
    if (!isSupabaseConfigured()) {
      return { success: false, message: 'لم يتم تكوين اتصال Supabase بعد.' };
    }

    const client = getSupabaseClient();
    if (!client) {
      return { success: false, message: 'تعذر الاتصال بقاعدة البيانات.' };
    }

    try {
      const { error } = await (client as any).from('join_requests').insert({
        student_name: request.studentName.trim(),
        parent_phone: request.parentPhone.trim(),
        student_phone: request.studentPhone?.trim() || null,
        academic_stage: request.academicStage.trim(),
        academic_grade: request.grade.trim(),
        desired_group: request.academicGroup.trim() || 'غير محدد',
        status: 'pending',
      });

      if (error) {
        return { success: false, message: 'تعذر إرسال طلب الانضمام.' };
      }

      return { success: true, message: 'تم تسجيل طلب الانضمام بنجاح، وسيتم التواصل معكم بعد المراجعة.' };
    } catch {
      return { success: false, message: 'حدث خطأ أثناء الاتصال بقاعدة البيانات.' };
    }
  },
};
