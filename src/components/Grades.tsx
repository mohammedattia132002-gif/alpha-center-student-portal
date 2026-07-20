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
  const [chartReady, setChartReady] = useState(false);

  // Set chart ready after short delay to prevent Recharts -1 width/height layout warning in hidden tabs
  useEffect(() => {
    const timer = setTimeout(() => setChartReady(true), 250);
    return () => clearTimeout(timer);
  }, []);

  // Trigger skeleton loading on search & category switches
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 350);
    return () => clearTimeout(timer);
  }, [searchTerm, activeCategoryFilter]);

  // Compute stats — إجمالي الدرجات المحصلة من إجمالي الدرجات الكلية عبر كل الاختبارات
  const totalEarnedScore = records.reduce((acc, r) => acc + r.score, 0);
  const totalMaxScore = records.reduce((acc, r) => acc + r.maxScore, 0);
  const overallPercent = totalMaxScore > 0 ? Math.round((totalEarnedScore / totalMaxScore) * 100) : 0;

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

  // النسبة المئوية هي مصدر الحقيقة للتقدير: حقل letter_grade يصل أحياناً
  // بالعربية من الخادم وأحياناً بحروف لاتينية من الجلسة المحلية، فلا يصلح للتصنيف.
  const getGradePercent = (grade: GradeRecord): number =>
    grade.maxScore > 0 ? Math.round((grade.score / grade.maxScore) * 100) : 0;

  const getGradeEmoji = (percent: number): string => {
    if (percent >= 85) return '🟢';
    if (percent >= 75) return '🔵';
    if (percent >= 65) return '🟠';
    if (percent >= 50) return '🟡';
    return '🔴';
  };

  const getGradeBadgeStyle = (percent: number): string => {
    if (percent >= 85) return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
    if (percent >= 75) return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
    if (percent >= 65) return 'bg-orange-500/10 border-orange-500/20 text-orange-400';
    if (percent >= 50) return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
    return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
  };

  // نفس سلم التقديرات المعتمد في الخادم (platform_result_project_grade)
  const getGradeLabel = (percent: number): string => {
    if (percent >= 85) return 'امتياز';
    if (percent >= 75) return 'جيد جداً';
    if (percent >= 65) return 'جيد';
    if (percent >= 50) return 'مقبول';
    return 'ضعيف';
  };

  const getExamModeLabel = (grade: GradeRecord) =>
    grade.examMode === 'electronic' ? 'إلكتروني' : 'ورقي / يدوي';

  const getExamModeStyle = (grade: GradeRecord) =>
    grade.examMode === 'electronic'
      ? 'bg-sky-500/10 text-sky-300 border-sky-500/15'
      : 'bg-amber-500/10 text-amber-300 border-amber-500/15';

  const playInteractionTap = () => playPortalTap(700);

  return (
    <div className="space-y-6 lg:space-y-8 text-right md:px-2 animate-in fade-in duration-550" id="mobile-grades-portal">
      
      {/* 1. GPA METRICS BANNER */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-955 text-white rounded-[28px] p-6 relative overflow-hidden shadow-lg border border-white/5 space-y-5">
        
        {/* Glow background orbs */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-505/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-emerald-505/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold text-indigo-100 mt-1">كشف درجات المسيرة الأكاديمية</h3>
          <span className="text-[10px] font-black text-rose-300 bg-rose-500/15 border border-rose-500/10 px-2.5 py-0.5 rounded-full select-none">المجموع الكلي المعتمد</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="text-right">
            <span className="text-3xl md:text-4xl font-black font-mono text-emerald-300 block pb-1" dir="ltr">
              {records.length > 0 ? `${totalEarnedScore} / ${totalMaxScore}` : '—'}
            </span>
            <span className="text-[10px] text-indigo-100 font-sans block leading-none">
              {records.length > 0
                ? `عدد الاختبارات المسجلة: ${records.length} • نسبة التحصيل الإجمالية: ${overallPercent}%`
                : 'لا توجد درجات بعد'}
            </span>
          </div>
        </div>

      </div>

      {/* 2.5 STUDENT PERFORMANCE TREND OVER TIME (SINGLE SUBJECT) */}
      <div className="bg-slate-900/40 border border-slate-850/60 p-5 rounded-3xl shadow-[0_4px_18px_rgba(15,23,42,0.02)] space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-br from-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-amber-505/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex justify-between items-center pb-2 border-b border-slate-850/50 select-none">
          <div className="text-right">
            <h3 className="text-xs font-black text-zinc-150 flex items-center gap-1.5 font-sans">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              <span>تطور الأداء عبر الامتحانات</span>
            </h3>
            <p className="text-[10px] text-slate-300 mt-0.5">نسبة التحصيل في كل اختبار مرتبة زمنياً</p>
          </div>
          <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-2.5 py-0.5 rounded-full">نسبة التحصيل</span>
        </div>

        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center select-none">
            <span className="text-3xl mb-3">📈</span>
            <p className="text-xs font-bold text-slate-300">لا توجد نتائج كافية لعرض الرسم البياني</p>
            <p className="text-[10px] text-slate-300 mt-1">سيظهر تطور مستواك بعد تسجيل نتائج الامتحانات</p>
          </div>
        ) : (
          <div className="h-64 w-full text-ltr text-xs font-mono relative" dir="ltr">
            {chartReady ? (
              <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                <AreaChart
                  data={(() => {
                    const sorted = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    return sorted.map((grade, idx) => ({
                      name: `اختبار ${idx + 1}`,
                      date: grade.date,
                      "نسبة التحصيل %": getGradePercent(grade),
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
                    formatter={(value: number, _name, props: any) => [
                      `${props?.payload?.score ?? ''} / ${props?.payload?.maxScore ?? ''} (${value}%)`,
                      'النتيجة',
                    ]}
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
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-slate-900/10 rounded-2xl animate-pulse">
                <TrendingUp className="w-8 h-8 text-indigo-400 animate-bounce" />
                <span className="text-[11px] text-slate-400 font-sans">جاري رسم المخطط البياني...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. SEARCH BAR & SPECIFIC GRADE FILTERS */}
      <div className="bg-slate-900/40 border border-slate-850/60 p-4.5 rounded-3xl space-y-3.5 shadow-[0_4px_18px_rgba(15,23,42,0.02)] relative overflow-hidden">
        <div className="absolute -top-6 left-1/4 w-24 h-24 bg-rose-505/5 rounded-full blur-2xl pointer-events-none" />
        <div className="relative">
          <input 
            type="text"
            placeholder="بحث في سجل الاختبارات..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs p-3 pr-10 text-right bg-slate-950 border border-slate-850 rounded-2xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-100 transition-all font-sans"
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
                  : 'bg-slate-950 text-zinc-300 hover:bg-slate-850/60'
              }`}
            >
              {cat.title}
            </button>
          ))}
        </div>
      </div>

      {/* 4. NOTION RECORD CARDS FOR COURSES */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-slate-300 font-sans tracking-wide pr-1">تفاصيل ومجاميع درجات الفصل الدراسي</h3>

        <AnimatePresence mode="popLayout">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl animate-pulse flex justify-between">
                <div className="w-14 h-5 bg-slate-800 rounded-lg animate-pulse" />
                <div className="space-y-2 flex-1 text-right flex flex-col pr-4">
                  <div className="w-1/3 h-4 bg-slate-800 rounded-lg animate-pulse" />
                  <div className="w-1/4 h-3 bg-slate-800 rounded-lg animate-pulse" />
                </div>
              </div>
            ))
          ) : filteredGrades.length === 0 ? (
            <div className="p-8 text-center rounded-2.5xl bg-slate-900/40 border border-slate-850 select-none font-sans text-xs text-slate-300">
              لا توجد درجات مرصودة مطابقة لفلترة البحث. 📋
            </div>
          ) : (
            filteredGrades.map((grade) => {
              const gradePercent = getGradePercent(grade);
              return (
              <motion.div
                key={grade.id}
                layoutId={`grade-card-log-${grade.id}`}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="p-4.5 bg-slate-900/40 border border-slate-850/60 rounded-[20px] shadow-[0_2px_10px_rgba(15,23,42,0.012)] relative overflow-hidden hover:border-indigo-505/30 transition-all flex flex-col gap-3 text-right group"
              >
                {/* Visual score marker */}
                <div className={`absolute right-0 top-0 bottom-0 w-1 rounded-full ${grade.passed ? 'bg-emerald-500' : 'bg-rose-500'}`} />

                <div className="flex justify-between items-start">
                  <div className="text-right">
                    <h4 className="text-xs font-black text-zinc-150 group-hover:text-indigo-400 transition-colors">امتحان يوم {formatArabicDate(grade.date)}</h4>
                    <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
                      <span className="text-[10px] text-neutral-400 font-sans">{grade.subjectCode} • {formatArabicDate(grade.date)}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${getExamModeStyle(grade)}`}>
                        {getExamModeLabel(grade)}
                      </span>
                    </div>
                  </div>

                  {/* Grade badge */}
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-sans border shrink-0 ${getGradeBadgeStyle(gradePercent)}`}>
                    {getGradeEmoji(gradePercent)}
                    {getGradeLabel(gradePercent)}
                  </span>
                </div>

                {/* الدرجة المحصلة من الدرجة الكلية */}
                <div className="flex items-center justify-between gap-3 p-3 bg-slate-950/60 rounded-2xl border border-slate-850/60">
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 block font-sans">الدرجة المحصلة من الدرجة الكلية</span>
                    <span className="font-mono font-black text-white block mt-0.5" dir="ltr">
                      <span className="text-xl text-emerald-400">{grade.score}</span>
                      <span className="text-sm text-slate-400"> / {grade.maxScore}</span>
                    </span>
                  </div>
                  <div className="text-left shrink-0">
                    <span className="text-[9px] text-slate-400 block font-sans">النسبة المئوية</span>
                    <span className={`text-lg font-black font-mono block mt-0.5 ${gradePercent >= 50 ? 'text-indigo-400' : 'text-rose-400'}`}>{gradePercent}%</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${grade.passed ? 'bg-indigo-600' : 'bg-rose-500'}`}
                      style={{ width: `${Math.min(gradePercent, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Trainer guidance block comments */}
                {grade.feedback && (
                  <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-900/40 text-[10px] text-slate-300 font-sans leading-normal">
                    {grade.feedback}
                  </div>
                )}

              </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
