import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  cleanupRealtimeChannel,
  createRealtimeChannel,
  getRealtimeRecordId,
  isSoftDeleted,
  removeListRowById,
  upsertListRow,
  type TableRealtimeHandlers,
} from '../lib/supabaseRealtime';
import { useAuth } from '../AuthContext';
import { loadStudentProfile } from '../lib/studentProfile';
import {
  getOutstandingAmount,
  getPaymentAmount,
  isMonthlyPayment,
  isPaidPayment,
  resolvePaymentDate,
  resolvePaymentMonthKey,
} from '../lib/studentPortalData';
import { Payment } from '../types';
import { Check, CheckCircle, Clock, CreditCard } from 'lucide-react';
import { Empty, Spin } from './Attendance';

const MonthPaymentBar: React.FC<{ payments: Payment[] }> = ({ payments }) => {
  const months = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

  const getIsPaid = (month: number) =>
    payments.some((payment) => {
      if (!isPaidPayment(payment) || !isMonthlyPayment(payment)) return false;

      const monthKey = resolvePaymentMonthKey(payment);
      if (monthKey) {
        const monthToken = Number(monthKey.split('-')[1] || 0);
        if (monthToken === month) {
          return true;
        }
      }

      const paymentDate = resolvePaymentDate(payment);
      if (!paymentDate) return false;
      const parsed = new Date(paymentDate);
      return !Number.isNaN(parsed.getTime()) && parsed.getMonth() + 1 === month;
    });

  return (
    <div className="month-bar-card a-up">
      <div className="content-card-hdr" style={{ marginBottom: 16 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--violet-bg)', border: '1px solid rgba(124,58,237,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CreditCard size={16} color="var(--p2)" />
        </div>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>سجل المدفوعات الشهرية</h3>
      </div>

      <div style={{ display: 'flex', gap: 4, justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {months.map((month) => {
          const paid = getIsPaid(month);
          return (
            <div key={month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: '1px solid',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all .3s ease',
                  background: paid ? 'var(--green)' : 'var(--bg2)',
                  borderColor: paid ? 'var(--green)' : 'var(--bdr)',
                  boxShadow: paid ? '0 4px 12px rgba(16,185,129,.35)' : 'none',
                  color: paid ? '#fff' : 'var(--t4)',
                }}
              >
                {paid ? <Check size={14} strokeWidth={3} /> : <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--t4)' }} />}
              </div>
              <span style={{ fontSize: 12, fontWeight: 900, color: paid ? 'var(--green)' : 'var(--t2)', fontFamily: "'JetBrains Mono', monospace" }}>
                {month}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Payments: React.FC = () => {
  const { student } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const sortPayments = (items: Payment[]) =>
    [...items].sort((left, right) => String(resolvePaymentDate(right) || '').localeCompare(String(resolvePaymentDate(left) || '')));

  useEffect(() => {
    const go = async () => {
      if (!student) {
        setLoading(false);
        return;
      }

      try {
        const [{ data: paymentRows, error: paymentError }, profile] = await Promise.all([
          supabase
            .from('payments')
            .select('*')
            .eq('student_id', student.id)
            .is('deleted_at', null)
            .order('paid_at', { ascending: false }),
          loadStudentProfile(student.id),
        ]);

        if (paymentError) throw paymentError;
        if (paymentRows) {
          setPayments(paymentRows as Payment[]);
        }
        setBalance(Number(profile?.balance ?? student.balance ?? 0) || 0);
      } catch (error) {
        console.error('[Payments] Failed to load payments:', error);
        setBalance(Number(student.balance ?? 0) || 0);
      } finally {
        setLoading(false);
      }
    };

    void go();
  }, [student]);

  useEffect(() => {
    if (!student) return;

    const handlers: TableRealtimeHandlers[] = [
      {
        table: 'payments',
        filter: `student_id=eq.${student.id}`,
        onInsert: ({ new: nextRow }) => {
          if (isSoftDeleted(nextRow)) return;
          setPayments((previous) => sortPayments(upsertListRow(previous, nextRow as unknown as Payment)));
        },
        onUpdate: ({ new: nextRow, old: previousRow }) => {
          const nextId = getRealtimeRecordId(nextRow) || getRealtimeRecordId(previousRow);
          if (!nextId) return;
          setPayments((previous) => {
            if (isSoftDeleted(nextRow)) {
              return removeListRowById(previous, nextId);
            }
            return sortPayments(upsertListRow(previous, nextRow as unknown as Payment));
          });
        },
        onDelete: ({ old: previousRow }) => {
          const previousId = getRealtimeRecordId(previousRow);
          if (!previousId) return;
          setPayments((previous) => removeListRowById(previous, previousId));
        },
      },
      {
        table: 'students',
        filter: `id=eq.${student.id}`,
        onInsert: ({ new: nextRow }) => {
          setBalance(Number(nextRow.balance ?? student.balance ?? 0) || 0);
        },
        onUpdate: ({ new: nextRow }) => {
          setBalance(Number(nextRow.balance ?? student.balance ?? 0) || 0);
        },
      },
    ];

    const channel = createRealtimeChannel(`portal-payments-${student.id}`, handlers);
    return () => {
      cleanupRealtimeChannel(channel);
    };
  }, [student]);

  const paidTotal = useMemo(
    () => payments.filter(isPaidPayment).reduce((sum, payment) => sum + getPaymentAmount(payment), 0),
    [payments],
  );

  const pendingTotal = getOutstandingAmount(balance);
  const hasSummary = payments.length > 0 || pendingTotal > 0;

  if (loading) return <Spin text="جارٍ تحميل المدفوعات..." />;

  return (
    <div className="page-stack a-up">
      {hasSummary && (
        <>
          <div className="portal-metric-grid two">
            {[
              { l: 'إجمالي المدفوع', v: paidTotal, c: 'var(--green)', bg: 'var(--green-bg)', icon: CheckCircle, glow: 'rgba(16,185,129,.35)' },
              { l: 'المتبقي', v: pendingTotal, c: 'var(--rose)', bg: 'var(--rose-bg)', icon: Clock, glow: 'rgba(244,63,94,.35)' },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.l} className="metric-card" style={{ gap: 0 }}>
                  <div className="metric-icon" style={{ background: stat.bg, boxShadow: `0 0 12px ${stat.glow}` }}>
                    <Icon size={18} color={stat.c} />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: stat.c, lineHeight: 1, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>
                    {stat.v.toLocaleString()}
                    <span style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600, marginRight: 3 }}>ج.م</span>
                  </div>
                  <div className="metric-label" style={{ fontFamily: "'Cairo',sans-serif" }}>{stat.l}</div>
                </div>
              );
            })}
          </div>

          {payments.length > 0 && <MonthPaymentBar payments={payments} />}
        </>
      )}

      {payments.length === 0
        ? (
          <div className="content-card">
            <Empty icon={CreditCard} text="لا يوجد سجل مدفوعات" sub="لم يتم تسجيل أي مدفوعات بعد" />
          </div>
        )
        : payments.map((payment, index) => {
          const paid = isPaidPayment(payment);
          const rawDate = resolvePaymentDate(payment);
          const paymentDate = rawDate ? new Date(rawDate) : null;
          const paymentMonthKey = resolvePaymentMonthKey(payment);
          const paymentMeta = payment.payment_type
            || payment.payment_method
            || payment.method
            || (paymentMonthKey ? `قسط ${paymentMonthKey}` : '');

          return (
            <div key={payment.id} className="record-row a-up" style={{ animationDelay: `${index * 0.04}s` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className={`record-icon ${paid ? 'green' : 'amber'}`}>
                  {paid
                    ? <CheckCircle size={18} color="var(--green)" />
                    : <Clock size={18} color="var(--amber)" />}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--t1)', lineHeight: 1, fontFamily: "'JetBrains Mono',monospace" }}>
                    {getPaymentAmount(payment).toLocaleString()}
                    <span style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600, marginRight: 3 }}>ج.م</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 700, marginTop: 2, fontFamily: "'JetBrains Mono',monospace" }}>
                    {paymentDate && !Number.isNaN(paymentDate.getTime())
                      ? paymentDate.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })
                      : 'بدون تاريخ'}
                  </div>
                  {paymentMeta && (
                    <div style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 800, marginTop: 4, fontFamily: "'Cairo',sans-serif" }}>
                      {paymentMeta}
                    </div>
                  )}
                </div>
              </div>
              <span className={`status-badge ${paid ? 'status-paid' : 'status-pending'}`}>
                {paid ? 'مدفوع' : 'غير مكتمل'}
              </span>
            </div>
          );
        })}
    </div>
  );
};

export default Payments;
