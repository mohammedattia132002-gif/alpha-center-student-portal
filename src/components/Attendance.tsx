import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  cleanupRealtimeChannel,
  createRealtimeChannel,
  getRealtimeRecordId,
  isSoftDeleted,
  removeListRowById,
  upsertListRow,
} from '../lib/supabaseRealtime';
import { useAuth } from '../AuthContext';
import { isPresentAttendanceStatus, resolveAttendanceDate } from '../lib/studentPortalData';
import { Attendance as AttType } from '../types';
import { Calendar, CheckCircle, Clock, XCircle } from 'lucide-react';

export const Spin: React.FC<{ text?: string }> = ({ text = 'جارٍ التحميل...' }) => (
  <div className="spin-wrap">
    <div className="spinner" />
    <span className="spin-text">{text}</span>
  </div>
);

export const Empty: React.FC<{ icon: React.ElementType; text: string; sub?: string }> = ({ icon: I, text, sub }) => (
  <div className="empty-state">
    <div className="empty-icon-wrap">
      <I size={26} color="var(--t4)" />
    </div>
    <div>
      <div className="empty-title">{text}</div>
      {sub && <div className="empty-sub">{sub}</div>}
    </div>
  </div>
);

const Attendance: React.FC = () => {
  const { student } = useAuth();
  const [data, setData] = useState<AttType[]>([]);
  const [loading, setLoading] = useState(true);
  const sortAttendance = (items: AttType[]) =>
    [...items].sort((left, right) => resolveAttendanceDate(right).localeCompare(resolveAttendanceDate(left)));

  useEffect(() => {
    const go = async () => {
      if (!student) {
        setLoading(false);
        return;
      }

      try {
        const { data: res, error } = await supabase
          .from('attendance')
          .select('id,date,status')
          .eq('student_id', student.id)
          .is('deleted_at', null)
          .order('date', { ascending: false });

        if (error) throw error;
        if (res) {
          setData(res as AttType[]);
        }
      } catch (error) {
        console.error('[Attendance] Failed to load attendance:', error);
      } finally {
        setLoading(false);
      }
    };

    void go();
  }, [student]);

  useEffect(() => {
    if (!student) return;

    const channel = createRealtimeChannel(`portal-attendance-${student.id}`, [
      {
        table: 'attendance',
        filter: `student_id=eq.${student.id}`,
        onInsert: ({ new: nextRow }) => {
          if (isSoftDeleted(nextRow)) return;
          setData((previous) => sortAttendance(upsertListRow(previous, nextRow as unknown as AttType)));
        },
        onUpdate: ({ new: nextRow, old: previousRow }) => {
          const nextId = getRealtimeRecordId(nextRow) || getRealtimeRecordId(previousRow);
          if (!nextId) return;
          setData((previous) => {
            if (isSoftDeleted(nextRow)) {
              return removeListRowById(previous, nextId);
            }
            return sortAttendance(upsertListRow(previous, nextRow as unknown as AttType));
          });
        },
        onDelete: ({ old: previousRow }) => {
          const previousId = getRealtimeRecordId(previousRow);
          if (!previousId) return;
          setData((previous) => removeListRowById(previous, previousId));
        },
      },
    ]);

    return () => {
      cleanupRealtimeChannel(channel);
    };
  }, [student]);

  if (loading) return <Spin text="جارٍ تحميل سجل الحضور..." />;

  const present = data.filter((item) => isPresentAttendanceStatus(item.status)).length;
  const absent = data.length - present;
  const rate = data.length ? Math.round((present / data.length) * 100) : 0;

  return (
    <div className="page-stack a-up">
      {data.length > 0 && (
        <>
          <div className="portal-metric-grid three attendance-summary-grid">
            {[
              { l: 'إجمالي', v: data.length, c: 'var(--p2)', bg: 'var(--violet-bg)', i: Calendar },
              { l: 'حضور', v: present, c: 'var(--green)', bg: 'var(--green-bg)', i: CheckCircle },
              { l: 'غياب', v: absent, c: 'var(--rose)', bg: 'var(--rose-bg)', i: XCircle },
            ].map((stat) => {
              const Icon = stat.i;
              return (
                <div key={stat.l} className="metric-card" style={{ textAlign: 'center' }}>
                  <div className="metric-icon" style={{ background: stat.bg, margin: '0 auto 10px' }}>
                    <Icon size={16} color={stat.c} />
                  </div>
                  <div className="metric-value" style={{ color: stat.c }}>{stat.v}</div>
                  <div className="metric-label">{stat.l}</div>
                </div>
              );
            })}
          </div>

          <div className="section-panel">
            <div className="section-panel-head">
              <div className="section-panel-icon">
                <Clock size={16} color="var(--p2)" />
              </div>
              <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--t2)', margin: 0 }}>نسبة الحضور</h3>
              <span className="section-panel-side" style={{ marginRight: 'auto', color: rate >= 75 ? 'var(--green)' : 'var(--rose)' }}>
                {rate}%
              </span>
            </div>
            <div className="prog" style={{ marginTop: 14, height: 8 }}>
              <div
                className="prog-fill a-bar"
                style={{
                  width: `${rate}%`,
                  background: rate >= 75
                    ? 'linear-gradient(90deg,#059669,#10b981)'
                    : 'linear-gradient(90deg,#be123c,#f43f5e)',
                }}
              />
            </div>
            {rate < 75 && (
              <p style={{ fontSize: 11, color: 'var(--rose)', fontWeight: 700, marginTop: 8, fontFamily: "'Cairo',sans-serif" }}>
                نسبة حضورك أقل من 75%
              </p>
            )}
          </div>
        </>
      )}

      {data.length === 0
        ? (
          <div className="content-card">
            <Empty icon={Calendar} text="لا يوجد سجل حضور حاليًا" sub="لم يتم تسجيل أي حضور بعد" />
          </div>
        )
        : data.map((item, index) => {
          const presentStatus = isPresentAttendanceStatus(item.status);
          const attendanceDate = new Date(resolveAttendanceDate(item));

          return (
            <div key={item.id} className="record-row a-up" style={{ animationDelay: `${index * 0.04}s` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className={`record-icon ${presentStatus ? 'green' : 'rose'}`}>
                  {presentStatus
                    ? <CheckCircle size={17} color="var(--green)" />
                    : <XCircle size={17} color="var(--rose)" />}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--t1)', fontFamily: "'Cairo',sans-serif" }}>
                    {attendanceDate.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 700, marginTop: 3, fontFamily: "'JetBrains Mono',monospace" }}>
                    {attendanceDate.getFullYear()}
                  </div>
                </div>
              </div>
              <span className={`status-badge ${presentStatus ? 'status-present' : 'status-absent'}`}>
                {presentStatus ? 'حاضر' : 'غائب'}
              </span>
            </div>
          );
        })}
    </div>
  );
};

export default Attendance;
