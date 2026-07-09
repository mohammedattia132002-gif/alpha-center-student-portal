import { StudentProfile } from '../types';

type StudentScopedKey = 'profile' | 'attendance' | 'payments' | 'grades' | 'exams' | 'notifications' | 'todo';

const CURRENT_STUDENT_KEY = 'portal_logged_in_student';
const SCOPED_PREFIX = 'portal_student';
const LEGACY_DATA_KEYS = [
  'portal_profile',
  'portal_attendance',
  'portal_payments',
  'portal_grades',
  'portal_exams',
  'portal_notifications',
  'portal_todo_list',
] as const;

export function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can fail in private mode or when quota is exhausted.
  }
}

function studentStorageId(student: Pick<StudentProfile, 'id' | 'studentCode'>): string {
  return encodeURIComponent(String(student.id || student.studentCode).trim());
}

export function studentScopedKey(
  student: Pick<StudentProfile, 'id' | 'studentCode'>,
  key: StudentScopedKey,
): string {
  return `${SCOPED_PREFIX}_${studentStorageId(student)}_${key}`;
}

export function getStoredStudent(): StudentProfile | null {
  try {
    const raw = window.sessionStorage.getItem(CURRENT_STUDENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StudentProfile;
  } catch {
    return null;
  }
}

export function persistStudentSession(student: StudentProfile): void {
  try {
    window.sessionStorage.setItem(CURRENT_STUDENT_KEY, JSON.stringify(student));
  } catch {
    // Storage can fail in private mode or when quota is exhausted.
  }
}

export function clearStoredStudent(): void {
  try {
    window.localStorage.removeItem(CURRENT_STUDENT_KEY);
    window.sessionStorage.removeItem(CURRENT_STUDENT_KEY);
  } catch {
    // ignore
  }
}

export function readStudentData<T>(
  student: Pick<StudentProfile, 'id' | 'studentCode'> | null,
  key: StudentScopedKey,
  fallback: T,
): T {
  if (!student) return fallback;
  return readJson<T>(studentScopedKey(student, key)) ?? fallback;
}

export function writeStudentData(
  student: Pick<StudentProfile, 'id' | 'studentCode'> | null,
  key: StudentScopedKey,
  value: unknown,
): void {
  if (!student) return;
  writeJson(studentScopedKey(student, key), value);
}

export function clearLegacyStudentData(): void {
  try {
    window.localStorage.removeItem(CURRENT_STUDENT_KEY);
    for (const key of LEGACY_DATA_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

export function clearPortalStorage(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (
        key === CURRENT_STUDENT_KEY ||
        key === 'portal_session_token' ||
        key === 'portal_center_config' ||
        key === 'portal_join_requests' ||
        key.startsWith(`${SCOPED_PREFIX}_`) ||
        key.startsWith('portal_cache_') ||
        LEGACY_DATA_KEYS.includes(key as (typeof LEGACY_DATA_KEYS)[number])
      ) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
    window.sessionStorage.removeItem(CURRENT_STUDENT_KEY);
  } catch {
    // ignore
  }
}
