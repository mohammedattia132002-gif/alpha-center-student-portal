import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import { supabase } from '../lib/supabase';
import { loadStudentProfile } from '../lib/studentProfile';
import { canStudentAccessExam } from '../lib/examAccess';
import {
  cleanupRealtimeChannel,
  createRealtimeChannel,
  getRealtimeRecordId,
  isSoftDeleted,
  removeListRowById,
  upsertListRow,
  type TableRealtimeHandlers,
} from '../lib/supabaseRealtime';
import {
  isMonthlyPayment,
  isPaidPayment,
  isPresentAttendanceStatus,
  resolveAttendanceDate,
  resolvePaymentDate,
  resolvePaymentMonthKey,
} from '../lib/studentPortalData';
import {
  Award,
  BookOpen,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  Hash,
  Home,
  LogOut,
  Moon,
  Sun,
  TrendingUp,
  User,
} from 'lucide-react';
import Attendance from './Attendance';
import ExamsList from './ExamsList';
import Grades from './Grades';
import Payments from './Payments';
import type {
  Attendance as AttendanceRow,
  ExamAttempt,
  Grade,
  Payment,
  PlatformExam,
  PlatformResult,
  Student,
} from '../types';

type Tab = 'home' | 'attendance' | 'grades' | 'payments' | 'exams';

interface Summary {
  presentDays: number;
  absentDays: number;
  totalDays: number;
  attendanceRate: number;
  lastSubject: string;
  lastScore: number;
  lastMax: number;
  availableExam: string | null;
}

const sortAttendanceRows = (items: AttendanceRow[]) =>
  [...items].sort((left, right) =>
    resolveAttendanceDate(right).localeCompare(resolveAttendanceDate(left))
  );

const sortGradeRows = (items: Grade[]) =>
  [...items].sort((left, right) =>
    String(right.assessment_date || '').localeCompare(String(left.assessment_date || ''))
  );

