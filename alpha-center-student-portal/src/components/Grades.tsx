/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GradeRecord } from '../types/domain';
import { 
  Award, TrendingUp, Sparkles, BookOpen, Search, ArrowUpRight, 
  HelpCircle, ChevronRight, Share2, Compass, Sliders, ChevronDown, 
  Settings, AwardIcon, Bookmark, Info, ChevronUp, RefreshCw, X, PlayCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, BarChart, Bar, Cell 
} from 'recharts';

interface GradesProps {
  records: GradeRecord[];
}

export default function Grades({ records }: GradesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | 'exam' | 'final' | 'project'>('all');
  const [isLoading, setIsLoading] = useState(false);
  
  // Interactive GPA simulation state
  const [showGPAPredictor, setShowGPAPredictor] = useState(false);
  const [predictiveSoftwareGrad, setPredictiveSoftwareGrad] = useState<number>(4.0); // A
  const [predictiveAIGrad, setPredictiveAIGrad] = useState<number>(3.3); // B+
  const [predictiveSecurityGrad, setPredictiveSecurityGrad] = useState<number>(4.0); // A

  // Trigger simulated skeleton loading on search & category switches
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 350);
    return () => clearTimeout(timer);
  }, [searchTerm, activeCategoryFilter]);

  // Compute stats
  const totalWeightPoints = records.reduce((acc, r) => acc + (r.percentage || 0), 0);
  const averageGPA = records.length > 0 ? (totalWeightPoints / records.length).toFixed(2) : "3.81";

  // Filter records
  const filteredGrades = records.filter(grade => {
    const matchesSearch = (grade.subject || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (grade.subjectCode || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesCategory = false;
    if (activeCategoryFilter === 'all') {
      matchesCategory = true;
    } else if (activeCategoryFilter === 'final') {
      matchesCategory = grade.type === 'final';
    } else if (activeCategoryFilter === 'exam') {
      matchesCategory = grade.type !== 'final';
    }
    return matchesSearch && matchesCategory;
  });

  // Calculate simulated GPA projects
  const simulatedGPA = ((predictiveSoftwareGrad + predictiveAIGrad + predictiveSecurityGrad + 3.7) / 4).toFixed(2);

  const getLetterBadgeStyle = (letter: string) => {
    if (letter.startsWith('A')) {
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-550/15';
    } else if (letter.startsWith('B')) {
      return 'bg-indigo-505/10 text-indigo-650 dark:text-indigo-400 border-indigo-500/15';
    } else if (letter.startsWith('C')) {
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/15';
    } else {
      return 'bg-rose-500/10 text-rose-600 dark:text-rose-450 border-rose-500/15';
    }
  };

  const getAchievements = () => [
    { title: "صدارة فرسان الألفا للرياضيات 🚀", desc: "الحصول على درجة امتياز A+ في الاختبار التراكمي الشامل وعلم التفاضل والتكامل." },
    { title: "فارس الألفة والمنطق الرياضي 🧠", desc: "الحصول على معدل يفوق الـ 95% في مسائل الجبر الخطي والمحددات والمصفوفات الفراغية." },
    { title: "سجل الانضباط الحديدي 📋", desc: "الالتزام التام بنسبة حضور فوق الـ 95% دون غيابات غير معذورة بسجلات سنتر الألفا." }
  ];

  // Sound chime Tap
  const playInteractionTap = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(700, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch(err){}
  };

  // Performance over semesters charts data Recharts
  const semesterTrendData = [
    { semester: 'فصل خريف 24', GPA: 3.40 },
    { semester: 'فصل ربيع 25', GPA: 3.65 },
    { semester: 'فصل صيف 25', GPA: 3.80 },
    { semester: 'الفصل الحالي 26', GPA: Number(averageGPA) || 3.81 }
  ];

  return (
    <div className="space-y-6 text-right md:px-2 animate-in fade-in duration-550" id="mobile-grades-portal">
      
      {/* 1. GPA METRICS BANNER WITH COMPACT RECHARTS SPARK-LINE */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-955 text-white rounded-[28px] p-6 relative overflow-hidden shadow-lg border border-white/5 dark:border-white/5 space-y-5">
        
        {/* Glow background orbs */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/15 dark:bg-indigo-505/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-emerald-500/10 dark:bg-emerald-505/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold text-indigo-100 mt-1">كشف درجات المسيرة الأكاديمية</h3>
          <span className="text-[10px] font-black text-rose-300 bg-rose-500/15 border border-rose-500/10 px-2.5 py-0.5 rounded-full select-none">المعدل التراكمي المعتمد</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="text-right">
            <span className="text-3xl md:text-4xl font-black font-mono text-emerald-300 block pb-1">{averageGPA} <strong className="text-xs font-sans text-indigo-200">/ 4.00</strong></span>
            <span className="text-[10px] text-indigo-100 font-sans block leading-none">مجموع الساعات المرصودة: {records.length * 3} ساعة معتمدة</span>
          </div>

          <div className="px-3 py-1 bg-white/10 dark:bg-white/5 border border-white/10 rounded-2xl select-none flex flex-col items-center">
            <span className="text-[9px] text-indigo-100">التقدير العام</span>
            <span className="text-base font-black text-amber-300 font-sans">امتياز مرتفع</span>
          </div>
        </div>

        {/* Recharts minimal spark-line for performance index over semesters */}
        <div className="pt-2 border-t border-white/5">
          <span className="text-[9px] text-slate-400 block pb-1.5 text-right font-sans">مؤشر التقدم في المعدل التراكمي (Semesters GPA Trend):</span>
          
          <div className="h-28 w-full text-ltr text-xs font-mono" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={semesterTrendData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="semester" stroke="#94a3b8" fontSize={9} />
                <YAxis stroke="#94a3b8" fontSize={9} domain={[3.0, 4.0]} />
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }} />
                <Line type="monotone" dataKey="GPA" stroke="#34d399" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Open GPA Simulator button banner */}
        <button 
          onClick={() => { setShowGPAPredictor(true); playInteractionTap(); }}
          className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-550/10 cursor-pointer transition-all active:scale-98"
        >
          <span>تطبيق محاكاة التنبؤ بالمعدل التراكمي النظري</span>
          <ArrowUpRight className="w-4 h-4" />
        </button>

      </div>

      {/* 2. ACHIEVEMENT BADGES SCROLL TIERS */}
      <div className="bg-white/80 backdrop-blur-md dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 p-5 rounded-3xl shadow-[0_4px_18px_rgba(15,23,42,0.02)] space-y-3 relative overflow-hidden">
        
        <div className="flex justify-between items-center pb-2 border-b border-gray-100/60 dark:border-slate-850/50 select-none">
          <h3 className="text-xs font-black text-slate-800 dark:text-zinc-150 flex items-center gap-1.5 font-sans">
            <Award className="w-4 h-4 text-[#818cf8] animate-bounce" />
            <span>قاعة الأوسمة والإنجازات الأكاديمية</span>
          </h3>
          <span className="text-[10px] text-indigo-650 dark:text-indigo-400 font-bold bg-indigo-500/10 px-2.5 py-0.5 rounded-full">أوسمة فخرية</span>
        </div>

        {/* Scrollable achievements bento slider */}
        <div className="flex gap-3.5 overflow-x-auto pb-1.5 scrollbar-none justify-start select-none">
          {getAchievements().map((ach, ix) => (
            <div key={ix} className="p-3.5 bg-neutral-50 dark:bg-slate-950 rounded-2xl border border-neutral-150 dark:border-slate-850 w-60 shrink-0 text-right space-y-1 hover:border-indigo-450 dark:hover:border-indigo-505/20 transition-all">
              <span className="block text-xs font-black text-slate-800 dark:text-white">{ach.title}</span>
              <p className="text-[10px] text-neutral-450 dark:text-slate-500 leading-normal font-sans pr-1">{ach.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 2.5 CORE SUBJECT GRADE PERFORMANCE INDEX (BAR CHART) */}
      <div className="bg-white/80 backdrop-blur-md dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 p-5 rounded-3xl shadow-[0_4px_18px_rgba(15,23,42,0.02)] space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-gray-100/60 dark:border-slate-850/50 select-none">
          <div className="text-right">
            <h3 className="text-xs font-black text-slate-800 dark:text-zinc-150 flex items-center gap-1.5 font-sans">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              <span>مخطط تحصيل الدرجات المئوية للمقررات بـ سنتر الألفا</span>
            </h3>
            <p className="text-[10px] text-neutral-450 dark:text-slate-500 mt-0.5">مقارنة وتوزيع نسب الأداء الأكاديمي الحقيقي عبر كافة المواد</p>
          </div>
          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-500/10 px-2.5 py-0.5 rounded-full">نسبة التحصيل</span>
        </div>

        <div className="h-64 w-full text-ltr text-xs font-mono" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={records.map((grade) => {
                let displayName = grade.subject;
                if (displayName.length > 25) {
                  displayName = displayName.substring(0, 23) + '...';
                }
                return {
                  name: displayName,
                  "التحصيل المقارن %": Math.round((grade.score / grade.maxScore) * 100),
                  "الدرجة": grade.score,
                  "الدرجة العظمى": grade.maxScore,
                };
              })} 
              margin={{ top: 15, right: 10, left: -25, bottom: 5 }}
            >
              <defs>
                <linearGradient id="gradesBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.35} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.08)" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={9} domain={[0, 100]} tickLine={false} />
              <Tooltip 
                cursor={{ fill: 'rgba(99, 102, 241, 0.04)' }}
                contentStyle={{ 
                  background: '#1e293b', 
                  border: 'none', 
                  borderRadius: '16px', 
                  color: '#fff',
                  textAlign: 'right',
                  fontFamily: 'sans-serif',
                  fontSize: '11px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
                }} 
              />
              <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ fontSize: '10px', fontFamily: 'sans-serif' }} />
              <Bar 
                dataKey="التحصيل المقارن %" 
                fill="url(#gradesBarGrad)" 
                radius={[8, 8, 0, 0]} 
                maxBarSize={40}
              >
                {records.map((entry, index) => {
                  const percent = (entry.score / entry.maxScore) * 100;
                  // Dynamic colors for cell items based on high performance
                  let barColor = "url(#gradesBarGrad)";
                  if (percent < 60) {
                    barColor = "rgba(239, 68, 68, 0.75)"; // Warning Red
                  } else if (percent >= 90) {
                    barColor = "rgba(52, 211, 153, 0.75)"; // Excellent Mint Green
                  }
                  return <Cell key={`cell-${index}`} fill={barColor} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. SEARCH BAR & SPECIFIC GRADE FILTERS */}
      <div className="bg-white/80 backdrop-blur-md dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 p-4.5 rounded-3xl space-y-3.5 shadow-[0_4px_18px_rgba(15,23,42,0.02)]">
        <div className="relative">
          <input 
            type="text"
            placeholder="البحث باسم المادة أو الكود الرقمي..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs p-3 pr-10 text-right bg-neutral-50 dark:bg-slate-950 border border-neutral-200/50 dark:border-slate-850 rounded-2xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 transition-all font-sans"
          />
          <Search className="w-4 h-4 text-neutral-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Category categories list */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none justify-start select-none">
          {[
            { tag: 'all', title: 'كافة المواد والامتحانات' },
            { tag: 'final', title: 'الأختبارات النهائية' },
            { tag: 'exam', title: 'الاختبارات الدورية والانشطة' }
          ].map((cat) => (
            <button
              key={cat.tag}
              onClick={() => { setActiveCategoryFilter(cat.tag as any); playInteractionTap(); }}
              className={`px-3.5 py-1.5 rounded-xl font-bold font-sans text-[10px] shrink-0 cursor-pointer transition-all ${
                activeCategoryFilter === cat.tag 
                  ? 'bg-indigo-600 text-white font-extrabold shadow-sm shadow-indigo-500/10' 
                  : 'bg-neutral-50 dark:bg-slate-950 text-neutral-450 dark:text-zinc-400 hover:bg-neutral-200 dark:hover:bg-slate-850/60'
              }`}
            >
              {cat.title}
            </button>
          ))}
        </div>
      </div>

      {/* 4. NOTION RECORD CARDS FOR COURSES */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-gray-400 dark:text-slate-500 font-sans tracking-wide pr-1">تفاصيل ومجاميع درجات الفصل الدراسي</h3>

        <AnimatePresence mode="popLayout">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 bg-white/80 backdrop-blur-sm dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850 rounded-2xl animate-pulse flex justify-between">
                <div className="w-14 h-5 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                <div className="space-y-2 flex-1 text-right flex flex-col pr-4">
                  <div className="w-1/3 h-4 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                  <div className="w-1/4 h-3 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                </div>
              </div>
            ))
          ) : filteredGrades.length === 0 ? (
            <div className="p-8 text-center rounded-2.5xl bg-white/80 backdrop-blur-sm dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850 select-none font-sans text-xs text-neutral-450 dark:text-slate-500">
              لا توجد درجات مرصودة مطابقة لفلترة البحث. 📋
            </div>
          ) : (
            filteredGrades.map((grade) => (
              <motion.div
                key={grade.id}
                layoutId={`grade-card-log-${grade.id}`}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="p-4.5 bg-white/80 backdrop-blur-sm dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 rounded-[20px] shadow-[0_2px_10px_rgba(15,23,42,0.012)] relative overflow-hidden hover:border-indigo-400 dark:hover:border-indigo-505/30 transition-all flex flex-col gap-3 text-right group"
              >
                {/* Visual score marker */}
                <div className="absolute right-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-full" />

                <div className="flex justify-between items-start">
                  <div className="text-right">
                    <h4 className="text-xs font-black text-slate-800 dark:text-zinc-150 group-hover:text-indigo-650 dark:group-hover:text-indigo-400 transition-colors">{grade.subject}</h4>
                    <span className="text-[10px] text-neutral-400 block mt-1 font-sans font-mono">{grade.subjectCode || grade.id} • كشف: {grade.date}</span>
                  </div>

                  <span className={`w-11 h-11 rounded-xl font-sans font-black text-base flex items-center justify-center border shrink-0 shadow-sm ${getLetterBadgeStyle(grade.letterGrade || '')}`}>
                    {grade.letterGrade}
                  </span>
                </div>

                {/* Score slider metrics */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-500 font-sans">
                    <span>العلامة المحصلة: <strong className="text-slate-800 dark:text-white font-mono font-black">{grade.score} / {grade.maxScore}</strong></span>
                    <span>الوزن الأكاديمي: {grade.percentage} pts</span>
                  </div>

                  <div className="w-full h-1.5 bg-neutral-200/50 dark:bg-slate-950 rounded-full overflow-hidden p-0.5">
                    <div 
                      className="h-full bg-indigo-600 rounded-full transition-all duration-1000" 
                      style={{ width: `${(grade.score / grade.maxScore) * 100}%` }} 
                    />
                  </div>
                </div>

                {/* Trainer guidance block comments */}
                <div className="p-3 bg-neutral-100/50 dark:bg-slate-950/50 rounded-xl border border-neutral-200/30 dark:border-slate-900/40 text-[10px] text-gray-600 dark:text-slate-400 font-sans leading-normal">
                  {grade.notes || "قامت شؤون الطلاب بطلب مراجعة العلامات والأهم هنا التقدم الأكاديمي في أمن وإدارة البرمجيات للفصل."}
                </div>

              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* 5. INTERACTIVE GPA PREDICTOR SHEET */}
      <AnimatePresence>
        {showGPAPredictor && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowGPAPredictor(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs" 
            />

            <motion.div 
              initial={{ y: '100%' }} 
              animate={{ y: 0 }} 
              exit={{ y: '100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-white dark:bg-slate-900 rounded-t-[32px] border-t border-white/10 p-5.5 z-10 w-full space-y-4 max-h-[85%] overflow-y-auto font-sans text-right select-none"
              dir="rtl"
            >
              <div className="w-12 h-1 bg-gray-300 dark:bg-neutral-800 rounded-full mx-auto" />

              <div className="flex items-center justify-between border-b border-gray-100/60 dark:border-slate-850/50 pb-3">
                <div className="text-right">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white">تطبيق محاكاة التقديرات والمعدل</h3>
                  <p className="text-[10px] text-neutral-450 block mt-0.5">توقع مستقبلك الأكاديمي وصمم خطة تفوقك</p>
                </div>
                <button 
                  onClick={() => setShowGPAPredictor(false)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-neutral-450 cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Dynamic Simulated GPA Gauge */}
              <div className="p-4.5 bg-slate-950 text-white rounded-[20px] text-center border border-white/5 space-y-1 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-505/15 rounded-full blur-2xl" />
                
                <span className="block text-[10px] text-indigo-300 font-bold">المعدل المشروع المحاكي</span>
                <span className="text-3xl font-black text-emerald-400 font-mono block">{simulatedGPA} <span className="text-xs text-slate-300 leading-none">/ 4.00</span></span>
                <span className="text-[9px] text-zinc-400 leading-none block pt-1.5">التقدير المتوقع: {Number(simulatedGPA) >= 3.6 ? 'امتياز مع مرتبة الشرف 🌟' : 'جيد جداً مرتفع'}</span>
              </div>

              <div className="space-y-4 pr-1">
                <span className="text-[11px] font-black text-gray-400 block pb-1 border-b border-gray-100 dark:border-slate-850">قم بتغيير التقدير المفترض لكل مادة:</span>

                {/* Item 1: SE */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-gray-800 dark:text-zinc-200">الرياضيات البحتة (MATH-301):</span>
                    <span className="font-mono text-indigo-505 font-black">
                      {predictiveSoftwareGrad === 4.0 ? 'امتياز A (4.0)' :
                       predictiveSoftwareGrad === 3.3 ? 'جيد جداً مرتفع B+ (3.3)' :
                       predictiveSoftwareGrad === 3.0 ? 'جيد جداً B (3.0)' : 'مقبول C (2.0)'}
                    </span>
                  </div>
                  <input 
                    type="range" min="2.0" max="4.0" step="0.1"
                    value={predictiveSoftwareGrad}
                    onChange={(e) => { setPredictiveSoftwareGrad(Number(e.target.value)); playInteractionTap(); }}
                    className="w-full h-1.5 bg-neutral-100 dark:bg-slate-950 rounded-full appearance-none cursor-pointer"
                  />
                </div>

                {/* Item 2: AI */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-gray-800 dark:text-zinc-200">الجبر والهندسة الفراغية (ALG-301):</span>
                    <span className="font-mono text-indigo-505 font-black">
                      {predictiveAIGrad === 4.0 ? 'امتياز A (4.0)' :
                       predictiveAIGrad === 3.3 ? 'جيد جداً مرتفع B+ (3.3)' :
                       predictiveAIGrad === 3.0 ? 'جيد جداً B (3.0)' : 'مقبول C (2.0)'}
                    </span>
                  </div>
                  <input 
                    type="range" min="2.0" max="4.0" step="0.1"
                    value={predictiveAIGrad}
                    onChange={(e) => { setPredictiveAIGrad(Number(e.target.value)); playInteractionTap(); }}
                    className="w-full h-1.5 bg-neutral-100 dark:bg-slate-950 rounded-full appearance-none cursor-pointer"
                  />
                </div>

                {/* Item 3: Cyber Security */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-gray-800 dark:text-zinc-200">الديناميكا والاستاتيكا (الألفا):</span>
                    <span className="font-mono text-indigo-505 font-black">
                      {predictiveSecurityGrad === 4.0 ? 'امتياز A (4.0)' :
                       predictiveSecurityGrad === 3.3 ? 'جيد جداً مرتفع B+ (3.3)' :
                       predictiveSecurityGrad === 3.0 ? 'جيد جداً B (3.0)' : 'مقبول C (2.0)'}
                    </span>
                  </div>
                  <input 
                    type="range" min="2.0" max="4.0" step="0.1"
                    value={predictiveSecurityGrad}
                    onChange={(e) => { setPredictiveSecurityGrad(Number(e.target.value)); playInteractionTap(); }}
                    className="w-full h-1.5 bg-neutral-100 dark:bg-slate-950 rounded-full appearance-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-3">
                <button 
                  onClick={() => setShowGPAPredictor(false)}
                  className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-slate-850 text-neutral-700 dark:text-neutral-300 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
                >
                  حفظ المحاكاة وإغلاق النافذة
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
