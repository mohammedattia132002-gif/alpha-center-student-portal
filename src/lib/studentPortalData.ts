import type { Payment, Student } from '../types';

const PAYMENT_MONTH_PATTERN = /((?:20)\d{2})-(0[1-9]|1[0-2])/;
const ARABIC_DIGIT_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

function toAsciiDigits(value: unknown): string {
  return String(value ?? '').replace(/[٠-٩۰-۹]/g, (digit) => ARABIC_DIGIT_MAP[digit] ?? digit);
}

export function normalizeIdentity(value: unknown): string {
  return toAsciiDigits(value)
    .normalize('NFKC')
    .replace(/[\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function normalizePhoneNumber(value: unknown): string {
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

export function getPhoneSearchVariants(value: unknown): string[] {
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

export function matchesStudentPhone(student: Pick<Student, 'phone' | 'parent_phone'>, input: string): boolean {
  const normalizedInput = normalizePhoneNumber(input);
  if (!normalizedInput) return false;

  return [student.phone, student.parent_phone]
    .map((value) => normalizePhoneNumber(value))
    .some((value) => value !== '' && (value === normalizedInput || value.endsWith(normalizedInput) || normalizedInput.endsWith(value)));
}

export function matchesStudentIdentity(student: Pick<Student, 'student_code' | 'name'>, input: string): boolean {
  const normalizedInput = normalizeIdentity(input);
  if (!normalizedInput) return false;

  const normalizedCode = normalizeIdentity(student.student_code);
  const normalizedName = normalizeIdentity(student.name);

  if (normalizedCode && normalizedCode === normalizedInput) return true;
  if (normalizedName && normalizedName === normalizedInput) return true;
  if (normalizedName && normalizedInput.length >= 3 && normalizedName.includes(normalizedInput)) return true;
  return false;
}

export function isPresentAttendanceStatus(status: unknown): boolean {
  const normalized = String(status ?? '').trim().toLowerCase();
  return normalized === 'present' || normalized === 'حاضر';
}

export function resolveAttendanceDate(
  attendance: Pick<{ date?: string; attendance_date?: string }, 'date' | 'attendance_date'>,
): string {
  return String(attendance.date || attendance.attendance_date || '').trim();
}

export function getPaymentAmount(payment: Payment): number {
  const amount = Number(payment.amount ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

export function isPaidPayment(payment: Payment): boolean {
  return !payment.deleted_at && getPaymentAmount(payment) > 0;
}

export function resolvePaymentDate(payment: Payment): string | null {
  return String(payment.paid_at || payment.timestamp || payment.date || '').trim() || null;
}

export function resolvePaymentMonthKey(payment: Payment): string | null {
  const explicitMonth = String(payment.month_key || '').trim();
  if (PAYMENT_MONTH_PATTERN.test(explicitMonth)) {
    return explicitMonth.match(PAYMENT_MONTH_PATTERN)?.[0] ?? explicitMonth;
  }

  for (const source of [payment.receipt_no, payment.idempotency_key, payment.notes]) {
    const raw = String(source || '').trim();
    const matched = raw.match(PAYMENT_MONTH_PATTERN)?.[0];
    if (matched) return matched;
  }

  const fallbackDate = resolvePaymentDate(payment);
  if (!fallbackDate) return null;
  const parsed = new Date(fallbackDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

export function isMonthlyPayment(payment: Payment): boolean {
  const token = String(payment.payment_type || '').trim().toLowerCase();
  if (token === 'monthly' || token === 'subscription') return true;
  return resolvePaymentMonthKey(payment) !== null;
}

export function getOutstandingAmount(balance: unknown): number {
  const numeric = Number(balance ?? 0);
  if (!Number.isFinite(numeric) || numeric >= 0) return 0;
  return Math.abs(numeric);
}