const sortPaymentRows = (items: Payment[]) =>
  [...items].sort((left, right) =>
    String(resolvePaymentDate(right) || '').localeCompare(String(resolvePaymentDate(left) || ''))
  );

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

      const rawDate = resolvePaymentDate(payment);
      if (!rawDate) return false;

      const parsed = new Date(rawDate);
      return !Number.isNaN(parsed.getTime()) && parsed.getMonth() + 1 === month;
    });

  return (
    <div className="month-bar-card a-up">
      <div className="content-card-hdr" style={{ marginBottom: 16 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--violet-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CreditCard size={16} color="var(--p2)" />
        </div>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--t2)', margin: 0 }}>سجل المدفوعات الشهرية</h3>
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
                  background: paid ? 'var(--green)' : 'var(--bg3)',
                  borderColor: paid ? 'var(--green)' : 'var(--bdr)',
                  boxShadow: paid ? '0 4px 12px rgba(16,185,129,.35)' : 'none',
                  color: paid ? '#fff' : 'var(--t4)',
                }}
              >
                {paid ? <Check size={14} strokeWidth={3} /> : <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--t4)' }} />}
              </div>
              <span style={{ fontSize: 12, fontWeight: 900, color: paid ? 'var(--green)' : 'var(--t3)', fontFamily: "'JetBrains Mono', monospace" }}>
                {month}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { student, logout } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [tab, setTabState] = useState<Tab>(() => {
    const hash = window.location.hash.replace('#', '');
    return ['home', 'attendance', 'grades', 'payments', 'exams'].includes(hash) ? (hash as Tab) : 'home';
  });
  const [homeLoaded, setHomeLoaded] = useState(false);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [gradeRows, setGradeRows] = useState<Grade[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [examRows, setExamRows] = useState<PlatformExam[]>([]);
  const [resultRows, setResultRows] = useState<PlatformResult[]>([]);
  const [attemptRows, setAttemptRows] = useState<ExamAttempt[]>([]);
  const [profileStudent, setProfileStudent] = useState<Student | null>(null);
  const studentView = profileStudent || student;

  const setTab = (nextTab: Tab) => {
    window.location.hash = nextTab;
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (['home', 'attendance', 'grades', 'payments', 'exams'].includes(hash)) {
        setTabState(hash as Tab);
      } else {
        setTabState('home');
      }
    };

    if (!window.location.hash) {
      window.history.replaceState(null, '', '#home');
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (!student) return;

    const load = async () => {
      setHomeLoaded(false);

      try {
        const [
          profile,
          attendanceRes,
          gradesRes,
          paymentsRes,
          examsRes,
          resultsRes,
          attemptsRes,
        ] = await Promise.all([
          loadStudentProfile(student.id),
          supabase
            .from('attendance')
            .select('id,date,status')
            .eq('student_id', student.id)
            .is('deleted_at', null)
            .order('date', { ascending: false }),
          supabase
            .from('grades')
            .select('*')
            .eq('student_id', student.id)
            .order('assessment_date', { ascending: false }),
          supabase
            .from('payments')
            .select('*')
            .eq('student_id', student.id)
            .is('deleted_at', null)
            .order('paid_at', { ascending: false }),
          supabase.from('platform_exams').select('*').eq('active', true),
          supabase.from('platform_results').select('*').eq('student_id', student.id),
          supabase.from('exam_attempts').select('*').eq('student_id', student.id),
        ]);

        if (attendanceRes.error) throw attendanceRes.error;
        if (gradesRes.error) throw gradesRes.error;
        if (paymentsRes.error) throw paymentsRes.error;
        if (examsRes.error) throw examsRes.error;
        if (resultsRes.error) throw resultsRes.error;
        if (attemptsRes.error) throw attemptsRes.error;

        const effectiveStudent = profile || student;
        setProfileStudent(profile || null);
        setAttendanceRows(sortAttendanceRows((attendanceRes.data || []) as AttendanceRow[]));
        setGradeRows(sortGradeRows((gradesRes.data || []) as Grade[]));
        setPayments(sortPaymentRows((paymentsRes.data || []) as Payment[]));
        setExamRows(
          ((examsRes.data || []) as PlatformExam[]).filter((exam) =>
            canStudentAccessExam(effectiveStudent, exam)
          )
        );
        setResultRows((resultsRes.data || []) as PlatformResult[]);
        setAttemptRows((attemptsRes.data || []) as ExamAttempt[]);
      } catch (error) {
        console.error('[Dashboard] Failed to load home summary:', error);
      } finally {
        setHomeLoaded(true);
      }
    };

    void load();
  }, [student]);

  useEffect(() => {
    if (!student) return;

    const effectiveStudent = studentView || student;
    const refreshProfile = async () => {
      try {
        const nextProfile = await loadStudentProfile(student.id);
        setProfileStudent(nextProfile || null);
      } catch (error) {
        console.error('[Dashboard] Failed to refresh student profile:', error);
      }
    };

    const applyExamRow = (row: PlatformExam) => {
      const isActive = row.active !== false;
      const canAccess = canStudentAccessExam(effectiveStudent, row);
      setExamRows((previous) => {
        if (!isActive || !canAccess) {
          return removeListRowById(previous, row.id);
        }
        return upsertListRow(previous, row);
      });
    };

    const handlers: TableRealtimeHandlers[] = [
      {
        table: 'attendance',
        filter: `student_id=eq.${student.id}`,
        onInsert: ({ new: nextRow }) => {
          if (isSoftDeleted(nextRow)) return;
          setAttendanceRows((previous) =>
            sortAttendanceRows(upsertListRow(previous, nextRow as unknown as AttendanceRow))
          );
        },
        onUpdate: ({ new: nextRow, old: previousRow }) => {
          const nextId = getRealtimeRecordId(nextRow) || getRealtimeRecordId(previousRow);
          if (!nextId) return;
          setAttendanceRows((previous) => {
            if (isSoftDeleted(nextRow)) {
              return removeListRowById(previous, nextId);
            }
            return sortAttendanceRows(upsertListRow(previous, nextRow as unknown as AttendanceRow));
          });
        },
        onDelete: ({ old: previousRow }) => {
          const previousId = getRealtimeRecordId(previousRow);
          if (!previousId) return;
          setAttendanceRows((previous) => removeListRowById(previous, previousId));
        },
      },
      {
        table: 'grades',
        filter: `student_id=eq.${student.id}`,
        onInsert: ({ new: nextRow }) => {
          if (isSoftDeleted(nextRow)) return;
          setGradeRows((previous) => sortGradeRows(upsertListRow(previous, nextRow as unknown as Grade)));
        },
        onUpdate: ({ new: nextRow, old: previousRow }) => {
          const nextId = getRealtimeRecordId(nextRow) || getRealtimeRecordId(previousRow);
          if (!nextId) return;
          setGradeRows((previous) => {
            if (isSoftDeleted(nextRow)) {
              return removeListRowById(previous, nextId);
            }
            return sortGradeRows(upsertListRow(previous, nextRow as unknown as Grade));
          });
        },
        onDelete: ({ old: previousRow }) => {
          const previousId = getRealtimeRecordId(previousRow);
          if (!previousId) return;
          setGradeRows((previous) => removeListRowById(previous, previousId));
        },
      },
      {
        table: 'payments',
        filter: `student_id=eq.${student.id}`,
        onInsert: ({ new: nextRow }) => {
          if (isSoftDeleted(nextRow)) return;
          setPayments((previous) => sortPaymentRows(upsertListRow(previous, nextRow as unknown as Payment)));
        },
        onUpdate: ({ new: nextRow, old: previousRow }) => {
          const nextId = getRealtimeRecordId(nextRow) || getRealtimeRecordId(previousRow);
          if (!nextId) return;
          setPayments((previous) => {
            if (isSoftDeleted(nextRow)) {
              return removeListRowById(previous, nextId);
            }
            return sortPaymentRows(upsertListRow(previous, nextRow as unknown as Payment));
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
        onInsert: () => {
          void refreshProfile();
        },
        onUpdate: () => {
          void refreshProfile();
        },
      },
      {
        table: 'enrollments',
        filter: `student_id=eq.${student.id}`,
        onInsert: () => {
          void refreshProfile();
        },
        onUpdate: () => {
          void refreshProfile();
        },
        onDelete: () => {
          void refreshProfile();
        },
      },
      {
        table: 'platform_results',
        filter: `student_id=eq.${student.id}`,
        onInsert: ({ new: nextRow }) => {
          setResultRows((previous) => upsertListRow(previous, nextRow as unknown as PlatformResult));
        },
        onUpdate: ({ new: nextRow }) => {
          setResultRows((previous) => upsertListRow(previous, nextRow as unknown as PlatformResult));
        },
        onDelete: ({ old: previousRow }) => {
          const previousId = getRealtimeRecordId(previousRow);
          if (!previousId) return;
          setResultRows((previous) => removeListRowById(previous, previousId));
        },
      },
      {
        table: 'exam_attempts',
        filter: `student_id=eq.${student.id}`,
        onInsert: ({ new: nextRow }) => {
          setAttemptRows((previous) => upsertListRow(previous, nextRow as unknown as ExamAttempt));
        },
        onUpdate: ({ new: nextRow }) => {
          setAttemptRows((previous) => upsertListRow(previous, nextRow as unknown as ExamAttempt));
        },
        onDelete: ({ old: previousRow }) => {
          const previousId = getRealtimeRecordId(previousRow);
          if (!previousId) return;
          setAttemptRows((previous) => removeListRowById(previous, previousId));
        },
      },
    ];

    if (student.tenant_id) {
      handlers.push({
        table: 'platform_exams',
        filter: `tenant_id=eq.${student.tenant_id}`,
        onInsert: ({ new: nextRow }) => {
          applyExamRow(nextRow as unknown as PlatformExam);
        },
        onUpdate: ({ new: nextRow }) => {
          applyExamRow(nextRow as unknown as PlatformExam);
        },
        onDelete: ({ old: previousRow }) => {
          const previousId = getRealtimeRecordId(previousRow);
          if (!previousId) return;
          setExamRows((previous) => removeListRowById(previous, previousId));
        },
      });
    }

    if (studentView?.group_id) {
      handlers.push({
        table: 'groups',
        filter: `id=eq.${studentView.group_id}`,
        onInsert: () => {
          void refreshProfile();
        },
        onUpdate: () => {
          void refreshProfile();
        },
        onDelete: () => {
          void refreshProfile();
        },
      });
    }

    const channel = createRealtimeChannel(`portal-dashboard-home-${student.id}`, handlers);
    return () => {
      cleanupRealtimeChannel(channel);
    };
  }, [
    studentView?.grade_level,
    studentView?.group_id,
    studentView?.group_name,
    student?.id,
    student?.tenant_id,
  ]);

  if (!student) return null;

  const presentDays = attendanceRows.filter((row) => isPresentAttendanceStatus(row.status)).length;
  const totalDays = attendanceRows.length;
  const absentDays = totalDays - presentDays;
  const attendanceRate = totalDays ? Math.round((presentDays / totalDays) * 100) : 0;
  const latestGrade = gradeRows[0];
  const completedExamIds = new Set([
    ...resultRows.map((row) => row.exam_id),
    ...attemptRows
      .filter((row) => ['completed', 'terminated'].includes(row.status))
      .map((row) => row.exam_id),
  ]);
  const availableExam = examRows.find((exam) => {
    if (!studentView || completedExamIds.has(exam.id)) return false;
    return canStudentAccessExam(studentView, exam);
  });
  const summary: Summary | null = homeLoaded
    ? {
        presentDays,
        absentDays,
        totalDays,
        attendanceRate,
        lastSubject: latestGrade?.subject || '',
        lastScore: latestGrade?.score || 0,
        lastMax: latestGrade?.max_score || 0,
        availableExam: availableExam?.title || null,
      }
    : null;

  const navItems: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'home', label: 'الرئيسية', icon: Home },
    { id: 'attendance', label: 'الحضور', icon: Calendar },
    { id: 'grades', label: 'الدرجات', icon: Award },
    { id: 'payments', label: 'المدفوعات', icon: CreditCard },
    { id: 'exams', label: 'الامتحانات', icon: FileText },
  ];

  const tabLabels: Record<Tab, string> = {
    home: 'الرئيسية',
    attendance: 'سجل الحضور',
    grades: 'الدرجات',
    payments: 'المدفوعات',
    exams: 'الامتحانات',
  };

  let overallScore = 0;
  if (summary) {
    overallScore = summary.attendanceRate;
    if (summary.lastMax > 0) {
      const gradeRate = Math.round((summary.lastScore / summary.lastMax) * 100);
      overallScore = Math.round((summary.attendanceRate + gradeRate) / 2);
    }
  }

  return (
    <div style={{ fontFamily: "'Cairo',sans-serif", direction: 'rtl', minHeight: '100vh', background: 'var(--bg)' }}>
      <header className="portal-header">
        <div className="portal-header-inner">
          {tab !== 'home' ? (
            <button onClick={() => setTab('home')} className="back-btn">
              <ChevronRight size={16} />
              رجوع
            </button>
          ) : (
            <div className="portal-logo">
              <div className="portal-logo-icon">
                <img src="/header-logo.png" style={{ width: 22, height: 22, objectFit: 'contain' }} alt="Alpha Center" />
              </div>
              <span className="portal-logo-text">سنتر الألفا الأستاذ محمد عطية</span>
            </div>
          )}

          {tab !== 'home' && (
            <span className="portal-page-title">{tabLabels[tab]}</span>
          )}

          <div className="portal-header-actions">
            <button onClick={toggleDarkMode} className="icon-btn">
              {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button onClick={logout} className="icon-btn danger">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className="portal-main">
        {tab === 'home' && (
          <>
            <div className="student-hero a-scale" style={{ marginBottom: 14 }}>
              <div className="student-hero-glow" />
              <div className="student-hero-glow2" />
              <div className="student-hero-shell">
                <div className="student-hero-copy">
                  <div className="student-hero-heading">
                    <div className="student-avatar">
                      <User size={24} style={{ color: '#7c3aed', opacity: 0.75, transform: 'translateY(2px)' }} />
                    </div>
                    <h1 className="student-hero-name">
                      {studentView.name}
                    </h1>
                  </div>
                  <div className="student-hero-details">
                    <span className="student-badge badge-purple">
                      <Hash size={9} />
                      {studentView.student_code || studentView.id}
                    </span>
                    <span className="student-badge badge-indigo">
                      <Award size={9} />
                      {studentView.grade_level || 'غير محدد'}
                    </span>
                    {studentView.group_name && (
                      <span className="student-badge badge-slate">
                        <BookOpen size={9} />
                        {studentView.group_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="portal-tabs a-up d2">
              {navItems.filter((item) => item.id !== 'home').map((item) => (
                <button key={item.id} className={`portal-tab ${tab === item.id ? 'active' : ''}`} onClick={() => setTab(item.id)}>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            {summary && (
              <>
                <div className="content-card a-up d1" style={{ marginBottom: 14 }}>
                  <div className="content-card-hdr">
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(124,58,237,.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Award size={16} color="var(--p2)" />
                    </div>
                    <h3>التقييم العام</h3>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
                    <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
                      <svg width="64" height="64" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--bg3)" strokeWidth="4" />
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke={overallScore >= 75 ? 'var(--green)' : overallScore >= 50 ? 'var(--amber)' : 'var(--rose)'}
                          strokeWidth="4"
                          strokeDasharray={`${overallScore}, 100`}
                          strokeLinecap="round"
                          style={{ transition: 'stroke-dasharray 1s ease-out' }}
                        />
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: 'var(--t1)' }}>
                        {overallScore}%
                      </div>
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--t1)', marginBottom: 4 }}>
                        {overallScore >= 85 ? 'ممتاز' : overallScore >= 70 ? 'جيد جدًا' : overallScore >= 50 ? 'متوسط' : 'يحتاج متابعة'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 600, lineHeight: 1.5 }}>
                        يعتمد هذا التقييم على نسبة الحضور وآخر أداء مسجل في التقييمات.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="content-card a-up d3" style={{ marginBottom: 14 }}>
                  <div className="content-card-hdr">
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(124,58,237,.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TrendingUp size={16} color="var(--p2)" />
                    </div>
                    <h3>نظرة عامة على الحضور</h3>
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                    {[
                      { label: 'إجمالي', value: summary.totalDays, color: 'var(--p2)', bg: 'rgba(124,58,237,.08)' },
                      { label: 'حضور', value: summary.presentDays, color: 'var(--green)', bg: 'var(--green-bg)' },
                      { label: 'غياب', value: summary.absentDays, color: 'var(--rose)', bg: 'var(--rose-bg)' },
                    ].map((card) => (
                      <div key={card.label} style={{ flex: 1, textAlign: 'center', padding: '12px 8px', background: card.bg, borderRadius: 12, border: `1px solid ${card.color}20` }}>
                        <div style={{ fontSize: 28, fontWeight: 900, color: card.color, lineHeight: 1, fontFamily: "'JetBrains Mono',monospace" }}>{card.value}</div>
                        <div style={{ fontSize: 10, color: card.color, fontWeight: 700, marginTop: 4, opacity: 0.85 }}>{card.label}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)' }}>نسبة الحضور</span>
                    <span style={{ fontSize: 16, fontWeight: 900, color: summary.attendanceRate >= 75 ? 'var(--green)' : 'var(--rose)' }}>
                      {summary.attendanceRate}%
                    </span>
                  </div>
                  <div className="prog">
                    <div
                      className="prog-fill a-bar"
                      style={{
                        width: `${summary.attendanceRate}%`,
                        background: summary.attendanceRate >= 75
                          ? 'linear-gradient(90deg,#059669,#10b981)'
                          : 'linear-gradient(90deg,#be123c,#f43f5e)',
                      }}
                    />
                  </div>
                  {summary.attendanceRate < 75 && (
                    <p style={{ fontSize: 11, color: 'var(--rose)', fontWeight: 700, marginTop: 8 }}>
                      نسبة حضورك أقل من 75%
                    </p>
                  )}
                </div>
              </>
            )}

            {payments.length > 0 && <MonthPaymentBar payments={payments} />}

            {summary?.availableExam && (
              <div className="content-card a-up d4" style={{ cursor: 'pointer', borderColor: 'rgba(124,58,237,.25)' }} onClick={() => setTab('exams')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(124,58,237,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={20} color="var(--p2)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span className="a-pls" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--p2)', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--p2)' }}>امتحان متاح الآن</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)' }}>
                      {summary.availableExam}
                    </div>
                  </div>
                  <ChevronLeft size={16} color="var(--t3)" />
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'attendance' && <Attendance />}
        {tab === 'grades' && <Grades />}
        {tab === 'payments' && <Payments />}
        {tab === 'exams' && <ExamsList />}
      </main>
    </div>
  );
};

export default Dashboard;
