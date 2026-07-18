import type { PaymentRecord, PaymentStatus } from './types.ts';

export type PortalFinancialObligationRow = Record<string, unknown> & {
  id?: unknown;
  kind?: unknown;
  status?: unknown;
  amount_due?: unknown;
  paid_amount?: unknown;
  month_key?: unknown;
  due_date?: unknown;
  title?: unknown;
  paid_at?: unknown;
  deleted_at?: unknown;
};

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const toMoney = (value: unknown): number => {
  const amount = Number(value);
  return Number.isFinite(amount) ? roundMoney(amount) : 0;
};

const formatDateOnly = (value: unknown, fallback: string): string => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const parsed = new Date(String(value ?? ''));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString().slice(0, 10);
};

const monthEndDate = (monthKey: unknown, fallback: string): string => {
  const match = String(monthKey ?? '').trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return fallback;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return fallback;
  }

  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
};

export const normalizeFinancialObligationStatus = (value: unknown): PaymentStatus => {
  const status = String(value ?? '').trim().toLowerCase();
  if (status === 'paid') return 'paid';
  if (status === 'partial') return 'partial';
  if (status === 'overdue') return 'overdue';
  if (status === 'waived') return 'waived';
  return 'pending';
};

export const financialObligationRemainingAmount = (
  row: PortalFinancialObligationRow,
): number => {
  if (row.deleted_at || normalizeFinancialObligationStatus(row.status) === 'waived') {
    return 0;
  }

  const amountDue = Math.max(0, toMoney(row.amount_due));
  const paidAmount = Math.max(0, toMoney(row.paid_amount));
  return roundMoney(Math.max(0, amountDue - paidAmount));
};

export const outstandingBalanceFromFinancialObligations = (
  rows: PortalFinancialObligationRow[],
): number => roundMoney(
  (rows || []).reduce(
    (total, row) => total + financialObligationRemainingAmount(row),
    0,
  ),
);

const obligationTitle = (row: PortalFinancialObligationRow): string => {
  const explicitTitle = String(row.title ?? '').trim();
  if (explicitTitle) return explicitTitle;

  const kind = String(row.kind ?? '').trim().toLowerCase();
  if (kind === 'monthly') {
    const monthKey = String(row.month_key ?? '').trim();
    return monthKey ? `اشتراك ${monthKey}` : 'اشتراك شهري';
  }
  if (kind === 'book') return 'رسوم كتاب';
  if (kind === 'material') return 'رسوم مذكرة';
  if (kind === 'session') return 'رسوم حصة';
  return 'بند مالي';
};

const obligationCategory = (
  row: PortalFinancialObligationRow,
): PaymentRecord['category'] => {
  const kind = String(row.kind ?? '').trim().toLowerCase();
  return kind === 'book' || kind === 'material' ? 'books' : 'tuition';
};

export const mapFinancialObligationToPaymentRecord = (
  row: PortalFinancialObligationRow,
  today: string = new Date().toISOString().slice(0, 10),
): PaymentRecord => {
  const id = String(row.id ?? '').trim();
  const status = normalizeFinancialObligationStatus(row.status);
  const amountDue = Math.max(0, toMoney(row.amount_due));
  const paidAmount = Math.max(0, toMoney(row.paid_amount));
  const remainingAmount = financialObligationRemainingAmount(row);
  const dueDate = row.due_date
    ? formatDateOnly(row.due_date, today)
    : monthEndDate(row.month_key, today);
  const paidAt = String(row.paid_at ?? '').trim();

  return {
    id,
    title: obligationTitle(row),
    amount: status === 'paid' ? amountDue : remainingAmount,
    amountDue,
    paidAmount,
    remainingAmount,
    dueDate,
    paidDate: status === 'paid' && paidAt ? formatDateOnly(paidAt, today) : undefined,
    status,
    invoiceNo: `INV-${id.slice(-8).toUpperCase()}`,
    category: obligationCategory(row),
    recordType: 'charge',
    obligationId: id,
  };
};
