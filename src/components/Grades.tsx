/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { GradeRecord, Exam } from '../types';
import { 
  Award, TrendingUp, Sparkles, BookOpen, Search, ArrowUpRight, 
  HelpCircle, ChevronRight, Share2, Compass, Sliders, ChevronDown, 
  Settings, AwardIcon, Bookmark, Info, ChevronUp, RefreshCw, X, PlayCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area, AreaChart } from 'recharts';
import { playPortalTap } from '../lib/audioFeedback';
import { formatArabicDate } from '../utils/arabicFormat';

interface GradesProps {
  records: GradeRecord[];
  exams: Exam[];
}

export default function Grades({ records, exams }: GradesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | 'exam' | 'final' | 'project'>('all');
  const [isLoading, setIsLoading] = useState(false);

  // Trigger skeleton loading on search & category switches
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 350);
    return () => clearTimeout(timer);
  }, [searchTerm, activeCategoryFilter]);

  // Compute stats
  const totalWeightPoints = records.reduce((acc, r) => acc + (r.gpaWeight || 0), 0);
  const averageGPA = records.length > 0 ? (totalWeightPoints / records.length).toFixed(2) : "—";

  const questionCountByExam = useMemo(() => {
    const map: Record<string, number> = {};
    exams.forEach((exam) => {
      map[exam.id] = exam.questionsCount;
    });
    return map;
  }, [exams]);

  // Filter records
  const filteredGrades = records.filter(grade => {
    const matchesSearch = grade.subjectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          grade.subjectCode.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesCategory = false;
    if (activeCategoryFilter === 'all') {
      matchesCategory = true;
    } else if (activeCategoryFilter === 'final') {
      matchesCategory = grade.category === 'final';
    } else if (activeCategoryFilter === 'exam') {
      // Matches other categories like 'midterm', 'practical', 'assignments', or 'exam'
      matchesCategory = grade.category !== 'final';
    }
    return matchesSearch && matchesCategory;
  });

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

  const getGradeEmoji = (letter: string): string => {
    if (letter.startsWith('A')) return '🟢';
    if (letter.startsWith('B')) return '🔵';
    if (letter.startsWith('C')) return '🟠';
    if (letter.startsWith('D')) return '🟡';
    return '🔴';
  };

  const getGradeBadgeStyle = (letter: string): string => {
    if (letter.startsWith('A')) return 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400';
    if (letter.startsWith('B')) return 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400';
    if (letter.startsWith('C')) return 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20 text-orange-600 dark:text-orange-400';
    if (letter.startsWith('D')) return 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400';
    return 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400';
  };

  const getGradeLabel = (letter: string): string => {
    if (letter.startsWith('A')) return 'ممتاز';
    if (letter.startsWith('B')) return 'جيد جداً';
    if (letter.startsWith('C')) return 'جيد';
    if (letter.startsWith('D')) return 'مقبول';
    return 'ضعيف';
  };

  const getExamModeLabel = (grade: GradeRecord) =>
    grade.examMode === 'electronic' ? 'إلكتروني' : 'ورقي / يدوي';

  const getExamModeStyle = (grade: GradeRecord) =>
    grade.examMode === 'electronic'
      ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/15'
      : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/15';

  const playInteractionTap = () => playPortalTap(700);

  return (
    <div className="space-y-6 lg:space-y-8 text-right md:px-2 animate-in fade-in duration-550" id="mobile-grades-portal">
      
      {/* 1. GPA METRICS BANNER */}
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
            <span className="text-[10px] text-indigo-100 font-sans block leading-none">{records.length > 0 ? `عدد الاختبارات المسجلة: ${records.length}` : 'لا توجد درجات بعد'}</span>
          </div>
        </div>

      </div>

      {/* 2.5 STUDENT PERFORMANCE TREND OVER TIME (SINGLE SUBJECT) */}
      <div className="bg-white/80 backdrop-blur-md dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 p-5 rounded-3xl shadow-[0_4px_18px_rgba(15,23,42,0.02)] space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-br from-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-amber-500/5 dark:bg-amber-505/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex justify-between items-center pb-2 border-b border-gray-100/60 dark:border-slate-850/50 select-none">
          <div className="text-right">
            <h3 className="text-xs font-black text-slate-800 dark:text-zinc-150 flex items-center gap-1.5 font-sans">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              <span>تطور الأداء عبر الامتحانات</span>
            </h3>
            <p className="text-[10px] text-neutral-450 dark:text-slate-300 mt-0.5">نسبة التحصيل في كل اختبار مرتبة زمنياً</p>
          </div>
          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-500/10 px-2.5 py-0.5 rounded-full">نسبة التحصيل</span>
        </div>

        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center select-none">
            <span className="text-3xl mb-3">📈</span>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-300">لا توجد نتائج كافية لعرض الرسم البياني</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-300 mt-1">سيظهر تطور مستواك بعد تسجيل نتائج الامتحانات</p>
          </div>
        ) : (
          <div className="h-64 w-full text-ltr text-xs font-mono" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={(() => {
                  const sorted = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                  return sorted.map((grade, idx) => ({
                    name: `اختبار ${idx + 1}`,
                    date: grade.date,
                    "نسبة التحصيل %": Math.round((grade.score / grade.maxScore) * 100),
                    score: grade.score,
                    maxScore: grade.maxScore,
                  }));
                })()}
                margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.08)" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} domain={[0, 100]} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#fff',
                    textAlign: 'center',
                    fontFamily: 'sans-serif',
                    fontSize: '11px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
                  }}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) return `${label} — ${payload[0].payload.date}`;
                    return label;
                  }}
                  formatter={(value: number) => [`${value}%`, 'النتيجة']}
                />
                <Area
                  type="monotone"
                  dataKey="نسبة التحصيل %"
                  stroke="#818cf8"
                  strokeWidth={2.5}
                  fill="url(#trendGrad)"
                  dot={{ r: 5, fill: '#818cf8', stroke: '#1e293b', strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: '#818cf8', stroke: '#fff', strokeWidth: 2 }}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 3. SEARCH BAR & SPECIFIC GRADE FILTERS */}
      <div className="bg-white/80 backdrop-blur-md dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 p-4.5 rounded-3xl space-y-3.5 shadow-[0_4px_18px_rgba(15,23,42,0.02)] relative overflow-hidden">
        <div className="absolute -top-6 left-1/4 w-24 h-24 bg-rose-500/5 dark:bg-rose-505/5 rounded-full blur-2xl pointer-events-none" />
        <div className="relative">
          <input 
            type="text"
            placeholder="بحث في سجل الاختبارات..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs p-3 pr-10 text-right bg-neutral-50 dark:bg-slate-950 border border-neutral-200/50 dark:border-slate-850 rounded-2xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 transition-all font-sans"
          />
          <Search className="w-4 h-4 text-neutral-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Category categories list */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none justify-start select-none">
          {[
            { tag: 'all', title: 'كل الاختبارات' },
            { tag: 'final', title: 'الاختبارات النهائية' },
            { tag: 'exam', title: 'الاختبارات الدورية' }
          ].map((cat) => (
            <button
              key={cat.tag}
              onClick={() => { setActiveCategoryFilter(cat.tag as any); playInteractionTap(); }}
              className={`px-3.5 py-1.5 rounded-xl font-bold font-sans text-[10px] shrink-0 cursor-pointer transition-all ${
                activeCategoryFilter === cat.tag 
                  ? 'bg-indigo-600 text-white font-extrabold shadow-sm shadow-indigo-500/10' 
                  : 'bg-neutral-50 dark:bg-slate-950 text-neutral-450 dark:text-zinc-300 hover:bg-neutral-200 dark:hover:bg-slate-850/60'
              }`}
            >
              {cat.title}
            </button>
          ))}
        </div>
      </div>

      {/* 4. NOTION RECORD CARDS FOR COURSES */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-gray-400 dark:text-slate-300 font-sans tracking-wide pr-1">تفاصيل ومجاميع درجات الفصل الدراسي</h3>

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
            <div className="p-8 text-center rounded-2.5xl bg-white/80 backdrop-blur-sm dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850 select-none font-sans text-xs text-neutral-450 dark:text-slate-300">
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
                    <h4 className="text-xs font-black text-slate-800 dark:text-zinc-150 group-hover:text-indigo-650 dark:group-hover:text-indigo-400 transition-colors">امتحان يوم {formatArabicDate(grade.date)}</h4>
                    <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
                      <span className="text-[10px] text-neutral-400 font-sans">{grade.subjectCode} • {formatArabicDate(grade.date)}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${getExamModeStyle(grade)}`}>
                        {getExamModeLabel(grade)}
                      </span>
                    </div>
                  </div>

                  {/* Grade badge */}
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-sans border shrink-0 ${getGradeBadgeStyle(grade.gradeLetter)}`}>
                    {getGradeEmoji(grade.gradeLetter)}
                    {getGradeLabel(grade.gradeLetter)}
                  </span>
                </div>

                {/* Score slider metrics */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-300 font-sans">
                    <span>العلامة المحصلة: <strong className="text-slate-800 dark:text-white font-mono font-black">{grade.score}</strong> / {grade.maxScore}</span>
                    <span>الوزن الأكاديمي: {grade.gpaWeight} pts</span>
                  </div>

                  <div className="w-full h-1.5 bg-neutral-200/50 dark:bg-slate-950 rounded-full overflow-hidden p-0.5">
                    <div 
                      className="h-full bg-indigo-600 rounded-full transition-all duration-1000" 
                      style={{ width: `${(grade.score / grade.maxScore) * 100}%` }} 
                    />
                  </div>
                </div>

                {/* Trainer guidance block comments */}
                <div className="p-3 bg-neutral-100/50 dark:bg-slate-950/50 rounded-xl border border-neutral-200/30 dark:border-slate-900/40 text-[10px] text-gray-600 dark:text-slate-300 font-sans leading-normal">
                  {grade.feedback}
                </div>

              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
