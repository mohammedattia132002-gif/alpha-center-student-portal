/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Exam, ExamQuestion, ExamAttempt, GradeRecord } from '../types/domain';
import { 
  FileText, Clock, FileWarning, CheckCircle, AlertTriangle, 
  ChevronRight, ChevronLeft, Award, HelpCircle, Check, X, ShieldAlert,
  Sparkles, Maximize2, Shield, AlertCircle, RefreshCw, Star, ArrowLeft, Zap, Info, PlayCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ExamTakerProps {
  exams: Exam[];
  onAddGrade: (newGrade: GradeRecord) => void;
}

const playPortalChime = (type: 'success' | 'click' | 'warning' | 'fail' | 'transition') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
      osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } else if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(750, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'transition') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'warning') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(130, ctx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } else if (type === 'fail') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(280, ctx.currentTime);
      osc.frequency.setValueAtTime(200, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    }
  } catch (err) {}
};

interface Confetti {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  delay: number;
}

export default function ExamTaker({ exams, onAddGrade }: ExamTakerProps) {
  const [activeSession, setActiveSession] = useState<{
    exam: Exam;
    answers: Record<string, string>;
    currentQuestionIndex: number;
    timeLeftSeconds: number;
    tabFocusWarnings: number;
    started: boolean;
  } | null>(null);

  const [selectedExamForInstructions, setSelectedExamForInstructions] = useState<Exam | null>(null);
  const [hasAgreedToTerms, setHasAgreedToTerms] = useState(false);
  const [completedAttempt, setCompletedAttempt] = useState<ExamAttempt | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [confettis, setConfettis] = useState<Confetti[]>([]);

  // Focus violation tracking
  useEffect(() => {
    if (!activeSession || !activeSession.started) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        playPortalChime('warning');
        setActiveSession(prev => {
          if (!prev) return null;
          const updatedWarnings = prev.tabFocusWarnings + 1;
          
          if (updatedWarnings >= 3) {
            setTimeout(() => {
              handleSubmitAttempt(true);
            }, 500);
          }
          return {
            ...prev,
            tabFocusWarnings: updatedWarnings
          };
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeSession]);

  // Countdown timer clock
  useEffect(() => {
    if (!activeSession || !activeSession.started) return;

    const timer = setInterval(() => {
      setActiveSession(prev => {
        if (!prev) return null;
        if (prev.timeLeftSeconds <= 1) {
          clearInterval(timer);
          playPortalChime('fail');
          setTimeout(() => {
            handleSubmitAttempt(true);
          }, 300);
          return { ...prev, timeLeftSeconds: 0 };
        }
        return {
          ...prev,
          timeLeftSeconds: prev.timeLeftSeconds - 1
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeSession]);

  const formatTimeS = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartExam = (exam: Exam) => {
    playPortalChime('success');
    setActiveSession({
      exam,
      answers: {},
      currentQuestionIndex: 0,
      timeLeftSeconds: exam.durationMinutes * 60,
      tabFocusWarnings: 0,
      started: true
    });
    setSelectedExamForInstructions(null);
    setHasAgreedToTerms(false);
    setCompletedAttempt(null);
    setIsFocusMode(true);
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    if (!activeSession) return;
    playPortalChime('click');
    setActiveSession({
      ...activeSession,
      answers: {
        ...activeSession.answers,
        [questionId]: optionId
      }
    });
  };

  const navigateQuestion = (index: number) => {
    if (!activeSession) return;
    playPortalChime('transition');
    setActiveSession({
      ...activeSession,
      currentQuestionIndex: index
    });
  };

  const handleSubmitAttempt = (forcedByWarnings = false) => {
    if (!activeSession) return;
    
    if (!forcedByWarnings) {
      const answeredCount = Object.keys(activeSession.answers).length;
      const totalCount = activeSession.exam.questions.length;
      if (answeredCount < totalCount) {
        if (!window.confirm(`تنبيه: لقد أجبت على ${answeredCount} من أصل ${totalCount} أسئلة.\nهل ترغب بالتأكيد في تسليم ورقة الإجابات الكلية الآن؟`)) return;
      } else {
        if (!window.confirm("تأكيد إرسال الورقة وحفظ الأرشيف مباشرة؟")) return;
      }
    }

    const currentSession = activeSession;
    const exam = currentSession.exam;
    
    let earnedPoints = 0;
    exam.questions.forEach((q) => {
      const chosenOpt = currentSession.answers[q.id];
      if (chosenOpt && chosenOpt === q.correctOptionId) {
        earnedPoints += q.points;
      }
    });

    const scorePct = (earnedPoints / exam.totalPoints) * 100;
    const isPassing = scorePct >= exam.passingScorePercent;

    if (isPassing) {
      playPortalChime('success');
      const colors = ['#818cf8', '#c084fc', '#34d399', '#f43f5e', '#fbbf24', '#22d3ee'];
      const p: Confetti[] = Array.from({ length: 45 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: -10 - Math.random() * 20,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 5 + Math.random() * 7,
        delay: Math.random() * 0.7
      }));
      setConfettis(p);
    } else {
      playPortalChime('fail');
    }

    let letter = 'F';
    let gpaW = 0.0;
    if (scorePct >= 95) { letter = 'A+'; gpaW = 4.0; }
    else if (scorePct >= 90) { letter = 'A'; gpaW = 4.0; }
    else if (scorePct >= 85) { letter = 'B+'; gpaW = 3.3; }
    else if (scorePct >= 80) { letter = 'B'; gpaW = 3.0; }
    else if (scorePct >= 75) { letter = 'C+'; gpaW = 2.3; }
    else if (scorePct >= 70) { letter = 'C'; gpaW = 2.0; }
    else if (scorePct >= 60) { letter = 'D'; gpaW = 1.0; }

    const attempt: ExamAttempt = {
      id: `att-${Date.now()}`,
      examId: exam.id,
      examTitle: exam.title,
      subject: exam.subject,
      score: earnedPoints,
      maxScore: exam.totalPoints,
      percentage: scorePct,
      passed: isPassing,
      takenAt: new Date().toISOString().split('T')[0],
      answers: currentSession.answers
    };

    setCompletedAttempt(attempt);

    const gradeRec: GradeRecord = {
      id: `grd-${Date.now()}`,
      subjectCode: exam.id === 'ex-301' ? 'SE-302' : 'AI-301',
      subject: exam.subject,
      type: 'final',
      score: earnedPoints,
      maxScore: exam.totalPoints,
      letterGrade: letter,
      date: attempt.takenAt,
      notes: `تم اجتياز الاختبار الرقمي المعزز وتوثيق العلامة بنسبة بلغت ${scorePct.toFixed(0)}%.`,
      percentage: gpaW,
      passed: isPassing
    };

    onAddGrade(gradeRec);
    setActiveSession(null);
    setIsFocusMode(false);
  };

  return (
    <div className="space-y-6 text-right" id="mobile-exam-experience">
      
      {/* Visual Confetti overlay rendering */}
      {confettis.length > 0 && (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
          {confettis.map((p) => (
            <motion.div
              key={p.id}
              initial={{ x: `${p.x}%`, y: `${p.y}vh`, rotate: 0, opacity: 1 }}
              animate={{ 
                y: '100vh', 
                rotate: 360 * 3,
                opacity: [1, 1, 0.6, 0]
              }}
              transition={{ 
                duration: 2.5 + Math.random() * 1.5, 
                delay: p.delay,
                ease: 'linear'
              }}
              className="absolute rounded-full"
              style={{
                width: p.size,
                height: p.size,
                backgroundColor: p.color
              }}
            />
          ))}
        </div>
      )}

      {/* CONDITIONAL RENDER SWITCH */}
      {!activeSession ? (
        
        /* VIEW A: CHOOSE TEST HUB */
        <div className="space-y-5">
          
          <div className="bg-white/80 backdrop-blur-md dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 p-4.5 rounded-3xl shadow-[0_4px_18px_rgba(15,23,42,0.02)] space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-50 dark:border-slate-850/60 select-none">
              <span className="text-[9px] font-mono text-indigo-650 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">امتحانات اليوم</span>
              <h3 className="text-xs font-black text-slate-800 dark:text-zinc-200">المركز التقييمي والامتحانات</h3>
            </div>

            <p className="text-xs text-neutral-455 dark:text-slate-400 leading-relaxed font-sans">
              تم إدراج الاختبارات المجدولة لك لليوم. يرجى أخذها في بيئة هادئة ومستقلة، يراقب معيار الذكاء الاصطناعي مغادرة تبويت المتصفح لضمان أمان الامتحان.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-black text-gray-500 select-none font-sans tracking-wide">الامتحانات المجدولة لمسيرتك الأكاديمية</h3>

            {exams.map((exam) => (
              <div 
                key={exam.id}
                className="p-4 bg-white/80 backdrop-blur-sm dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 rounded-2.5xl relative overflow-hidden flex flex-col gap-3.5 shadow-[0_2px_10px_rgba(15,23,42,0.012)] hover:shadow-[0_6px_20px_rgba(15,23,42,0.025)] hover:border-indigo-400 dark:hover:border-indigo-505/30 transition-all duration-300"
              >
                <div className="flex justify-between items-start">
                  <div className="text-right">
                    <h4 className="text-xs font-black text-slate-800 dark:text-white">{exam.title}</h4>
                    <span className="text-[9px] text-zinc-400 block mt-0.5 font-sans font-mono">{exam.subject} • كود {exam.id === 'ex-301' ? 'SE-302' : 'AI-301'}</span>
                  </div>

                  <span className={`text-[9px] font-black px-2 pb-0.5 pt-1 rounded-lg border ${
                    exam.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/10'
                      : 'bg-amber-500/10 text-amber-600 border-amber-500/10 animate-pulse'
                  }`}>
                    {exam.status === 'completed' ? 'تم الحل والرصد' : 'متاح للحل فوراً'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs font-mono text-zinc-400 pt-2 border-t border-dashed border-neutral-200/50 dark:border-slate-850">
                  <span>الأسئلة: {exam.questions.length} • {exam.totalPoints} نقطة</span>
                  
                  {exam.status === 'available' ? (
                    <button
                      onClick={() => { setSelectedExamForInstructions(exam); playPortalChime('click'); }}
                      className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-2xl text-[10px]"
                    >
                      دخول الاختبار 📝
                    </button>
                  ) : (
                    <span className="text-[10px] text-emerald-505 font-bold flex items-center gap-1.5 font-sans">
                      <CheckCircle className="w-3.5 h-3.5" />
                      الدرجة مسجلة
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* COMPACT COMPLETED ATTEMPT STATS VIEW */}
          {completedAttempt && (
            <div className="p-4.5 bg-gradient-to-tr from-emerald-500/5 via-teal-900/10 to-transparent border border-emerald-500/20 rounded-3xl space-y-3.5">
              <div className="flex items-center gap-2 text-right">
                <Award className="w-5 h-5 text-emerald-500 animate-bounce" />
                <div className="text-right">
                  <h4 className="text-xs font-black text-emerald-600">اكتمل التقييم وصدرت نتيجتك الرقمية!</h4>
                  <span className="text-[9px] text-zinc-400 font-mono block">التاريخ المعزز: {completedAttempt.takenAt}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 text-center font-mono">
                <div className="p-2.5 bg-neutral-50 dark:bg-slate-950 rounded-2xl border border-neutral-100/10">
                  <span className="text-[8px] text-zinc-400 block font-sans">مجموع النقاط المحصلة</span>
                  <span className="text-base font-black text-slate-800 dark:text-zinc-150">{completedAttempt.score} / {completedAttempt.maxScore}</span>
                </div>
                <div className="p-2.5 bg-neutral-50 dark:bg-slate-950 rounded-2xl border border-neutral-100/10">
                  <span className="text-[8px] text-zinc-400 block font-sans">النسبة المئوية المحصلة</span>
                  <span className="text-base font-black text-indigo-505">{completedAttempt.percentage.toFixed(0)}%</span>
                </div>
              </div>

              <div className="flex gap-2">
                <span className={`w-full py-2 rounded-2xl text-[10px] text-center font-bold ${
                  completedAttempt.passed 
                    ? 'bg-emerald-555/10 text-emerald-500' 
                    : 'bg-rose-500/10 text-rose-500'
                }`}>
                  {completedAttempt.passed ? '✓ مؤهل وحاصل على شهادة اجتياز' : '☒ غير مجتاز - بانتظار إفادة التظلم'}
                </span>
              </div>
            </div>
          )}

        </div>

      ) : (

        /* VIEW B: ACTIVE KINETIC FOCUS TEST MODE FRAME */
        <div className="space-y-5" id="active-exam-fullscreen-container">
          
          {/* A. STICKY TOP TICKING COUNTDOWN GLASS NOTIFICATION HEADER */}
          <div className="sticky top-[78px] z-30 p-4.5 bg-rose-950 text-white rounded-3xl border border-rose-500/10 shadow-lg flex items-center justify-between text-right select-none">
            <div className="flex items-center gap-2.5 text-right">
              <span className="p-2 bg-rose-500/20 rounded-xl text-rose-400 animate-pulse">
                <Clock className="w-4.5 h-4.5 animate-spin" />
              </span>
              <div className="text-right">
                <span className="text-[9px] text-rose-350 block font-sans leading-none">مؤقت كشف التسليم التلقائي</span>
                <span className="text-lg font-black font-mono block mt-1 tracking-widest">{formatTimeS(activeSession.timeLeftSeconds)}</span>
              </div>
            </div>

            <div className="text-left shrink-0">
              <span className="text-[9px] text-rose-350 block font-sans select-none">مخالفات محاذاة التبويب</span>
              <span className="text-xs font-black block mt-0.5 text-amber-400">{activeSession.tabFocusWarnings} / 3 إنذارات</span>
            </div>
          </div>

          {/* B. PROGRESS TRACKER LINE */}
          <div className="space-y-1.5 py-1">
            <div className="flex justify-between items-center text-[10px] text-neutral-400 font-sans">
              <span>السؤال التالي: {activeSession.currentQuestionIndex + 1} من أصل {activeSession.exam.questions.length}</span>
              <span>معدل الحفظ والتقدم: المجموع {Object.keys(activeSession.answers).length} حلول</span>
            </div>

            <div className="w-full h-2 bg-neutral-100 dark:bg-slate-900 rounded-full overflow-hidden border border-neutral-200/10">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 rounded-full" 
                style={{ width: `${((activeSession.currentQuestionIndex + 1) / activeSession.exam.questions.length) * 100}%` }} 
              />
            </div>
          </div>

          {/* C. SLIDING QUESTION PANE CONTAINER (Framer Motion sliding transitions!) */}
          <div className="bg-white dark:bg-slate-900 border border-neutral-150/60 dark:border-slate-850 p-5 rounded-3xl space-y-4 shadow-xs">
            
            {/* Question description */}
            <div className="space-y-1.5">
              <span className="text-[9px] text-indigo-550 dark:text-indigo-400 font-extrabold uppercase font-sans tracking-wide block">QUESTION BODY</span>
              <h2 className="text-xs font-bold leading-relaxed text-slate-800 dark:text-zinc-100">
                {activeSession.exam.questions[activeSession.currentQuestionIndex].text}
              </h2>
            </div>

            {/* Matrix of Large Touch choices targets (easy thumb touches!) */}
            <div className="space-y-2.5 pt-2">
              {activeSession.exam.questions[activeSession.currentQuestionIndex].options.map((opt) => {
                const isSelected = activeSession.answers[activeSession.exam.questions[activeSession.currentQuestionIndex].id] === opt.id;
                
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectOption(activeSession.exam.questions[activeSession.currentQuestionIndex].id, opt.id)}
                    className={`w-full p-4 rounded-2xl text-right flex items-center justify-between gap-3 cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-indigo-600 text-white font-extrabold scale-[1.01] shadow-md border-indigo-700' 
                        : 'bg-neutral-50 dark:bg-slate-950 hover:bg-neutral-100 dark:hover:bg-slate-850 text-neutral-650 dark:text-zinc-300 border border-neutral-200/50 dark:border-slate-850'
                    }`}
                  >
                    <span className={`w-5.5 h-5.5 rounded-full border flex items-center justify-center text-[10px] shrink-0 ${
                      isSelected ? 'bg-white text-indigo-650 border-white' : 'border-neutral-300 dark:border-slate-800'
                    }`}>
                      {opt.id.toUpperCase()}
                    </span>

                    <span className="text-[11px] font-sans leading-relaxed text-right flex-1 select-none pr-1">
                      {opt.text}
                    </span>
                  </button>
                );
              })}
            </div>

          </div>

          {/* D. LOWER TOUCH CONTROLS */}
          <div className="flex gap-3 pt-1">
            {activeSession.currentQuestionIndex > 0 ? (
              <button
                onClick={() => navigateQuestion(activeSession.currentQuestionIndex - 1)}
                className="px-4 py-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-slate-850 text-neutral-700 dark:text-neutral-300 font-bold rounded-2xl text-xs flex items-center gap-1 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
                <span>السابق</span>
              </button>
            ) : <div />}

            {activeSession.currentQuestionIndex < activeSession.exam.questions.length - 1 ? (
              <button
                onClick={() => navigateQuestion(activeSession.currentQuestionIndex + 1)}
                className="flex-1 py-3 bg-indigo-650 hover:bg-indigo-700 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-1 cursor-pointer shadow-xs"
              >
                <span>السؤال التالي</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => handleSubmitAttempt(false)}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/10"
              >
                <Check className="w-4.5 h-4.5" />
                <span>تسليم ورقة الإجابة والإنهاء</span>
              </button>
            )}
          </div>

        </div>
      )}

      {/* 5. PHYSICAL INSTRUCTIONS OVERLAY SHEET */}
      <AnimatePresence>
        {selectedExamForInstructions && (
          <div className="absolute inset-0 z-50 flex flex-col justify-end">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setSelectedExamForInstructions(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs" 
            />

            <motion.div 
              initial={{ y: '100%' }} 
              animate={{ y: 0 }} 
              exit={{ y: '100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-white dark:bg-slate-900 rounded-t-[32px] border-t border-white/10 p-5 z-10 w-full space-y-4 max-h-[85%] overflow-y-auto font-sans text-right select-none"
            >
              <div className="w-12 h-1 bg-gray-300 dark:bg-neutral-800 rounded-full mx-auto" />

              <div className="flex items-center justify-between border-b border-gray-50 dark:border-slate-850/60 pb-3">
                <div className="text-right">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white">تفاصيل وإرشادات الامتحان</h3>
                  <p className="text-[9px] text-neutral-450 block mt-0.5">اقرأ الشروط للموافقة والمتابعة للأرشفة</p>
                </div>
                <button 
                  onClick={() => setSelectedExamForInstructions(null)}
                  className="p-1.5 hover:bg-neutral-100 dark:hover:bg-slate-850 rounded-full text-neutral-450"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs text-neutral-650 pr-1 leading-relaxed">
                <div className="flex justify-between text-right">
                  <span className="text-neutral-450">موضوع الامتحان:</span>
                  <span className="font-bold text-gray-800 dark:text-zinc-200">{selectedExamForInstructions.title}</span>
                </div>
                <div className="flex justify-between text-right">
                  <span className="text-neutral-450">المدة الزمنية:</span>
                  <span className="font-bold text-gray-800 dark:text-zinc-200 font-mono">{selectedExamForInstructions.durationMinutes} دقيقة</span>
                </div>
                <div className="flex justify-between text-right">
                  <span className="text-neutral-450">مجموع الأسئلة:</span>
                  <span className="font-bold text-gray-800 dark:text-zinc-200 font-mono">{selectedExamForInstructions.questions.length} أسئلة اختبارية</span>
                </div>

                <div className="p-3 bg-amber-500/5 text-amber-600 rounded-2xl border border-amber-500/20 text-[10px] flex items-start gap-2">
                  <FileWarning className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                  <p className="flex-1 text-right">
                    <strong>شروط الأمان الرقمي:</strong> يُحظر مغادرة الشاشة أو تبديل التبويب أثناء التقييم الفعلي. مغادرة تبويب الامتحان 3 مرات تؤدي إلى الإغلاق التلقائي لورقة الإجابة ورصد العلامة الحالية مباشرة دون تظلم.
                  </p>
                </div>

                {/* Checked Agreement Checklist */}
                <button
                  type="button"
                  onClick={() => { setHasAgreedToTerms(!hasAgreedToTerms); playPortalChime('click'); }}
                  className="w-full p-2.5 rounded-xl hover:bg-neutral-50 dark:hover:bg-slate-850 transition-all flex items-center justify-between gap-2 border border-neutral-200/50"
                >
                  <span className="text-[10px] font-bold text-gray-800 dark:text-zinc-300">أوافق على كافة الشروط الأكاديمية وأبدأ المحاولة مستعداً.</span>
                  <span className={`w-5 h-5 rounded-md border flex items-center justify-center text-xs shrink-0 cursor-pointer ${
                    hasAgreedToTerms ? 'bg-indigo-650 text-white border-indigo-600' : 'border-neutral-300'
                  }`}>
                    {hasAgreedToTerms ? '✓' : ''}
                  </span>
                </button>
              </div>

              {/* Enter triggers */}
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  disabled={!hasAgreedToTerms}
                  onClick={() => handleStartExam(selectedExamForInstructions)}
                  className={`flex-1 py-3 text-white font-black rounded-2xl text-xs transition-colors shadow-xs ${
                    hasAgreedToTerms 
                      ? 'bg-indigo-650 hover:bg-slate-900 cursor-pointer' 
                      : 'bg-zinc-300 cursor-not-allowed opacity-56'
                  }`}
                >
                  تأكيد والبدء الآن 📝
                </button>
                <button 
                  type="button"
                  onClick={() => setSelectedExamForInstructions(null)}
                  className="px-4 py-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-slate-850 text-neutral-700 dark:text-neutral-300 font-bold rounded-2xl text-xs"
                >
                  إلغاء البند
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
