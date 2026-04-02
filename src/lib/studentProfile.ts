import { ensurePortalSupabaseSession, supabase } from './supabase';
import { portalTenantId } from './tenant';
import type { Student } from '../types';

type EnrollmentRow = {
  group_id?: string | null;
  is_active?: boolean | null;
  deleted_at?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

function todayIsoDate(): string {
  return new Date().toISOString().split('T')[0];
}

function isEnrollmentActive(row: EnrollmentRow | null | undefined): boolean {
  if (!row || row.deleted_at) return false;
  if (row.is_active === false) return false;
  const today = todayIsoDate();
  const startDate = String(row.start_date || '').trim();
  if (startDate && startDate > today) return false;
  const endDate = String(row.end_date || '').trim();
  if (endDate && endDate < today) return false;
  return true;
}

export async function loadStudentProfile(studentId: string): Promise<Student | null> {
  const normalizedId = String(studentId || '').trim();
  if (!normalizedId) return null;

  await ensurePortalSupabaseSession().catch(() => false);

  const { data: studentRow, error: studentError } = await supabase
    .from('students')
    .select('id,student_code,tenant_id,name,phone,parent_phone,grade_level,group_id,balance,is_active')
    .eq('tenant_id', portalTenantId)
    .eq('id', normalizedId)
    .is('deleted_at', null)
    .maybeSingle();

  if (studentError || !studentRow) {
    return null;
  }

  let groupName: string | null = null;
  const { data: enrollmentRows } = await supabase
    .from('enrollments')
    .select('group_id,is_active,deleted_at,start_date,end_date,updated_at,created_at')
    .eq('student_id', normalizedId)
    .order('updated_at', { ascending: false })
    .limit(10);

  const activeEnrollment = (enrollmentRows || []).find((row) => isEnrollmentActive(row as EnrollmentRow)) as EnrollmentRow | undefined;
  const groupId = String(activeEnrollment?.group_id || studentRow.group_id || '').trim();

  if (groupId) {
    const { data: groupRow } = await supabase
      .from('groups')
      .select('name')
      .eq('id', groupId)
      .maybeSingle();
    groupName = String(groupRow?.name || '').trim() || null;
  }

  return {
    ...(studentRow as Student),
    group_id: groupId || null,
    group_name: groupName,
  };
}
