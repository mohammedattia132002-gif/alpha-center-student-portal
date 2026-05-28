/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  StudentProfile, 
  AttendanceRecord, 
  PaymentRecord, 
  GradeRecord, 
  Exam 
} from '../types';
import { 
  Award, 
  CalendarCheck, 
  Wallet, 
  FileText, 
  Flame, 
  Clock, 
  PlayCircle, 
  BookOpen, 
  ChevronLeft,
  Sparkles,
  CheckCircle,
  TrendingUp,
  AlertCircle,
  CheckSquare,
  Square,
  RefreshCw,
  Lightbulb,
  BellRing,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Star,
  Activity,
  UserCheck,
  Brain,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardProps {
  profile: StudentProfile;
  attendance: AttendanceRecord[];
  payments: PaymentRecord[];
  grades: GradeRecord[];
  exams: Exam[];
  onNavigate: (tab: string) => void;
}

const MOTIVATIONAL_QUOTES = [
  { text: "التميز ليس فعلاً عشوائياً، بل هو عادة وممارسة مستمرة تصنعها أنت بنفسك.", author: "أرسطو" },
  { text: "الاستثمار الأفضل والوحيد الذي يضمن عائداً خارقاً مدى الحياة هو الاستثمار في عقلك وتطوير ذاتك.", author: "الأستاذ محمد عطية" },
  { text: "النجاح لا يأتي من التمني بل من السعي، التركيز والتراكم الصغير لكل يوم هو سر القمم الكبيرة.", author: "ابن سينا" },
  { text: "العقبات لا توقفك أبداً؛ إن واجهت جداراً، فلا تستسلم بل ابحث عن كيفية تسلقه.", author: "علي بن أبي طالب" },
  { text: "الرياضيات هي لغة الكون ومفتاح التفكير العبقري والتحليل المنطقي السليم.", author: "الأستاذ محمد عطية" },
];

export default function Dashboard({ profile, attendance, payments, grades, exams, onNavigate }: DashboardProps) {
  const availableExams = exams.filter(e => e.status === 'available');
  const outstandingPayments = payments.filter(p => p.status === 'pending');
  const lastAttendance = attendance.slice(0, 3);
  const recentGrades = grades.slice(0, 3);

  // Find the latest exam / grade record by date
  const latestGrade = [...grades].sort((a, b) => {
    const timeDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.id.localeCompare(a.id);
  })[0];

  const latestGradePercent = latestGrade 
    ? Math.round((latestGrade.score / latestGrade.maxScore) * 100) 
    : 0;

  let latestGradeSubject = latestGrade ? latestGrade.subject : "لا يوجد درجات مسجلة";
  if (latestGradeSubject.length > 25) {
    latestGradeSubject = latestGradeSubject.substring(0, 23) + '...';
  }

  // Welcome greeting time-based helper
  const [greeting, setGreeting] = useState("صباح الخير");
  useEffect(() => {
    const hours = new Date().getHours();
    if (hours < 12) {
      setGreeting("صباح الرقي والهمة");
    } else if (hours < 17) {
      setGreeting("مرحباً بك مجدداً");
    } else {
      setGreeting("مساء الهمم العالية");
    }
  }, []);

  // Quotes Carousel Index
  const [quoteIdx, setQuoteIdx] = useState(0);
  useEffect(() => {
    const quoteTimer = setInterval(() => {
      setQuoteIdx((prev) => (prev + 1) % MOTIVATIONAL_QUOTES.length);
    }, 12000);
    return () => clearInterval(quoteTimer);
  }, []);

  // Student Daily Tasks state
  const [todoTasks, setTodoTasks] = useState<{id: string, text: string, done: boolean}[]>(() => {
    const saved = localStorage.getItem('portal_todo_list');
    if (saved) {
      try { return JSON.parse(saved); } catch(e) { }
    }
    return [
      { id: '1', text: "تصفح والاطلاع على مواد الفصل الحالي ومستوى الحضور", done: true },
      { id: '2', text: "حل الاختبار التجريبي المخصص للاشتقاق والتكامل", done: false },
      { id: '3', text: "مراجعة كشف درجات الامتحان النصفي والاستحقاقات", done: false },
      { id: '4', text: "تحضير وتقديم طلب عذر معتمد إذا لزم الأمر", done: false }
    ];
  });

  useEffect(() => {
    localStorage.setItem('portal_todo_list', JSON.stringify(todoTasks));
  }, [todoTasks]);

  const toggleTodo = (id: string) => {
    setTodoTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
    playHapticTip();
  };

  const doneCount = todoTasks.filter(t => t.done).length;
  const progressPercent = Math.round((doneCount / todoTasks.length) * 105) > 100 ? 100 : Math.round((doneCount / todoTasks.length) * 100);

  // Sound chime simulator for thumb touches
  const playHapticTip = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch(e){}
  };

  return (
    <div className="space-y-6 text-right md:px-2 animate-in fade-in duration-500" id="mobile-home-dashboard">
      
      {/* 1. EMOTIONAL WELCOME + STREAK FLAME BANNER */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 dark:from-indigo-950 dark:via-slate-900 dark:to-slate-955 rounded-3xl p-6 text-white relative overflow-hidden border border-white/5 dark:border-white/5 shadow-xl shadow-indigo-950/10">
        {/* Glow orbs background decoration */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-indigo-400/20 dark:bg-indigo-505/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-purple-400/15 dark:bg-purple-505/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
              <span className="text-[10px] text-indigo-100 font-bold font-sans">بوابة سنتر الألفا التعليمية</span>
            </div>

            {/* Streak flame metric marker */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 dark:bg-white/5 border border-white/10 text-amber-300 select-none animate-pulse">
              <span className="text-[10px] font-black font-mono">D-5 STREAK</span>
              <Flame className="w-4 h-4 text-amber-300 fill-amber-300" />
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-xl md:text-2xl font-black text-white">{greeting} 🎉</h2>
            <h3 className="text-sm font-semibold text-indigo-100 mt-1">{profile.name}</h3>
            <p className="text-xs text-indigo-50 leading-relaxed font-sans mt-2">
              أهلاً بك مجدداً في عائلة سنتر الألفا! نراقب عن كثب تقدمك وحضورك لمساعدتك في بناء رحلة تعليمية استثنائية وبلوغ قمة الصدارة الرياضية والنجاح الباهر.
            </p>
          </div>

          {/* AI Advisor instant insight bubble */}
          <div className="p-3.5 bg-white/10 dark:bg-white/5 rounded-2xl border border-white/15 dark:border-white/10 flex items-start justify-between gap-3 text-right backdrop-blur-md">
            <div className="space-y-1 flex-1 pr-1">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                <span className="text-[10px] font-black text-amber-300 font-sans tracking-wide">توصيات المرشد الذكي اليوم</span>
              </div>
              <p className="text-xs text-indigo-50 leading-normal font-sans pt-0.5">
                حضورك يبلغ توازناً ممتازاً عند <strong className="text-emerald-350 font-bold">{profile.attendanceRate}%</strong>. نقترح التركيز على حل الاختبار التجريبي في <span className="underline decoration-indigo-300">الرياضيات البحتة</span> لتعزيز درجاتك للفصل الدراسي.
              </p>
            </div>
            <Lightbulb className="w-5 h-5 text-amber-300 shrink-0 mt-1" />
          </div>

        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Right Column (7-span) */}
        <div className="lg:col-span-7 space-y-6">
          {/* 2. DUAL PROGRESS RINGS BLOCK WITH PREMIUM GLASSMOPHISM & GLOW */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Habit Todo Progress Card */}
            <div className="group bg-white/80 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 p-5 rounded-3xl flex flex-col justify-between items-center text-center space-y-4 shadow-[0_4px_18px_rgba(15,23,42,0.02)] hover:shadow-[0_10px_25px_rgba(99,102,241,0.05)] hover:border-indigo-500/25 dark:hover:border-indigo-500/25 transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-indigo-500/5 to-transparent rounded-full blur-xl" />
              
              <div className="space-y-1 text-center">
                <span className="text-xs font-black text-slate-800 dark:text-zinc-100 block">أحدث علامة امتحان</span>
                 <span className="text-[10px] text-neutral-400 dark:text-slate-500 block font-sans" title={latestGrade ? latestGrade.subject : ""}>{latestGradeSubject}</span>
              </div>

              <div className="relative flex items-center justify-center">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle cx="48" cy="48" r="38" strokeWidth="6" stroke="rgba(99, 102, 241, 0.04)" fill="transparent" />
                  <circle 
                    cx="48" cy="48" r="38" strokeWidth="6" stroke="url(#indigoGrad)" 
                    strokeDasharray={2 * Math.PI * 38}
                    strokeDashoffset={2 * Math.PI * 38 * (1 - (latestGradePercent || 5) / 100)}
                    strokeLinecap="round" fill="transparent"
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="indigoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#4f46e5" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-lg font-black text-slate-800 dark:text-white font-mono">{latestGradePercent}%</span>
                  <span className="text-[9px] text-neutral-400 dark:text-slate-500 font-bold">{latestGrade ? `${latestGrade.score}/${latestGrade.maxScore}` : "0/0"}</span>
                </div>
              </div>

              <div className="w-full">
                <button 
                  onClick={() => { onNavigate('grades'); playHapticTip(); }}
                  className="w-full py-2 bg-slate-50/80 dark:bg-slate-350 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 text-indigo-650 dark:text-indigo-400 rounded-2xl text-[10px] font-black transition-all border border-slate-200/50 dark:border-slate-800 cursor-pointer active:scale-95"
                >
                  عرض كشف الدرجات 📊
                </button>
              </div>
            </div>

            {/* Attendance Ring Card */}
            <div className="group bg-white/80 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/60 p-5 rounded-3xl flex flex-col justify-between items-center text-center space-y-4 shadow-[0_4px_18px_rgba(15,23,42,0.02)] hover:shadow-[0_10px_25px_rgba(16,185,129,0.05)] hover:border-emerald-500/25 dark:hover:border-emerald-500/25 transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-full blur-xl" />
              
              <div className="space-y-1 text-center">
                <span className="text-xs font-black text-slate-800 dark:text-zinc-100 block">نسبة الالتزام</span>
                <span className="text-[10px] text-neutral-400 dark:text-slate-500 block font-sans">محاضرات الفصل الحالية</span>
              </div>

              <div className="relative flex items-center justify-center">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle cx="48" cy="48" r="38" strokeWidth="6" stroke="rgba(16, 185, 129, 0.04)" fill="transparent" />
                  <circle 
                    cx="48" cy="48" r="38" strokeWidth="6" stroke="url(#emeraldGrad)" 
                    strokeDasharray={2 * Math.PI * 38}
                    strokeDashoffset={2 * Math.PI * 38 * (1 - profile.attendanceRate / 100)}
                    strokeLinecap="round" fill="transparent"
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-lg font-black text-slate-800 dark:text-white font-mono">{profile.attendanceRate}%</span>
                  <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">نشط</span>
                </div>
              </div>

              <div className="w-full">
                <button 
                  onClick={() => { onNavigate('attendance'); playHapticTip(); }}
                  className="w-full py-2 bg-slate-50/80 dark:bg-slate-950 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-2xl text-[10px] font-black transition-all border border-slate-200/50 dark:border-slate-850 cursor-pointer active:scale-95"
                >
                  عرض السجل التفصيلي
                </button>
              </div>
            </div>
          </div>

          {/* 3. THUMB FRIENDLY QUICK ACTIONS PANEL - HIGH CONTRAST GLASS Bento Grid */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-text-muted font-sans tracking-wide pr-1">الوصول بالإبهام والتحكم السريع</h3>
            
            <div className="grid grid-cols-2 gap-3.5">
              {/* Action item A */}
              <div 
                onClick={() => { onNavigate('attendance'); playHapticTip(); }}
                className="p-4 bg-bg-card backdrop-blur-md border border-border-card rounded-2xl flex items-center gap-3 text-right cursor-pointer transition-all duration-300 shadow-[0_2px_10px_rgba(15,23,42,0.015)] hover:shadow-[0_8px_24px_rgba(99,102,241,0.032)] hover:border-indigo-400 dark:hover:border-indigo-505/30 hover:-translate-y-0.5"
              >
                <span className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-650 dark:text-indigo-400">
                  <CalendarCheck className="w-4.5 h-4.5" />
                </span>
                <div className="space-y-0.5">
                  <span className="block text-xs font-black text-text-primary">تقديم عذر طبي</span>
                  <span className="block text-[9px] text-text-muted">تحميل والتماس الغياب</span>
                </div>
              </div>

              {/* Action item B */}
              <div 
                onClick={() => { onNavigate('payments'); playHapticTip(); }}
                className="p-4 bg-bg-card backdrop-blur-md border border-border-card rounded-2xl flex items-center gap-3 text-right cursor-pointer transition-all duration-300 shadow-[0_2px_10px_rgba(15,23,42,0.015)] hover:shadow-[0_8px_24px_rgba(16,185,129,0.032)] hover:border-emerald-400 dark:hover:border-emerald-505/30 hover:-translate-y-0.5"
              >
                <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Wallet className="w-4.5 h-4.5" />
                </span>
                <div className="space-y-0.5">
                  <span className="block text-xs font-black text-text-primary">سداد رسوم 💳</span>
                  <span className="block text-[9px] text-text-muted">
                    {profile.balance > 0 ? `مستحق ${profile.balance} جم` : 'مسددة بالكامل'}
                  </span>
                </div>
              </div> 

              {/* Action item C */}
              <div 
                onClick={() => { onNavigate('exams'); playHapticTip(); }}
                className="p-4 bg-bg-card backdrop-blur-md border border-border-card rounded-2xl flex items-center gap-3 text-right cursor-pointer transition-all duration-300 shadow-[0_2px_10px_rgba(15,23,42,0.015)] hover:shadow-[0_8px_24px_rgba(245,158,11,0.032)] hover:border-amber-400 dark:hover:border-amber-505/30 hover:-translate-y-0.5"
              >
                <span className="p-2.5 rounded-xl bg-amber-500/10 text-amber-550 dark:text-amber-400">
                  <FileText className="w-4.5 h-4.5" />
                </span>
                <div className="space-y-0.5">
                  <span className="block text-xs font-black text-text-primary">المركز التقييمي</span>
                  <span className="block text-[9px] text-text-muted">
                    {availableExams.length > 0 ? `${availableExams.length} اختبار متاح` : 'لا امتحانات طارئة'}
                  </span>
                </div>
              </div>

              {/* Action item D */}
              <div 
                onClick={() => { onNavigate('ai-analysis'); playHapticTip(); }}
                className="p-4 bg-bg-card backdrop-blur-md border border-border-card rounded-2xl flex items-center gap-3 text-right cursor-pointer transition-all duration-300 shadow-[0_2px_10px_rgba(15,23,42,0.015)] hover:shadow-[0_8px_24px_rgba(139,92,246,0.032)] hover:border-purple-400 dark:hover:border-purple-505/30 hover:-translate-y-0.5"
              >
                <span className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Brain className="w-4.5 h-4.5" />
                </span>
                <div className="space-y-0.5">
                  <span className="block text-xs font-black text-text-primary">تقرير الـ AI</span>
                  <span className="block text-[9px] text-text-muted">تقرير المجهود والنجاح</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Left Column (5-span) */}
        <div className="lg:col-span-5 space-y-6">
          {/* 4. UPCOMING EXAMS LIVE TICKER CARD - LINEAR DESIGN LOOK */}
          <div className="bg-bg-card backdrop-blur-md border border-border-card p-5 rounded-3xl space-y-4 shadow-[0_4px_18px_rgba(15,23,42,0.02)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-24 h-24 bg-gradient-to-br from-indigo-500/5 to-transparent rounded-full blur-xl" />
            
            <div className="flex justify-between items-center pb-2 border-b border-gray-100/60 dark:border-slate-850/50 select-none">
              <span className="text-[10px] text-indigo-150 bg-indigo-500/10 px-2.5 py-0.5 rounded-full font-bold">عاجل ومجدول اليوم</span>
              <h3 className="text-xs font-black text-text-primary flex items-center gap-2">
                <span>الامتحانات المتاحة للإتمام</span>
                <BellRing className="w-4 h-4 text-slate-455 animate-bounce" />
              </h3>
            </div>

            {availableExams.length === 0 ? (
              <div className="py-4 text-center text-xs text-text-muted font-sans">
                🎉 روعة! لقد انتهيت من كافة اختبارات اليوم بنجاح وتقدير تم رصده.
              </div>
            ) : (
              availableExams.slice(0, 1).map((exam) => (
                <div key={exam.id} className="p-4 bg-neutral-50/65 dark:bg-slate-950/60 rounded-2xl border border-slate-200/50 dark:border-slate-850 space-y-3.5 text-right relative overflow-hidden group hover:border-indigo-500/25 transition-all duration-300 shadow-[0_2px_8px_rgba(15,23,42,0.01)]">
                  <div className="absolute top-0 right-0 w-1.5 h-full bg-amber-500 animate-pulse" />
                  
                  <div className="flex justify-between items-start gap-2">
                    <div className="text-right">
                      <span className="block text-xs font-black text-text-primary group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{exam.title}</span>
                      <span className="block text-[10px] text-text-muted mt-1 font-sans">
                        المقرر: {exam.subject} • أسئلة متعددة الخيارات ({exam.questions.length})
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-text-muted self-center shrink-0">الحد الأقصى: {exam.durationMinutes} دقيقة</span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1 text-[10px] text-text-muted font-mono">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>ينتهي قريباً</span>
                    </div>
                    
                    <button 
                      onClick={() => { onNavigate('exams'); playHapticTip(); }}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-sm shadow-indigo-500/20"
                    >
                      <span>ابدأ الاختبار الآن</span>
                      <PlayCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 5. ATTENDANCE & GRADES SUMMARY TIMELINE - NOTION STYLED PANEL */}
          <div className="bg-bg-card backdrop-blur-md border border-border-card p-5 rounded-3xl space-y-4 shadow-[0_4px_18px_rgba(15,23,42,0.02)] relative overflow-hidden">
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tr from-emerald-500/5 to-transparent rounded-full blur-xl" />
            
            <div className="flex justify-between items-center border-b border-gray-100/60 dark:border-slate-850/50 pb-2">
              <h3 className="text-xs font-black text-text-primary flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-550 animate-pulse" />
                <span>جدول الحضور والمتابعة للمحاضرات</span>
              </h3>
              <span className="text-[10px] text-text-muted select-none">أحدث 3 محاضرات حضوراً</span>
            </div>

            <div className="space-y-3">
              {lastAttendance.map((log) => (
                <div key={log.id} className="p-3.5 bg-neutral-50/60 dark:bg-slate-950/40 rounded-2xl flex items-center justify-between border border-border-card transition-all duration-200 hover:bg-neutral-100/50 dark:hover:bg-slate-900/55">
                  
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      log.status === 'present' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                      log.status === 'late' ? 'bg-amber-500 animate-pulse' :
                      log.status === 'excused' ? 'bg-indigo-500' : 'bg-rose-500'
                    }`} />
                    
                    <div className="text-right">
                      <span className="block text-xs font-black text-text-primary">{log.subject}</span>
                      <span className="block text-[9px] text-text-muted font-mono mt-0.5">{log.date} • {log.time}</span>
                    </div>
                  </div>

                  <span className={`text-[10px] font-black px-2.5 pb-0.5 pt-1 rounded-xl ${
                    log.status === 'present' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                    log.status === 'late' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                    log.status === 'excused' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-rose-500/10 text-rose-600'
                  }`}>
                    {log.status === 'present' ? 'حاضر' :
                     log.status === 'late' ? 'متأخر' :
                     log.status === 'excused' ? 'معذور' : 'غياب'}
                  </span>

                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
