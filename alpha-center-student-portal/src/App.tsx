import React, { useState, useEffect, useRef } from 'react';
import { studentAggregate, isSupabaseConfigured } from './db';
import type { StudentProfile, AttendanceRecord, PaymentRecord, GradeRecord, Exam, NotificationItem } from './types/domain';
import { initialStudentProfile, initialAttendanceRecords, initialPaymentRecords, initialGradeRecords, examsData } from './data';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Attendance from './components/Attendance';
import Payments from './components/Payments';
import Grades from './components/Grades';
import ExamTaker from './components/ExamTaker';
import AuthScreens from './components/AuthScreens';
import AIAnalysis from './components/AIAnalysis';
import { LayoutDashboard, CalendarCheck, CreditCard, GraduationCap, FileText, Bell, Sparkles, LogOut, Brain, Sun, Moon } from 'lucide-react';
import { ToastProvider, useToast } from './components/Toast';
import { motion, AnimatePresence } from 'motion/react';

const playMobileHapticTap = (type: 'light' | 'success' | 'warning' | 'pop') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'light') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } else if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'warning') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } else if (type === 'pop') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    }
  } catch (err) {}
};

function StudentPortalApp() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  const [currentStudent, setCurrentStudent] = useState<StudentProfile | null>(() => {
    const local = localStorage.getItem('portal_logged_in_student');
    return local ? JSON.parse(local) : null;
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('portal_theme') === 'dark';
  });

  const [profile, setProfile] = useState<StudentProfile>(() => {
    const local = localStorage.getItem('portal_profile');
    return local ? JSON.parse(local) : initialStudentProfile;
  });

  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    const local = localStorage.getItem('portal_attendance');
    return local ? JSON.parse(local) : initialAttendanceRecords;
  });

  const [payments, setPayments] = useState<PaymentRecord[]>(() => {
    const local = localStorage.getItem('portal_payments');
    return local ? JSON.parse(local) : initialPaymentRecords;
  });

  const [grades, setGrades] = useState<GradeRecord[]>(() => {
    const local = localStorage.getItem('portal_grades');
    return local ? JSON.parse(local) : initialGradeRecords;
  });

  const [exams, setExams] = useState<Exam[]>(() => {
    const local = localStorage.getItem('portal_exams');
    return local ? JSON.parse(local) : examsData;
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const local = localStorage.getItem('portal_notifications');
    if (local) return JSON.parse(local);
    return [
      {
        id: 'notif-1', title: 'تم تسجيل الحضور',
        message: 'تم رصد تحضير حضورك بنجاح في محاضرة "الرياضيات البحتة (التفاضل)" اليوم.',
        category: 'attendance', timestamp: 'قبل ساعتين', read: false,
      },
      {
        id: 'notif-2', title: 'رسوم مستحقة السداد',
        message: 'تنبيه مالي: رسوم ملازم ومطبوعات مادة الفيزياء مستحقة للسداد الفوري بقيمة (120 جم).',
        category: 'payments', timestamp: 'قبل يوم واحد', read: false,
      },
    ];
  });

  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsFilter, setNotificationsFilter] = useState<'all' | 'attendance' | 'payments' | 'exams'>('all');

  const [islandText, setIslandText] = useState<string | null>(null);
  const [islandIcon, setIslandIcon] = useState<'status' | 'success' | 'warning' | 'grade' | 'fawry'>('status');
  const [islandActive, setIslandActive] = useState(false);

  const triggerDynamicIsland = (text: string, iconType: 'status' | 'success' | 'warning' | 'grade' | 'fawry' = 'status') => {
    setIslandText(text);
    setIslandIcon(iconType);
    setIslandActive(true);
    playMobileHapticTap('pop');
    setTimeout(() => setIslandActive(false), 3800);
  };

  const [currentTime, setCurrentTime] = useState('10:42 ص');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hrsNum = now.getHours();
      const ampm = hrsNum >= 12 ? 'م' : 'ص';
      const h12 = hrsNum % 12 || 12;
      setCurrentTime(`${String(h12).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('portal_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('portal_theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (!currentStudent) return;
    setProfile(prev => ({
      ...prev,
      id: currentStudent.id,
      name: currentStudent.name,
      studentCode: currentStudent.studentCode,
      phone: currentStudent.phone,
      parentPhone: currentStudent.parentPhone,
      gradeLevel: currentStudent.gradeLevel,
      balance: currentStudent.balance,
      group: currentStudent.group,
    }));

    const loadLiveData = async () => {
      try {
        const dash = await studentAggregate.loadDashboard(currentStudent.id);
        if (dash.profile) {
          setProfile(prev => ({ ...prev, ...dash.profile }));
        }
        if (dash.attendance.length > 0) setAttendance(dash.attendance);
        if (dash.payments.length > 0) {
          setPayments(dash.payments);
          const totalPending = dash.payments
            .filter(p => p.status === 'pending')
            .reduce((acc, p) => acc + p.amount, 0);
          setProfile(prev => ({ ...prev, balance: totalPending }));
        }
        if (dash.grades.length > 0) setGrades(dash.grades);
      } catch (e) {
        console.warn('Failed to load live data from Supabase:', e);
      }
    };
    loadLiveData();

    const loadExams = async () => {
      try {
        const liveExams = await studentAggregate.getExams();
        if (liveExams.length > 0) setExams(liveExams);
      } catch {}
    };
    loadExams();
  }, [currentStudent]);

  useEffect(() => { localStorage.setItem('portal_profile', JSON.stringify(profile)); }, [profile]);
  useEffect(() => { localStorage.setItem('portal_attendance', JSON.stringify(attendance)); }, [attendance]);
  useEffect(() => { localStorage.setItem('portal_payments', JSON.stringify(payments)); }, [payments]);
  useEffect(() => { localStorage.setItem('portal_grades', JSON.stringify(grades)); }, [grades]);
  useEffect(() => { localStorage.setItem('portal_exams', JSON.stringify(exams)); }, [exams]);
  useEffect(() => { localStorage.setItem('portal_notifications', JSON.stringify(notifications)); }, [notifications]);

  const handleAddExcuse = (subject: string, date: string, remarks: string) => {
    const newRecord: AttendanceRecord = {
      id: `att-exc-${Date.now()}`,
      date,
      subject,
      status: 'excused',
      notes: remarks,
    };
    const updatedAttendance = [newRecord, ...attendance];
    setAttendance(updatedAttendance);
    const total = updatedAttendance.length;
    const present = updatedAttendance.filter(r => r.status === 'present').length;
    const excused = updatedAttendance.filter(r => r.status === 'excused').length;
    const late = updatedAttendance.filter(r => r.status === 'late').length;
    const newRate = total > 0 ? parseFloat((((present + excused + (late * 0.7)) / total) * 100).toFixed(1)) : 100;
    setProfile(prev => ({ ...prev, attendanceRate: newRate }));
    playMobileHapticTap('success');
    triggerDynamicIsland(`ثبت عذر لمقرر ${subject} 📋`, 'success');
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`, title: 'طلب التماس غياب قيد المراجعة',
      message: `تم رفع التماس غياب رسمي لمقرر "${subject}" بتاريخ ${date} بنجاح.`,
      category: 'attendance', timestamp: 'الآن', read: false,
    };
    setNotifications(prev => [newNotif, ...prev]);
    showToast('تم تقديم العذر بنجاح 📋', `تم تسجيل طلب العذر لمادة "${subject}"`, 'info');
  };

  const handlePayInvoice = (invoiceId: string, _method?: string) => {
    let invoiceAmt = 0;
    const updatedPayments = payments.map(p => {
      if (p.id === invoiceId) {
        invoiceAmt = p.amount;
        return { ...p, status: 'paid' as const, paidAt: new Date().toISOString().split('T')[0] };
      }
      return p;
    });
    setPayments(updatedPayments);
    setProfile(prev => ({ ...prev, balance: Math.max(0, prev.balance - invoiceAmt) }));
    playMobileHapticTap('success');
    triggerDynamicIsland(`تلقينا دفع بقيمة ${invoiceAmt} جم 💳`, 'fawry');
    const targetInvoice = payments.find(p => p.id === invoiceId);
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`, title: 'إثبات سداد بند مالي 💳',
      message: `تم دفع "${targetInvoice?.title || 'رسوم دراسية'}" بقيمة ${invoiceAmt} جم بنجاح.`,
      category: 'payments', timestamp: 'الآن', read: false,
    };
    setNotifications(prev => [newNotif, ...prev]);
    showToast('تم تأكيد السداد المالي 💳', `تم دفع ${invoiceAmt} جم بنجاح.`, 'success');
  };

  const handleAddGrade = (newGrade: GradeRecord) => {
    const alreadyExists = grades.some(g => g.subject === newGrade.subject && g.type === 'final');
    if (!alreadyExists) {
      setGrades(prev => [newGrade, ...prev]);
    }
    const updatedExams = exams.map(e => {
      if (e.subject === newGrade.subject && e.status === 'available') {
        return { ...e, status: 'completed' as const };
      }
      return e;
    });
    setExams(updatedExams);
    playMobileHapticTap('success');
    triggerDynamicIsland(`جديد: رصد تقدير ${newGrade.letterGrade} 🎉`, 'grade');
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`, title: 'إعلان نتيجة الامتحان رسمياً 🏆',
      message: `حصلت على درجة ${newGrade.score}/${newGrade.maxScore} في "${newGrade.subject}".`,
      category: 'exams', timestamp: 'الآن', read: false,
    };
    setNotifications(prev => [newNotif, ...prev]);
    showToast('تم رصد ورفع علامتك الأكاديمية 🏆', `درجة ${newGrade.score}/${newGrade.maxScore}`, 'success');
  };

  const handleResetData = () => {
    if (window.confirm('تأكيد إعادة تهيئة البوابة؟')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('portal_logged_in_student');
    setCurrentStudent(null);
  };

  const changeTabWithHaptic = (tab: string) => {
    setActiveTab(tab);
    playMobileHapticTap('light');
  };

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const diffX = touchStartXRef.current - e.changedTouches[0].clientX;
    const diffY = touchStartYRef.current - e.changedTouches[0].clientY;
    if (Math.abs(diffX) > 85 && Math.abs(diffY) < 60) {
      const order = ['dashboard', 'attendance', 'payments', 'grades', 'exams'];
      const currentIndex = order.indexOf(activeTab);
      if (diffX > 0 && currentIndex < order.length - 1) changeTabWithHaptic(order[currentIndex + 1]);
      else if (diffX < 0 && currentIndex > 0) changeTabWithHaptic(order[currentIndex - 1]);
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  if (!currentStudent) {
    return (
      <AuthScreens
        onLoginSuccess={(student) => {
          setCurrentStudent(student);
          localStorage.setItem('portal_logged_in_student', JSON.stringify(student));
        }}
      />
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard profile={profile} attendance={attendance} payments={payments} grades={grades} exams={exams} onNavigate={(tab) => changeTabWithHaptic(tab)} />;
      case 'attendance':
        return <Attendance records={attendance} onAddExcuse={handleAddExcuse} />;
      case 'payments':
        return <Payments records={payments} onPayInvoice={handlePayInvoice} />;
      case 'grades':
        return <Grades records={grades} />;
      case 'exams':
        return <ExamTaker exams={exams} onAddGrade={handleAddGrade} />;
      case 'ai-analysis':
        return <AIAnalysis profile={profile} grades={grades} attendance={attendance} onNavigate={(tab) => changeTabWithHaptic(tab)} />;
      default:
        return null;
    }
  };

  const navItems = [
    { key: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
    { key: 'attendance', label: 'التحضير', icon: CalendarCheck },
    { key: 'payments', label: 'المدفوعات', icon: CreditCard },
    { key: 'grades', label: 'الدرجات', icon: GraduationCap },
    { key: 'exams', label: 'الامتحانات', icon: FileText },
  ];

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className={`min-h-screen font-sans ${isDarkMode ? 'dark bg-bg-app text-text-primary' : 'bg-transparent text-text-primary'} transition-colors duration-300 relative select-none`} dir="rtl">
      <div className="absolute top-0 right-0 w-[55vw] h-[55vh] rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[50vw] h-[50vh] rounded-full bg-emerald-500/5 dark:bg-emerald-500/5 blur-[130px] pointer-events-none" />

      <div className="w-full max-w-lg md:max-w-2xl lg:max-w-5xl xl:max-w-6xl mx-auto flex flex-col min-h-screen relative overflow-hidden px-4 md:px-6 lg:px-8">
        <div className="pt-6 pb-2 flex items-center justify-between" id="mobile-top-bar">
          <div className="flex items-center gap-3">
            <div className="relative group">
              <img src={profile.avatar || ''} alt={profile.name}
                className="w-11 h-11 rounded-2xl object-cover ring-3 ring-indigo-500/20 shadow-md group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
              <span className="absolute -bottom-1 -right-0.5 block w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-950" />
            </div>
            <div className="text-right">
              <span className="text-[10px] text-text-muted block font-mono">مرحباً بك،</span>
              <span className="text-xs font-black text-text-primary flex items-center gap-1">
                {profile.name.split(' ').slice(0, 2).join(' ')}
                <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={() => { setShowNotifications(!showNotifications); playMobileHapticTap('light'); }}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-slate-900 rounded-xl transition-all relative border border-neutral-200/40 dark:border-slate-800 text-indigo-650 dark:text-indigo-400 cursor-pointer">
              <Bell className="w-4.5 h-4.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center text-[8px] text-white font-black animate-pulse shadow-sm">
                  {unreadCount}
                </span>
              )}
            </button>
            <button onClick={() => changeTabWithHaptic('ai-analysis')}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-slate-900 rounded-xl transition-all relative border border-neutral-200/40 dark:border-slate-800 text-indigo-650 dark:text-indigo-400 cursor-pointer">
              <Brain className="w-4.5 h-4.5" />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            </button>
            <button onClick={() => { setIsDarkMode(!isDarkMode); playMobileHapticTap('light'); }}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-slate-900 rounded-xl transition-all border border-neutral-200/40 dark:border-slate-800 text-gray-400 cursor-pointer">
              {isDarkMode ? <Sun className="w-4.5 h-4.5 text-amber-400" /> : <Moon className="w-4.5 h-4.5 text-indigo-400" />}
            </button>
            <button onClick={handleLogout}
              className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-450 rounded-xl text-xs font-bold font-sans transition-colors cursor-pointer">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showNotifications && (
            <motion.div initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="absolute top-22 inset-x-4 md:inset-x-6 lg:inset-x-8 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border border-indigo-100/40 dark:border-slate-850 p-5 rounded-[28px] shadow-xl space-y-4 text-right select-none">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-850/50 pb-3">
                <div className="text-right">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-1.5 font-sans justify-end">
                    <span>مركز الإشعارات الأكاديمية</span>
                    <Bell className="w-4 h-4 text-indigo-500 animate-bounce" />
                  </h3>
                  <p className="text-[10px] text-neutral-450 dark:text-slate-500 mt-0.5 font-sans">تنبيهات التحضير، المطالبات المالية، والامتحانات</p>
                </div>
                <button onClick={() => { setShowNotifications(false); playMobileHapticTap('pop'); }}
                  className="p-1 px-2.5 bg-neutral-100 dark:bg-slate-900 text-neutral-500 dark:text-slate-400 hover:text-rose-505 rounded-xl text-[10px] font-sans transition-all cursor-pointer font-bold">
                  إغلاق
                </button>
              </div>
              <div className="flex gap-1.5 pb-1 overflow-x-auto scrollbar-none justify-end">
                {[
                  { key: 'all', label: 'الكل' },
                  { key: 'attendance', label: 'حضور' },
                  { key: 'payments', label: 'مدفوعات' },
                  { key: 'exams', label: 'امتحانات' },
                ].map((chip) => (
                  <button key={chip.key}
                    onClick={() => { setNotificationsFilter(chip.key as any); playMobileHapticTap('light'); }}
                    className={`text-[10px] px-3 py-1 rounded-full transition-all shrink-0 font-sans font-bold cursor-pointer ${notificationsFilter === chip.key ? 'bg-indigo-600 text-white shadow-sm' : 'bg-neutral-100 dark:bg-slate-900 text-neutral-550 dark:text-zinc-400'}`}>
                    {chip.label}
                  </button>
                ))}
              </div>
              <div className="max-h-72 overflow-y-auto space-y-1">
                {notifications.filter(n => notificationsFilter === 'all' || n.category === notificationsFilter).length === 0 ? (
                  <div className="py-8 text-center text-xs text-text-muted">لا توجد تنبيهات</div>
                ) : (
                  notifications.filter(n => notificationsFilter === 'all' || n.category === notificationsFilter).map((item) => (
                    <div key={item.id}
                      onClick={() => setNotifications(notifications.map(n => n.id === item.id ? { ...n, read: true } : n))}
                      className={`p-3 rounded-2xl flex gap-3 items-center text-right cursor-pointer group ${item.read ? 'opacity-70' : 'bg-indigo-50/25 dark:bg-indigo-500/5'}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          {!item.read && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 block" />}
                          <span className="text-xs font-bold">{item.title}</span>
                        </div>
                        <p className="text-[10px] text-neutral-450 dark:text-slate-400 mt-0.5">{item.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="flex-1 pb-32 pt-4" id="mobile-tab-screen">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }} className="space-y-6">
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="fixed bottom-6 inset-x-4 md:max-w-lg lg:max-w-2xl md:mx-auto z-40 bg-white/80 dark:bg-slate-950/70 backdrop-blur-xl border border-slate-200/50 dark:border-slate-850/60 rounded-[28px] p-2 flex items-center justify-around shadow-lg">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button key={item.key} onClick={() => changeTabWithHaptic(item.key)}
                className="relative py-2.5 px-3 rounded-2xl flex flex-col items-center justify-center gap-1 cursor-pointer group select-none flex-1">
                {isActive && <motion.span layoutId="active-mobile-dot"
                  className="absolute inset-0 bg-indigo-600/10 dark:bg-indigo-500/15 rounded-2xl border border-indigo-500/10"
                  transition={{ type: 'spring', stiffness: 180, damping: 15 }} />}
                <IconComponent className={`w-4.5 h-4.5 transition-transform group-hover:scale-110 shrink-0 ${isActive ? 'text-indigo-650 dark:text-indigo-400 scale-105' : 'text-neutral-400 dark:text-zinc-500'}`} />
                <span className={`text-[10px] font-black font-sans truncate ${isActive ? 'text-indigo-650 dark:text-indigo-400' : 'text-neutral-450 dark:text-zinc-500'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <StudentPortalApp />
    </ToastProvider>
  );
}
