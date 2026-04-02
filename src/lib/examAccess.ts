import type { PlatformExam, Student } from '../types';

function normalizeToken(value: unknown): string {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return '';

  return text
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[-_/()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function gradeVariants(value: unknown): string[] {
  const normalized = normalizeToken(value);
  if (!normalized) return [];

  const variants = new Set<string>([normalized]);
  variants.add(normalized.replace(/^الصف\s+/, '').trim());
  variants.add(normalized.replace(/^صف\s+/, '').trim());

  return Array.from(variants).filter(Boolean);
}

function flattenUnknownList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap((entry) => flattenUnknownList(entry));
  if (value && typeof value === 'object') return Object.values(value).flatMap((entry) => flattenUnknownList(entry));
  return value === null || value === undefined ? [] : [value];
}

function extractAllowedGroups(value: unknown): string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      return flattenUnknownList(parsed)
        .map((entry) => String(entry ?? '').trim())
        .filter(Boolean);
    } catch {
      return trimmed
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }

  return flattenUnknownList(value)
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean);
}

function buildStudentAccessTokens(student: Student): Set<string> {
  const tokens = new Set<string>();
  const candidates = [
    student.group_id,
    student.group_name,
    student.grade_level,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeToken(candidate);
    if (normalized) tokens.add(normalized);
  }

  for (const variant of gradeVariants(student.grade_level)) {
    tokens.add(variant);
  }

  return tokens;
}

export function canStudentAccessExam(student: Student | null | undefined, exam: PlatformExam | null | undefined): boolean {
  if (!student || !exam) return false;
  if (exam.active === false) return false;

  const studentTokens = buildStudentAccessTokens(student);
  const allowedGroupTokens = extractAllowedGroups(exam.allowed_groups).map(normalizeToken).filter(Boolean);
  const examGradeTokens = gradeVariants(exam.grade_level);

  if (allowedGroupTokens.some((token) => studentTokens.has(token))) {
    return true;
  }

  if (examGradeTokens.some((token) => studentTokens.has(token))) {
    return true;
  }

  if (allowedGroupTokens.length === 0 && examGradeTokens.length === 0) {
    return true;
  }

  return false;
}
