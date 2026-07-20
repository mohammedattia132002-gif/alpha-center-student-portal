import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  financialObligationRemainingAmount,
  mapFinancialObligationToPaymentRecord,
  outstandingBalanceFromFinancialObligations,
} from '../src/financialObligations.ts';

const portalSource = readFileSync(
  fileURLToPath(new URL('../src/supabaseClient.ts', import.meta.url)),
  'utf8',
);
const financialSecurityMigration = readFileSync(
  fileURLToPath(new URL(
    '../../alpha-center/supabase/migrations/20260719140000_portal_financial_data_rpc_hardening.sql',
    import.meta.url,
  )),
  'utf8',
);
const paymentIdempotencyMigration = readFileSync(
  fileURLToPath(new URL(
    '../../alpha-center/supabase/migrations/20260719143000_portal_pay_invoice_idempotency.sql',
    import.meta.url,
  )),
  'utf8',
);

test('maps a partial obligation to its real remaining amount', () => {
  const record = mapFinancialObligationToPaymentRecord({
    id: 'obl-partial',
    kind: 'monthly',
    status: 'partial',
    amount_due: 300,
    paid_amount: 125,
    month_key: '2026-07',
    due_date: '2026-07-31',
  }, '2026-07-18');

  assert.equal(record.recordType, 'charge');
  assert.equal(record.status, 'partial');
  assert.equal(record.amountDue, 300);
  assert.equal(record.paidAmount, 125);
  assert.equal(record.remainingAmount, 175);
  assert.equal(record.amount, 175);
});

test('paid and waived obligations do not create outstanding debt', () => {
  const rows = [
    {
      id: 'obl-paid',
      status: 'paid',
      amount_due: 200,
      paid_amount: 200,
    },
    {
      id: 'obl-waived',
      status: 'waived',
      amount_due: 150,
      paid_amount: 0,
    },
  ];

  assert.equal(financialObligationRemainingAmount(rows[0]), 0);
  assert.equal(financialObligationRemainingAmount(rows[1]), 0);
  assert.equal(outstandingBalanceFromFinancialObligations(rows), 0);
});

test('outstanding balance is the sum of active obligation remainders', () => {
  const balance = outstandingBalanceFromFinancialObligations([
    { status: 'pending', amount_due: 200, paid_amount: 0 },
    { status: 'partial', amount_due: 175.5, paid_amount: 25.25 },
    { status: 'overdue', amount_due: 90, paid_amount: 10 },
    { status: 'waived', amount_due: 500, paid_amount: 0 },
    { status: 'pending', amount_due: 75, paid_amount: 0, deleted_at: '2026-07-01' },
  ]);

  assert.equal(balance, 430.25);
});

test('portal financial reads use verified RPCs instead of direct sensitive-table selects', () => {
  assert.match(portalSource, /rpc\('portal_login_student'/);
  assert.match(portalSource, /rpc\('portal_verified_student'/);
  assert.match(portalSource, /rpc\('portal_financial_obligations'/);
  assert.match(portalSource, /rpc\('portal_student_payments'/);
  assert.doesNotMatch(portalSource, /\.from\('students'\)/);
});

test('security migration revokes anon table reads and exposes only verified RPC execution', () => {
  for (const table of ['students', 'payments', 'financial_obligations']) {
    assert.match(
      financialSecurityMigration,
      new RegExp(`REVOKE SELECT ON public\\.${table} FROM anon`, 'i'),
    );
  }

  assert.match(financialSecurityMigration, /SECURITY DEFINER/);
  assert.match(
    financialSecurityMigration,
    /GRANT EXECUTE ON FUNCTION public\.portal_financial_obligations[\s\S]*TO anon/i,
  );
  assert.match(
    financialSecurityMigration,
    /GRANT EXECUTE ON FUNCTION public\.portal_student_payments[\s\S]*TO anon/i,
  );
});

test('portal payment RPC uses request idempotency and unique per-payment receipts', () => {
  assert.match(paymentIdempotencyMigration, /p_request_id TEXT/);
  assert.match(paymentIdempotencyMigration, /pg_advisory_xact_lock/);
  assert.match(paymentIdempotencyMigration, /idx_payments_portal_request_idempotency/);
  assert.match(paymentIdempotencyMigration, /v_receipt_no := 'PORTAL-'[\s\S]*v_payment_id/);
  assert.match(paymentIdempotencyMigration, /v_payment_status := v_new_status/);
  assert.doesNotMatch(
    paymentIdempotencyMigration,
    /v_receipt_no := 'PORTAL-'[\s\S]{0,100}p_invoice_id/,
  );
});
