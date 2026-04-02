import React, { useState, useEffect } from 'react';
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
import { Grade } from '../types';
import { Award, Star, CheckCircle, ThumbsUp, AlertCircle, ThumbsDown, BookOpen } from 'lucide-react';
import { Spin, Empty } from './Attendance';

const getLevel = (pct: number) =>
  pct >= 85 ? { l:'ممتاز',   c:'var(--green)', bg:'var(--green-bg)', bar:'linear-gradient(90deg,#059669,#10b981)', glow:'rgba(16,185,129,.35)', icon: <Star size={14} color="#f59e0b" /> }
: pct >= 70 ? { l:'جيد جداً', c:'var(--p2)',    bg:'var(--violet-bg)', bar:'linear-gradient(90deg,#5b21b6,#7c3aed)', glow:'rgba(124,58,237,.35)', icon: <CheckCircle size={14} color="#7c3aed" /> }
: pct >= 55 ? { l:'جيد',     c:'var(--amber)', bg:'var(--amber-bg)', bar:'linear-gradient(90deg,#b45309,#f59e0b)', glow:'rgba(245,158,11,.35)', icon: <ThumbsUp size={14} color="#d97706" /> }
:             { l:'مقبول',   c:'var(--rose)',  bg:'var(--rose-bg)',  bar:'linear-gradient(90deg,#be123c,#f43f5e)', glow:'rgba(244,63,94,.35)',  icon: <ThumbsDown size={14} color="#f43f5e" /> };

