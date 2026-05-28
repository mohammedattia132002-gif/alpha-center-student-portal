/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { StudentProfile, GradeRecord, AttendanceRecord } from '../types/domain';
import { 
  Sparkles, ShieldCheck, AlertTriangle, TrendingUp, TrendingDown,
  Brain, Zap, BookOpen, Clock, Calendar, CheckCircle, ArrowLeft,
  ChevronRight, Compass, RefreshCw, BarChart2, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from 'recharts';

interface AIAnalysisProps {
  profile: StudentProfile;
  grades: GradeRecord[];
  attendance: AttendanceRecord[];
  onNavigate: (tab: string) => void;
}

export default function AIAnalysis({ profile, grades, attendance, onNavigate }: AIAnalysisProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisVersion, setAnalysisVersion] = useState(1);

  // Trigger high-end calculation animation to feel like real-time AI API computation
  const triggerRecalculation = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      setAnalysisVersion(prev => prev + 1);
    }, 1800);
  };

  // Extract analytics from actual pupil data
  const totalAbsences = attendance.filter(a => a.status === 'absent').length;
  const totalLates = attendance.filter(a => a.status === 'late').length;
  
  // Calculate average scores from grades
  const midterms = grades.filter(g => g.type === 'midterm');
  const pathScores = grades.map(g => (g.score / g.maxScore) * 100);
  const averagePercentage = pathScores.length > 0 
    ? Math.round(pathScores.reduce((a, b) => a + b, 0) / pathScores.length)
    : 88;

  // Predict potential decline or risk probability
  let dropRisk = "منخفض جداً (Safe)";
  let riskColor = "text-emerald-400";
  let riskBg = "bg-emerald-500/10 border-emerald-500/20";
  let declineChance = 5; // 5%

  if (profile.attendanceRate < 80 || averagePercentage < 75) {
    dropRisk = "مرتفع (Critical Remedial Plan Needed)";
    riskColor = "text-rose-400 animate-pulse";
    riskBg = "bg-rose-500/10 border-rose-500/20";
    declineChance = 65;
  } else if (profile.attendanceRate < 90 || averagePercentage < 85) {
    dropRisk = "متوسط (Attention Required)";
    riskColor = "text-amber-400";
    riskBg = "bg-amber-500/10 border-amber-500/20";
    declineChance = 28;
  }

  // Group grades by subject for comparison charts
  const subjectChartData = grades.map(g => ({
    name: g.subject.replace('هندسة ', '').replace('مقدمة في ', ''),
    "التقدير الفعلي %": Math.round((g.score / g.maxScore) * 100),
    "المستهدف الأكاديمي %": 90,
    "حضور المحاضرات %": g.subject.includes('ذكاء') ? 95 : 88
  }));

  // Simulated Future Performance line chart data
  const forecastData = [
    { name: 'الأسبوع 1', 'معدل الفهم الحالي': 82, 'التنبؤ المستقبلي': 82 },
    { name: 'الأسبوع 2', 'معدل الفهم الحالي': 84, 'التنبؤ المستقبلي': 85 },
    { name: 'الأسبوع 3', 'معدل الفهم الحالي': 87, 'التنبؤ المستقبلي': 89 },
    { name: 'الأسبوع 4', 'معدل الفهم الحالي': averagePercentage, 'التنبؤ المستقبلي': averagePercentage },
    { name: 'الأسبوع 5 (قادم)', 'التنبؤ المستقبلي': Math.min(100, averagePercentage + 4) },
    { name: 'الأسبوع 6 (قادم)', 'التنبؤ المستقبلي': Math.min(100, averagePercentage + 7) }
  ];

  return (
    <div className="space-y-8 font-sans text-right" id="ai-performance-analyzer-dashboard">
      
      {/* 1. Header with recalculate trigger */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-indigo-500 to-indigo-600 bg-indigo-600 text-white rounded-lg shadow-sm">
            AI COGNITIVE ADVISOR
          </span>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mt-1">
            <Brain className="w-5 h-5 text-indigo-500" />
            <span>المرشد الأكاديمي الذكي (AI Performance)</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">يُحلل هذا القسم المتقدم مؤشراتك وسجلاتك التعليمية للتنبؤ بأدائك وتوفير خطط مراجعة فخمة مصممة لك.</p>
        </div>

        <button
          onClick={triggerRecalculation}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          {isAnalyzing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>جاري التحليل المعرفي...</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>إعادة تشغيل الذكاء الاصطناعي للتحليل</span>
            </>
          )}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {isAnalyzing ? (
          /* High end analytical matrix loader */
          <motion.div 
            key="loading-matrix"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-12 text-center rounded-3xl glass-panel-dark border border-indigo-500/10 space-y-4 flex flex-col items-center justify-center min-h-[300px]"
          >
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
              <Brain className="w-6 h-6 text-indigo-400 absolute animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">جاري رصد السجلات التعليمية واستقراء البيانات المستعرضة</h4>
              <p className="text-[10px] text-slate-400 max-w-sm mx-auto leading-relaxed">
                يقوم المرشد الذكي لسنتر الألفا بفحص كشوف الدرجات للاختبارات الدورية، وتراكم الغياب، ومعدل الاستحقاق وتقديم المقترحات المخصصة لك الآن...
              </p>
            </div>
          </motion.div>
        ) : (
          /* Complete Dashboard with dynamic widgets */
          <motion.div
            key={`analysis-v-${analysisVersion}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8 animate-in fade-in duration-300"
          >
            
            {/* 2. Key Cognitive Insights Bento Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              
              {/* Box 1: Student Risk Indicator */}
              <div className="p-5 bg-white/80 backdrop-blur-md dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 rounded-3xl flex flex-col justify-between hover-shadow transition-all shadow-[0_4px_18px_rgba(15,23,42,0.02)]">
                <div className="flex items-center justify-between mb-4 text-right">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">مؤشر احتمالية انخفاض المستوى</h4>
                  <span className="p-2 bg-rose-500/10 text-rose-500 rounded-xl">
                    <AlertTriangle className="w-4 h-4" />
                  </span>
                </div>

                <div className="space-y-2 text-right">
                  <span className="text-3xl font-black text-slate-800 dark:text-slate-50 block font-mono">
                    {declineChance}%
                  </span>
                  <p className="text-xs text-gray-400 dark:text-slate-400 font-sans leading-relaxed">
                    معدل احتمالية تراجع علاماتك خلال الفصول القادمة بالاعتماد على مؤشر الحضور وتجانس الاختبارات.
                  </p>
                </div>

                <div className={`mt-4 p-3 rounded-2xl border ${riskBg} flex items-center justify-between text-right`}>
                  <span className="text-[10px] text-slate-400">حالة الخطر الحالي:</span>
                  <span className={`text-[10px] font-black font-sans ${riskColor}`}>{dropRisk}</span>
                </div>
              </div>

              {/* Box 2: Weakness subject finder */}
              <div className="p-5 bg-white/80 backdrop-blur-md dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 rounded-3xl flex flex-col justify-between hover-shadow transition-all shadow-[0_4px_18px_rgba(15,23,42,0.02)]">
                <div className="flex items-center justify-between mb-4 text-right">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">أكثر المواد الأكاديمية صعوبة بالنسبة لك</h4>
                  <span className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                    <BookOpen className="w-4 h-4" />
                  </span>
                </div>

                <div className="space-y-3 text-right">
                  <span className="text-base font-black text-rose-600 dark:text-rose-400 block">
                    الرياضيات البحتة (موضوعات التكامل المحدود)
                  </span>
                  <p className="text-xs text-gray-400 dark:text-slate-400 leading-relaxed font-sans font-medium">
                    سجلت أحدث التقييمات مستوى فهم يقدر بـ <strong className="text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded font-bold font-mono">75%</strong> مقارنة مع التقدير المستهدف بالفصل.
                  </p>
                </div>

                <div className="mt-4 flex gap-2 justify-end">
                  <button 
                    onClick={() => onNavigate('exams')}
                    className="w-full text-center py-2 px-3 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100/50 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                  >
                    أداء مراجعة الاختبار الجاري لرفع الدرجة
                  </button>
                </div>
              </div>

              {/* Box 3: Attendance Consistency Evaluation */}
              <div className="p-5 bg-white/80 backdrop-blur-md dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 rounded-3xl flex flex-col justify-between hover-shadow transition-all shadow-[0_4px_18px_rgba(15,23,42,0.02)]">
                <div className="flex items-center justify-between mb-4 text-right">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">تناسق الحضور والغياب (المواظبة)</h4>
                  <span className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                    <Activity className="w-4 h-4" />
                  </span>
                </div>

                <div className="space-y-2 text-right">
                  <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 block font-mono">
                    ممتاز (A+)
                  </span>
                  <p className="text-xs text-gray-400 dark:text-slate-400 leading-relaxed font-sans">
                    نسبة حضور تبلغ {profile.attendanceRate}% مع إجمالي غياب {totalAbsences} محاضرات فقط وطالب معذور ومواظب.
                  </p>
                </div>

                <div className="mt-4 p-3 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 text-[10px] text-emerald-400 font-sans">
                  ✓ ينعكس معدل الحضور الممتاز إيجاباً على علامات التقييم العملي والشفهي.
                </div>
              </div>

            </div>

            {/* 3. Deep Performance Area Chart & Predictive Forecast */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              
              {/* Responsive comparison area charts */}
              <div className="p-6 bg-white/80 backdrop-blur-md dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 rounded-3xl shadow-[0_4px_18px_rgba(15,23,42,0.02)] text-right lg:col-span-8 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-50 dark:border-slate-850/60">
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 font-sans">تحليل الأداء الفعلي مقابل المؤشر المستهدف %</h3>
                    <p className="text-[10px] text-slate-400">مقارنة التقديرات التراكمية ومستوى المحاضرات للعام الأكاديمي 2026</p>
                  </div>
                  <BarChart2 className="w-4.5 h-4.5 text-indigo-500" />
                </div>

                <div className="h-64 w-full text-ltr text-xs font-mono" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={subjectChartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ 
                          background: '#0f172a', 
                          borderColor: '#1e293b', 
                          borderRadius: '12px',
                          color: '#fff',
                        }} 
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Bar dataKey="التقدير الفعلي %" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="المستهدف الأكاديمي %" fill="#e2e8f0" radius={[4, 4, 0, 0]} opacity={0.3} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Predictive GPA trend forecast charts */}
              <div className="p-6 bg-white/80 backdrop-blur-md dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 rounded-3xl shadow-[0_4px_18px_rgba(15,23,42,0.02)] text-right lg:col-span-4 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-50 dark:border-slate-850/60">
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 font-sans">التوقع الذكي التنبؤي للأداء</h3>
                    <p className="text-[10px] text-slate-400">توقع معدل الاستيعاب مع خطة التحسين</p>
                  </div>
                  <Compass className="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
                </div>

                <div className="h-44 w-full text-ltr text-[9px] font-mono" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={forecastData}
                      margin={{ top: 5, right: 5, left: -32, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={9} />
                      <YAxis stroke="#64748b" fontSize={9} />
                      <Tooltip contentStyle={{ background: '#0a0f1d', color: '#fff', borderRadius: '8px' }} />
                      <Area type="monotone" dataKey="التنبؤ المستقبلي" stroke="#a855f7" fillOpacity={0.15} fill="url(#colorUv)" />
                      <Area type="monotone" dataKey="معدل الفهم الحالي" stroke="#6366f1" fillOpacity={0.1} fill="url(#colorPv)" />
                      <defs>
                        <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/45 border border-indigo-100/10 rounded-2xl text-[10px] text-gray-500 dark:text-slate-300 leading-normal font-sans">
                  💡 <strong>تحليل الخبراء:</strong> بالاستمرار على وتيرة مراجعة الدروس وحل الاختبارات الأسبوعية، يتوقع قفز معدل درجاتك بنسبة <strong>7%</strong> مع نهاية الفصل.
                </div>
              </div>

            </div>

            {/* 4. Personalized AI Improvement Path Recommendations */}
            <div className="space-y-4 text-right">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200">الدليل اليومي لإرشادات وخطة تحسين الأداء:</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Rule 1: Software Architecture weak points solved */}
                <div className="p-5 bg-white/80 backdrop-blur-sm dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 rounded-3xl space-y-3 flex items-start gap-4 hover-shadow transition-all shadow-[0_2px_10px_rgba(15,23,42,0.012)]">
                  <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl shrink-0">
                    <Brain className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="space-y-1 text-right flex-1">
                    <span className="text-[10px] text-indigo-500 font-bold block">مقرر برمجيات • مراجعة الأنماط</span>
                    <h4 className="text-xs font-extrabold text-slate-800 dark:text-white">تحسين استيعاب "Patterns & Structural MVC"</h4>
                    <p className="text-[11px] text-gray-600 dark:text-slate-400 leading-relaxed font-sans pb-2">
                      تم رصد بعض الإجابات غير الموفقة في الامتحانات التجريبية السابقة حول المخططات المعمارية. نوصي بمراجعة المحاضرة الثالثة مع الديسكربشن المرفق لها.
                    </p>
                    <div className="flex gap-2 justify-end pt-1">
                      <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">
                        <Clock className="w-3.5 h-3.5" />
                        <span>تقدير القراءة: 15 دقيقة</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rule 2: Artificial Intelligence Exam Readiness */}
                <div className="p-5 bg-white/80 backdrop-blur-sm dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 rounded-3xl space-y-3 flex items-start gap-4 hover-shadow transition-all shadow-[0_2px_10px_rgba(15,23,42,0.012)]">
                  <div className="p-3 bg-teal-500/10 text-teal-500 rounded-2xl shrink-0">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 text-right flex-1">
                    <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold block">مقرر ذكاء اصطناعي • تدريب جاري</span>
                    <h4 className="text-xs font-extrabold text-slate-800 dark:text-white">الجهوزية الكاملة للامتحان الشامل</h4>
                    <p className="text-[11px] text-gray-600 dark:text-slate-400 leading-relaxed font-sans pb-2">
                      مستوى درجاتك في أسئلة (Neural Networks) ممتازة ومثالية جداً! نوصيك بالدخول وتأكيد تفعيل الاختبار الشامل النهائي لتأكيد الحصول على معدل الأمتياز.
                    </p>
                    <div className="flex gap-2 justify-end pt-1">
                      <span className="flex items-center gap-1 text-[10px] font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-lg border border-teal-500/20">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>درجة الفهم: %95</span>
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
