import assert from 'node:assert/strict';
import test from 'node:test';

import {
  financialObligationRemainingAmount,
  mapFinancialObligationToPaymentRecord,
  outstandingBalanceFromFinancialObligations,
} from '../src/financialObligations.ts';

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