const Grades: React.FC = () => {
  const { student } = useAuth();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const sortGrades = (items: Grade[]) =>
    [...items].sort((left, right) => String(right.assessment_date || '').localeCompare(String(left.assessment_date || '')));

  useEffect(() => {
    const go = async () => {
      if (!student) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.from('grades').select('*')
          .eq('student_id', student.id).order('assessment_date', { ascending: false });
        if (error) throw error;
        if (data) setGrades(data);
      } catch (error) {
        console.error('[Grades] Failed to load grades:', error);
      } finally {
        setLoading(false);
      }
    };

    void go();
  }, [student]);

  useEffect(() => {
    if (!student) return;

    const channel = createRealtimeChannel(`portal-grades-${student.id}`, [
      {
        table: 'grades',
        filter: `student_id=eq.${student.id}`,
        onInsert: ({ new: nextRow }) => {
          if (isSoftDeleted(nextRow)) return;
          setGrades((previous) => sortGrades(upsertListRow(previous, nextRow as unknown as Grade)));
        },
        onUpdate: ({ new: nextRow, old: previousRow }) => {
          const nextId = getRealtimeRecordId(nextRow) || getRealtimeRecordId(previousRow);
          if (!nextId) return;
          setGrades((previous) => {
            if (isSoftDeleted(nextRow)) {
              return removeListRowById(previous, nextId);
            }
            return sortGrades(upsertListRow(previous, nextRow as unknown as Grade));
          });
        },
        onDelete: ({ old: previousRow }) => {
          const previousId = getRealtimeRecordId(previousRow);
          if (!previousId) return;
          setGrades((previous) => removeListRowById(previous, previousId));
        },
      },
    ]);

    return () => {
      cleanupRealtimeChannel(channel);
    };
  }, [student]);

  if (loading) return <Spin text="جاري تحميل الدرجات..." />;

  const avg = grades.length
    ? Math.round(grades.reduce((s, g) => s + (g.score / g.max_score) * 100, 0) / grades.length)
    : 0;
  const av = getLevel(avg);
  const bestGrade = grades.reduce<Grade | null>((best, current) => {
    if (!best) return current;
    const currentRate = current.max_score > 0 ? current.score / current.max_score : 0;
    const bestRate = best.max_score > 0 ? best.score / best.max_score : 0;
    return currentRate > bestRate ? current : best;
  }, null);

  return (
    <div className="page-stack a-up">

      {/* Average ring card */}
      {grades.length > 0 && (
        <div className="section-panel a-up">
          <div className="section-panel-head" style={{ marginBottom:14 }}>
            <div className="section-panel-icon">
              <Award size={16} color="var(--p2)" />
            </div>
            <h3 style={{ fontSize:13, fontWeight:800, color:'var(--t2)', margin:0 }}>متوسط درجاتك العام</h3>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            {/* Circular progress */}
            <div style={{ width:72, height:72, position:'relative', flexShrink:0 }}>
              <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform:'rotate(-90deg)' }}>
                <circle cx="36" cy="36" r="28" fill="none" stroke="var(--bdr)" strokeWidth="7" />
                <circle cx="36" cy="36" r="28" fill="none"
                  stroke={av.c} strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - avg / 100)}`}
                  style={{ filter:`drop-shadow(0 0 6px ${av.glow})`, transition:'stroke-dashoffset 1.2s ease' }}
                />
              </svg>
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:13, fontWeight:900, color:av.c }}>{avg}%</div>
            </div>
            <div>
              <div style={{ fontSize:32, fontWeight:900, color:av.c, lineHeight:1,
                fontFamily:"'JetBrains Mono',monospace", marginBottom:8 }}>
                {avg}<span style={{ fontSize:18, color:'var(--t3)', fontWeight:600 }}>%</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                {av.icon}
                <span style={{ fontSize:12, fontWeight:800, color:av.c,
                  fontFamily:"'Cairo',sans-serif" }}>{av.l}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {grades.length > 0 && (
        <div className="portal-metric-grid two">
          <div className="metric-card">
            <div className="metric-icon" style={{ background: 'var(--violet-bg)' }}>
              <BookOpen size={16} color="var(--p2)" />
            </div>
            <div className="metric-value" style={{ color: 'var(--p2)' }}>{grades.length}</div>
            <div className="metric-label">عدد التقييمات</div>
          </div>
          <div className="metric-card">
            <div className="metric-icon" style={{ background: av.bg }}>
              <Award size={16} color={av.c} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: av.c, lineHeight: 1.3, fontFamily: "'Cairo',sans-serif" }}>
              {bestGrade?.subject || 'لا يوجد'}
            </div>
            <div className="metric-label">
              {bestGrade ? `أفضل نتيجة: ${Math.round((bestGrade.score / Math.max(bestGrade.max_score, 1)) * 100)}%` : 'أفضل مادة'}
            </div>
          </div>
        </div>
      )}

      {/* Grades list */}
      {grades.length === 0
        ? <div className="content-card">
            <Empty icon={Award} text="لا توجد درجات بعد" sub="لم يتم تسجيل أي درجات حتى الآن" />
          </div>
        : grades.map((g, i) => {
            const pct = Math.round((g.score / g.max_score) * 100);
            const v   = getLevel(pct);
            return (
              <div key={g.id} className="content-card a-up" style={{ animationDelay:`${i * .05}s`, gap:0 }}>
                {/* Header row */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                  <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                    <div style={{ width:28, height:28, borderRadius:8, background:'var(--bg3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <BookOpen size={14} color="var(--t3)" />
                    </div>
                    <div>
                      <div style={{ fontSize:16, fontWeight:900, color:'var(--t1)', marginBottom:3,
                        fontFamily:"'Cairo',sans-serif" }}>{g.subject}</div>
                      {g.type && (
                        <div style={{ fontSize:11, color:'var(--t3)', fontWeight:700,
                          fontFamily:"'Cairo',sans-serif" }}>{g.type}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign:'left' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4, flexDirection:'row-reverse' }}>
                      {v.icon}
                      <span className="status-badge" style={{
                        background: v.bg, color: v.c,
                        borderColor: `${v.c}30`,
                      }}>{v.l}</span>
                    </div>
                    <div style={{ fontSize:10, color:'var(--t3)', fontWeight:700, marginTop:4,
                      textAlign:'center', fontFamily:"'JetBrains Mono',monospace" }}>
                      {new Date(g.assessment_date).toLocaleDateString('ar-EG')}
                    </div>
                  </div>
                </div>

                {/* Score + bar */}
                <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ fontSize:32, fontWeight:900, color:v.c, lineHeight:1,
                    fontFamily:"'JetBrains Mono',monospace", flexShrink:0,
                    textShadow:`0 0 14px ${v.glow}` }}>
                    {g.score}
                    <span style={{ fontSize:18, color:'var(--t3)', fontWeight:600 }}>/{g.max_score}</span>
                  </div>
                  <div style={{ flex:1 }}>
                    <div className="prog">
                      <div className="prog-fill a-bar" style={{ width:`${pct}%`, background:v.bar }} />
                    </div>
                    <div style={{ fontSize:11, color:'var(--t3)', fontWeight:700, marginTop:4, textAlign:'left' }}>
                      {pct}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })
      }
    </div>
  );
};

export default Grades;
