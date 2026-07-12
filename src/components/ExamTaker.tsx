﻿/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Exam, ExamQuestion, ExamAttempt, GradeRecord, StudentProfile } from '../types';
import { 
  FileText, Clock, FileWarning, CheckCircle, AlertTriangle, 
  ChevronRight, ChevronLeft, Award, HelpCircle, Check, X, ShieldAlert,
  Sparkles, Maximize2, Shield, AlertCircle, RefreshCw, Star, ArrowLeft, Zap, Info, PlayCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dbAdapter, isSupabaseConfigured } from '../supabaseClient';
import { useAccessibleDialog } from '../hooks/useAccessibleDialog';
import { playPortalExamTone as playPortalChime } from '../lib/audioFeedback';

interface ExamTakerProps {
  exams: Exam[];
  currentStudent: StudentProfile;
  onAddGrade: (newGrade: GradeRecord) => void;
}

interface Confetti {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  delay: number;
}

const isNumericQuestion = (question: ExamQuestion): boolean =>
  question.questionType === 'numeric' || question.options.length === 0;

const isGeneratedPdfQuestionText = (text: string | undefined): boolean =>
  /^Question page \d+$/i.test(String(text || '').trim());

export default function ExamTaker({ exams, currentStudent, onAddGrade }: ExamTakerProps) {
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
  const getExamCode = (exam: Exam) => exam.code || String(exam.id).slice(0, 8).toUpperCase();
  const closeExamInstructions = () => setSelectedExamForInstructions(null);
  const examInstructionsDialogRef = useAccessibleDialog<HTMLDivElement>(
    Boolean(selectedExamForInstructions),
    closeExamInstructions,
  );

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

  const timerAnnouncement = activeSession
    ? activeSession.timeLeftSeconds <= 10
      ? `متبقي ${activeSession.timeLeftSeconds} ثوانٍ على إنهاء الامتحان.`
      : activeSession.timeLeftSeconds === 30
        ? 'متبقي ثلاثون ثانية على إنهاء الامتحان.'
        : activeSession.timeLeftSeconds % 60 === 0
          ? `متبقي ${Math.floor(activeSession.timeLeftSeconds / 60)} دقيقة على إنهاء الامتحان.`
          : ''
    : '';

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

  const handleAnswerChange = (questionId: string, answerValue: string) => {
    playPortalChime('click');
    setActiveSession((prev) => prev ? ({
      ...prev,
      answers: {
        ...prev.answers,
        [questionId]: answerValue
      }
    }) : prev);
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    handleAnswerChange(questionId, optionId);
  };

  const navigateQuestion = (index: number) => {
    if (!activeSession) return;
    playPortalChime('transition');
    setActiveSession({
      ...activeSession,
      currentQuestionIndex: index
    });
  };

  const handleSubmitAttempt = async (forcedByWarnings = false) => {
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
    
    if (!isSupabaseConfigured()) {
      window.alert('تعذر حفظ نتيجة الامتحان لأن الاتصال بقاعدة البيانات غير مهيأ.');
      return;
    }

    const studentVerificationPhone = currentStudent.studentPhone || currentStudent.parentPhone || '';
    if (!studentVerificationPhone) {
      window.alert('يرجى تسجيل الخروج ثم تسجيل الدخول مرة أخرى قبل تسليم الامتحان.');
      return;
    }

    const saveResult = await dbAdapter.insertExamResult({
      examId: exam.id,
      studentId: currentStudent.id,
      studentCode: currentStudent.studentCode,
      studentPhone: studentVerificationPhone,
      tenantId: exam.tenantId,
      answers: currentSession.answers,
    });

    if (!saveResult.success || !saveResult.result) {
      console.error('Error saving exam result:', saveResult.error);
      window.alert('تعذر حفظ نتيجة الامتحان في المنصة. يرجى التأكد من الاتصال ثم إعادة المحاولة.');
      return;
    }

    const earnedPoints = saveResult.result.score;
    const maxScore = saveResult.result.maxScore || exam.totalPoints;
    const scorePct = saveResult.result.percentage;
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
      maxScore,
      percentage: scorePct,
      passed: isPassing,
      takenAt: saveResult.result.assessmentDate.split('T')[0],
      answers: currentSession.answers
    };

    const gradeRec: GradeRecord = {
      id: `grd-${Date.now()}`,
      subjectCode: getExamCode(exam),
      subjectName: exam.subject,
      category: 'final',
      score: earnedPoints,
      maxScore,
      gradeLetter: letter,
      date: attempt.takenAt,
      feedback: `تم اجتياز الاختبار الرقمي المعزز وتوثيق العلامة بنسبة بلغت ${scorePct.toFixed(0)}%.`,
      gpaWeight: gpaW,
      passed: isPassing,
      sourceExamId: exam.id
    };

    setCompletedAttempt(attempt);
    onAddGrade(gradeRec);
    setActiveSession(null);
    setIsFocusMode(false);
  };

  const currentQuestion = activeSession?.exam.questions[activeSession.currentQuestionIndex] ?? null;
  const currentAnswer = currentQuestion && activeSession ? activeSession.answers[currentQuestion.id] || '' : '';

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
              <h3 className="text-xs font-black text-gray-950 dark:text-zinc-200">المركز التقييمي والامتحانات</h3>
            </div>

            <p className="text-xs text-neutral-455 dark:text-slate-300 leading-relaxed font-sans">
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
                    <h4 className="text-xs font-black text-gray-900 dark:text-white">{exam.title}</h4>
                    <span className="text-[9px] text-zinc-400 block mt-0.5 font-sans font-mono">{exam.subject} • كود {getExamCode(exam)}</span>
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
                      aria-haspopup="dialog"
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
                  <span className="text-base font-black text-gray-900 dark:text-zinc-150">{completedAttempt.score} / {completedAttempt.maxScore}</span>
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
            <div className="sr-only" aria-live="polite" aria-atomic="true">{timerAnnouncement}</div>
            <div className="flex items-center gap-2.5 text-right">
              <span className="p-2 bg-rose-500/20 rounded-xl text-rose-400 animate-pulse">
                <Clock className="w-4.5 h-4.5 animate-spin" />
              </span>
              <div className="text-right" role="timer" aria-label={`الوقت المتبقي ${formatTimeS(activeSession.timeLeftSeconds)}`}>
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
              {currentQuestion?.imageUrl && (
                <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-neutral-50 dark:border-slate-800 dark:bg-slate-950">
                  <img
                    src={currentQuestion.imageUrl}
                    alt={`صورة السؤال ${currentQuestion.pageNumber || activeSession.currentQuestionIndex + 1}`}
                    className="block w-full max-h-[62vh] object-contain bg-white dark:bg-slate-950"
                    draggable={false}
                  />
                </div>
              )}
              {currentQuestion?.text && (!currentQuestion.imageUrl || !isGeneratedPdfQuestionText(currentQuestion.text)) && (
                <h2 className="text-xs font-bold leading-relaxed text-gray-900 dark:text-zinc-100">
                  {currentQuestion.text}
                </h2>
              )}
            </div>

            {/* Matrix of Large Touch choices targets (easy thumb touches!) */}
            {currentQuestion && isNumericQuestion(currentQuestion) && (
              <label className="block space-y-2.5 pt-2">
                <span className="block text-[10px] font-black text-neutral-500 dark:text-zinc-300">
                  أدخل إجابتك الرقمية
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={currentAnswer}
                  onChange={(event) => handleAnswerChange(currentQuestion.id, event.target.value)}
                  className="w-full rounded-2xl border border-neutral-200/70 bg-neutral-50 px-4 py-4 text-right text-sm font-black text-neutral-800 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-zinc-100"
                  placeholder="12.5"
                  autoComplete="off"
                />
              </label>
            )}
            <div className="space-y-2.5 pt-2" role="radiogroup" aria-label={`خيارات السؤال ${activeSession.currentQuestionIndex + 1}`}>
              {(currentQuestion?.options || []).map((opt) => {
                const isSelected = currentAnswer === opt.id;
                
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => currentQuestion && handleSelectOption(currentQuestion.id, opt.id)}
                    role="radio"
                    aria-checked={isSelected}
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
              onClick={closeExamInstructions}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs" 
              aria-hidden="true"
            />

            <motion.div 
              ref={examInstructionsDialogRef}
              initial={{ y: '100%' }} 
              animate={{ y: 0 }} 
              exit={{ y: '100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-white dark:bg-slate-900 rounded-t-[32px] border-t border-white/10 p-5 z-10 w-full space-y-4 max-h-[85%] overflow-y-auto font-sans text-right select-none"
              role="dialog"
              aria-modal="true"
              aria-labelledby="exam-instructions-title"
              aria-describedby="exam-instructions-description"
              tabIndex={-1}
            >
              <div className="w-12 h-1 bg-gray-300 dark:bg-neutral-800 rounded-full mx-auto" />

              <div className="flex items-center justify-between border-b border-gray-50 dark:border-slate-850/60 pb-3">
                <div className="text-right">
                  <h3 id="exam-instructions-title" className="text-sm font-black text-gray-900 dark:text-white">تفاصيل وإرشادات الامتحان</h3>
                  <p id="exam-instructions-description" className="text-[9px] text-neutral-450 block mt-0.5">اقرأ الشروط للموافقة والمتابعة للأرشفة</p>
                </div>
                <button 
                  type="button"
                  onClick={closeExamInstructions}
                  className="p-1.5 hover:bg-neutral-100 dark:hover:bg-slate-850 rounded-full text-neutral-450"
                  aria-label="إغلاق تعليمات الامتحان"
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
                  onClick={closeExamInstructions}
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
