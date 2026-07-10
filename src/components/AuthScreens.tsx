/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { loginStudent, submitJoinRequest, fetchActiveGroups, PortalGroupOption } from '../lib/workersApi';
import { ArrowRight, CheckCircle2, AlertCircle, Sparkles, Phone, User, BookOpen, Layers, Users, Wifi } from 'lucide-react';
import { StudentProfile, CenterConfig } from '../types';

interface AuthScreensProps {
  onLoginSuccess: (student: StudentProfile) => void;
  centerConfig: CenterConfig;
}

const getInitialAuthView = (): 'login' | 'join' => (
  window.location.hash === '#join-request' ? 'join' : 'login'
);

// Stage → grade cascade, matching the desktop app's `gradesByStage` map so the
// grade dropdown updates whenever the stage changes.
const GRADES_BY_STAGE: Record<string, string[]> = {
  'المرحلة الابتدائية': [
    'الصف الأول الابتدائي',
    'الصف الثاني الابتدائي',
    'الصف الثالث الابتدائي',
    'الصف الرابع الابتدائي',
    'الصف الخامس الابتدائي',
    'الصف السادس الابتدائي',
  ],
  'المرحلة الإعدادية': ['الصف الأول الإعدادي', 'الصف الثاني الإعدادي', 'الصف الثالث الإعدادي'],
  'المرحلة الثانوية': ['الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي'],
};

const ACADEMIC_STAGES = Object.keys(GRADES_BY_STAGE);

const DEFAULT_ACADEMIC_STAGE = 'المرحلة الثانوية';
const DEFAULT_GRADE = GRADES_BY_STAGE[DEFAULT_ACADEMIC_STAGE][0];
const DEFAULT_GENDER = 'ذكر';

export default function AuthScreens({ onLoginSuccess, centerConfig }: AuthScreensProps) {
  const [view, setView] = useState<'login' | 'join'>(getInitialAuthView);
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    const syncViewWithHash = () => setView(getInitialAuthView());
    window.addEventListener('hashchange', syncViewWithHash);
    return () => window.removeEventListener('hashchange', syncViewWithHash);
  }, []);
  
  // Login Form States
  const [studentCode, setStudentCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Join Request Form States
  const [studentName, setStudentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [academicStage, setAcademicStage] = useState(DEFAULT_ACADEMIC_STAGE);
  const [grade, setGrade] = useState(DEFAULT_GRADE);
  const [academicGroup, setAcademicGroup] = useState('');
  const [gender, setGender] = useState(DEFAULT_GENDER);

  // Real center groups pulled from the desktop-synced `groups` table.
  const [centerGroups, setCenterGroups] = useState<PortalGroupOption[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsFetchError, setGroupsFetchError] = useState(false);

  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);
  const [joinSuccessMsg, setJoinSuccessMsg] = useState('');
  const [joinErrorMsg, setJoinErrorMsg] = useState('');

  // Grades available for the currently selected stage.
  const availableGrades = useMemo(
    () => GRADES_BY_STAGE[academicStage] ?? GRADES_BY_STAGE[DEFAULT_ACADEMIC_STAGE],
    [academicStage],
  );

  // Groups filtered to the selected grade when the desktop tagged them with a grade_level;
  // groups without a grade level stay available for every stage.
  const filteredGroups = useMemo(
    () => centerGroups.filter((group) => !group.gradeLevel || group.gradeLevel === grade),
    [centerGroups, grade],
  );

  // Load the real groups once the join view is opened or when a fetch failure occurred.
  useEffect(() => {
    if (view !== 'join' || groupsLoading) return;
    let cancelled = false;
    setGroupsLoading(true);
    setGroupsFetchError(false);
    fetchActiveGroups()
      .then((groups) => {
        if (!cancelled) setCenterGroups(groups);
      })
      .catch((err) => {
        console.error('fetchActiveGroups failed:', err);
        if (!cancelled) setGroupsFetchError(true);
      })
      .finally(() => {
        if (!cancelled) setGroupsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view]);

  // When the stage changes, snap the grade back to a valid option for that stage.
  const handleStageChange = (nextStage: string) => {
    setAcademicStage(nextStage);
    const grades = GRADES_BY_STAGE[nextStage] ?? [];
    if (!grades.includes(grade)) {
      setGrade(grades[0] ?? '');
    }
  };

  // Keep the selected group valid as the grade filter changes.
  useEffect(() => {
    if (academicGroup && !filteredGroups.some((group) => group.name === academicGroup)) {
      setAcademicGroup('');
    }
  }, [filteredGroups, academicGroup]);

  const openView = (nextView: 'login' | 'join') => {
    setView(nextView);
    const nextUrl = nextView === 'join'
      ? `${window.location.pathname}${window.location.search}#join-request`
      : `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, '', nextUrl);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const student = await loginStudent(phoneNumber, studentCode);
      if (student) {
        onLoginSuccess(student);
        return;
      }
      setLoginError('تعذر العثور على الطالب بالرقم المدخل. يرجى التحقق من البيانات.');
    } catch (err: any) {
      setLoginError(err.message || 'حدث خطأ غير متوقع أثناء الاتصال بالخادم.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinSuccessMsg('');
    setJoinErrorMsg('');

    if (!studentName.trim() || !parentPhone.trim()) {
      setJoinErrorMsg('الرجاء إدخال اسم الطالب ورقم هاتف ولي الأمر (إلزامي)');
      return;
    }

    setIsSubmittingJoin(true);

    try {
      const apiRes = await submitJoinRequest({
        student_name: studentName,
        phone: studentPhone || parentPhone,
        parent_phone: parentPhone,
        grade,
        academic_stage: academicStage,
        academic_group: academicGroup || 'غير محدد',
        gender,
      });
      if (apiRes.success) {
        setJoinSuccessMsg('تم تسجيل وإرسال طلب الانضمام بنجاح وسيتواصل معكم فريق القبول قريباً.');
        setStudentName('');
        setParentPhone('');
        setStudentPhone('');
        setAcademicStage(DEFAULT_ACADEMIC_STAGE);
        setGrade(DEFAULT_GRADE);
        setAcademicGroup('');
        setGender(DEFAULT_GENDER);
      } else {
        setJoinErrorMsg(apiRes.error === 'request_already_exists'
          ? 'يوجد طلب انضمام قيد المراجعة بنفس رقم الهاتف بالفعل.'
          : 'حدث خطأ أثناء إرسال طلب الانضمام.');
      }
    } catch (err: any) {
      setJoinErrorMsg(err.message || 'فشل في إرسال الطلب.');
    } finally {
      setIsSubmittingJoin(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg-app text-text-primary flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden font-sans select-none" dir="rtl" aria-labelledby="portal-login-title">
      
      {/* Absolute Decorative Ambient Background Blurs */}
      <div aria-hidden="true" className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-900/10 dark:bg-indigo-900/10 blur-[130px]" />
      <div aria-hidden="true" className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-violet-900/10 dark:bg-violet-900/10 blur-[130px]" />

      <div className="w-full max-w-6xl grid md:grid-cols-12 gap-6 lg:gap-10 items-center z-10">
        
        {/* Intro informational panel */}
        <div className="md:col-span-5 flex flex-col justify-center space-y-6 text-right font-sans">
          <div className="flex items-center gap-3">
            <img
              src="/portal-logo.png"
              alt={`شعار سنتر ${centerConfig.centerName}`}
              width="56"
              height="56"
              decoding="async"
              loading="eager"
              className="w-14 h-14 object-contain"
            />
            <div>
              <h1 id="portal-login-title" className="text-2xl font-black tracking-tight text-text-primary">بوابة سنتر {centerConfig.centerName}</h1>
              <p className="text-sm text-indigo-650 dark:text-indigo-400 font-bold">{centerConfig.teacherName} - أستاذ {centerConfig.subjectName}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-secondary">بوابة تعليمية ذكية</h2>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              بوابة تعليمية ذكية تمنح الطلاب وأولياء الأمور وصولاً سريعًا إلى الحضور والغياب، والاشتراكات، والاختبارات الإلكترونية، والنتائج، والتقييمات، والإشعارات، عبر واجهة حديثة وآمنة توفر تجربة متابعة متكاملة في أي وقت.
            </p>
            <div className="p-3 bg-indigo-500/5 dark:bg-slate-900/45 border border-indigo-500/10 dark:border-slate-800 rounded-2xl flex items-center justify-between text-right mt-2">
              <span className="text-[10px] text-indigo-650 dark:text-indigo-400 font-bold">الدعم الأكاديمي المباشر</span>
              <a href={`tel:${centerConfig.phoneNumber}`} className="text-xs font-black text-indigo-650 dark:text-indigo-400 font-mono flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                <span>{centerConfig.phoneNumber}</span>
              </a>
            </div>
          </div>
        </div>

        {/* Right Form Card */}
        <div className="md:col-span-7">
          <div className="p-6 md:p-8 rounded-3xl bg-bg-card backdrop-blur-xl border border-border-card shadow-lg dark:shadow-2xl space-y-6">
            
            {/* Tab switch header */}
            <div className="flex p-1 bg-neutral-100 dark:bg-slate-950/45 rounded-2xl border border-neutral-200/60 dark:border-slate-900/55" role="tablist" aria-label="اختيار شاشة الدخول أو طلب الانضمام">
              <button
                type="button"
                id="auth-tab-login"
                role="tab"
                aria-controls="login-form"
                aria-selected={view === 'login'}
                onClick={() => { openView('login'); setLoginError(''); }}
                className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${
                  view === 'login' 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/10 font-black' 
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                تسجيل الدخول للطالب
              </button>
              <button
                type="button"
                id="auth-tab-join"
                role="tab"
                aria-controls="join-request-form"
                aria-selected={view === 'join'}
                onClick={() => { openView('join'); setJoinErrorMsg(''); setJoinSuccessMsg(''); }}
                className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${
                  view === 'join' 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/10 font-black' 
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                طلب انضمام جديد للسنتر
              </button>
            </div>

            {/* ERROR / SUCCESS Banner display */}
            {!isOnline && (
              <div
                id="auth-offline-status"
                className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs text-right leading-relaxed animate-in fade-in duration-150"
                role="status"
                aria-live="polite"
              >
                <Wifi className="w-4 h-4 shrink-0 mt-0.5" />
                <span>لا يوجد اتصال بالإنترنت. بعض البيانات قد لا تكون محدّثة.</span>
              </div>
            )}

            {loginError && view === 'login' && (
              <div
                id="login-error-message"
                className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs text-right leading-relaxed animate-in fade-in duration-150"
                role="alert"
                aria-live="assertive"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            {joinErrorMsg && view === 'join' && (
              <div
                id="join-error-message"
                className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs text-right leading-relaxed animate-in fade-in"
                role="alert"
                aria-live="assertive"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{joinErrorMsg}</span>
              </div>
            )}

            {joinSuccessMsg && view === 'join' && (
              <div
                id="join-success-message"
                className="flex flex-col items-center text-center gap-2.5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-650 dark:text-emerald-400 text-xs animate-in zoom-in duration-200"
                role="status"
                aria-live="polite"
              >
                <CheckCircle2 className="w-8 h-8" />
                <span className="font-bold text-sm">تم إرسال طلبك للمراجعة الأكاديمية!</span>
                <p className="text-slate-300 leading-relaxed text-[11px] font-sans">
                  {joinSuccessMsg}
                </p>
              </div>
            )}

            {/* RENDER VIEW */}
            {view === 'login' ? (
              <form
                id="login-form"
                onSubmit={handleLoginSubmit}
                className="space-y-4"
                role="tabpanel"
                aria-labelledby="auth-tab-login"
                aria-describedby={loginError ? 'login-error-message' : undefined}
              >
                <div className="text-right space-y-1">
                  <h2 className="text-base font-black text-text-primary">أهلاً بك في بوابة الطالب</h2>
                  <p className="text-xs text-text-muted">يرجى تسجيل الدخول بكود الطالب ورقم الهاتف المسجل.</p>
                </div>

                <div className="space-y-3.5">
                  <div className="relative">
                    <label htmlFor="login-student-code" className="text-[11px] font-bold text-text-secondary mb-1.5 block">كود الطالب الأكاديمي</label>
                    <div className="relative">
                      <input
                        id="login-student-code"
                        type="text"
                        name="student-code"
                        required
                        value={studentCode}
                        onChange={(e) => setStudentCode(e.target.value)}
                        autoComplete="username"
                        inputMode="numeric"
                        placeholder="مثال: 2026110904"
                        className="w-full h-11 pr-11 pl-4 rounded-xl bg-neutral-50 dark:bg-slate-950/60 text-text-primary border border-neutral-200 dark:border-slate-800/80 focus:border-indigo-505 focus:ring-1 focus:ring-indigo-505 transition-all font-mono text-sm placeholder:text-text-muted tracking-wide text-right"
                        aria-invalid={Boolean(loginError)}
                        aria-describedby={loginError ? 'login-error-message' : undefined}
                      />
                      <User className="w-4 h-4 text-slate-505 absolute top-3.5 right-4" />
                    </div>
                  </div>

                  <div className="relative">
                    <label htmlFor="login-phone" className="text-[11px] font-bold text-text-secondary mb-1.5 block">رقم هاتف الطالب أو ولي الأمر</label>
                    <div className="relative">
                      <input
                        id="login-phone"
                        type="tel"
                        name="phone"
                        required
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        autoComplete="tel"
                        inputMode="tel"
                        placeholder="مثال: 01011223344"
                        className="w-full h-11 pr-11 pl-4 rounded-xl bg-neutral-50 dark:bg-slate-950/60 text-text-primary border border-neutral-200 dark:border-slate-800/80 focus:border-indigo-505 focus:ring-1 focus:ring-indigo-505 transition-all font-mono text-sm placeholder:text-text-muted text-right"
                        aria-invalid={Boolean(loginError)}
                        aria-describedby={loginError ? 'login-error-message' : undefined}
                      />
                      <Phone className="w-4 h-4 text-slate-505 absolute top-3.5 right-4" />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn || !isOnline}
                  className="w-full h-12 rounded-xl bg-indigo-650 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/15 cursor-pointer mt-2"
                  aria-busy={isLoggingIn}
                >
                  {isLoggingIn ? (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : !isOnline ? (
                    <>
                      <span>لا يوجد اتصال بالإنترنت</span>
                      <Wifi className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <span>تسجيل الدخول بالتحقق الذكي</span>
                      <ArrowRight className="w-4 h-4 rotate-180" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* JOIN REQUEST form view */
              <form
                id="join-request-form"
                onSubmit={handleJoinSubmit}
                className="space-y-4"
                role="tabpanel"
                aria-labelledby="auth-tab-join"
                aria-describedby={joinErrorMsg ? 'join-error-message' : joinSuccessMsg ? 'join-success-message' : undefined}
              >
                <div className="text-right space-y-1">
                  <h2 className="text-base font-black text-text-primary">إرسال طلب التحاق جديد للسنتر</h2>
                  <p className="text-xs text-text-muted">املأ البيانات المطلوبة وسيتم إرسال طلب انضمام رسمي للأستاذ ومراجعته.</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  
                  {/* Student Name */}
                  <div className="space-y-1 text-right">
                    <label htmlFor="join-student-name" className="text-[11px] font-bold text-text-secondary">اسم الطالب رباعي <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <input
                        id="join-student-name"
                        type="text"
                        name="student-name"
                        required
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        autoComplete="name"
                        placeholder="مثال: يوسف حسام السيد"
                        className="w-full h-10 pr-10 pl-3 rounded-xl bg-neutral-50 dark:bg-slate-950/60 text-text-primary border border-neutral-200 dark:border-slate-800 focus:border-indigo-505 transition-all text-xs"
                        aria-invalid={Boolean(joinErrorMsg)}
                        aria-describedby={joinErrorMsg ? 'join-error-message' : joinSuccessMsg ? 'join-success-message' : undefined}
                      />
                      <User className="w-3.5 h-3.5 text-slate-505 absolute top-3.5 right-3.5" />
                    </div>
                  </div>

                  {/* Parent Phone */}
                  <div className="space-y-1 text-right">
                    <label htmlFor="join-parent-phone" className="text-[11px] font-bold text-text-secondary">رقم ولي الأمر (إلزامي) <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <input
                        id="join-parent-phone"
                        type="tel"
                        name="parent-phone"
                        required
                        value={parentPhone}
                        onChange={(e) => setParentPhone(e.target.value)}
                        autoComplete="tel"
                        inputMode="tel"
                        placeholder="مثال: 01114521458"
                        className="w-full h-10 pr-10 pl-3 rounded-xl bg-neutral-50 dark:bg-slate-950/60 text-text-primary border border-neutral-200 dark:border-slate-800 focus:border-indigo-505 transition-all text-xs font-mono"
                        aria-invalid={Boolean(joinErrorMsg)}
                        aria-describedby={joinErrorMsg ? 'join-error-message' : joinSuccessMsg ? 'join-success-message' : undefined}
                      />
                      <Phone className="w-3.5 h-3.5 text-slate-550 absolute top-3.5 right-3.5" />
                    </div>
                  </div>

                  {/* Student Phone */}
                  <div className="space-y-1 text-right">
                    <label htmlFor="join-student-phone" className="text-[11px] font-bold text-text-secondary">رقم الطالب الأخصائي (اختياري)</label>
                    <div className="relative">
                      <input
                        id="join-student-phone"
                        type="tel"
                        name="student-phone"
                        value={studentPhone}
                        onChange={(e) => setStudentPhone(e.target.value)}
                        autoComplete="tel"
                        inputMode="tel"
                        placeholder="مثال: 01548775412"
                        className="w-full h-10 pr-10 pl-3 rounded-xl bg-neutral-50 dark:bg-slate-950/60 text-text-primary border border-neutral-200 dark:border-slate-800/80 focus:border-indigo-505 transition-all text-xs font-mono"
                      />
                      <Phone className="w-3.5 h-3.5 text-slate-550 absolute top-3.5 right-3.5" />
                    </div>
                  </div>

                  {/* Stage */}
                  <div className="space-y-1 text-right">
                    <label htmlFor="join-academic-stage" className="text-[11px] font-bold text-text-secondary font-sans">المرحلة الدراسية</label>
                    <div className="relative">
                      <select
                        id="join-academic-stage"
                        value={academicStage}
                        onChange={(e) => handleStageChange(e.target.value)}
                        className="w-full h-10 pr-10 pl-3 rounded-xl bg-neutral-50 dark:bg-slate-950/60 text-text-primary border border-neutral-200 dark:border-slate-800/80 focus:border-indigo-505 transition-all text-xs appearance-none cursor-pointer"
                      >
                        {ACADEMIC_STAGES.map((stage) => (
                          <option key={stage} value={stage} className="bg-white dark:bg-slate-900">{stage}</option>
                        ))}
                      </select>
                      <Layers className="w-3.5 h-3.5 text-slate-550 absolute top-3.5 right-3.5 pointer-events-none" />
                    </div>
                  </div>

                  {/* Grade */}
                  <div className="space-y-1 text-right">
                    <label htmlFor="join-grade" className="text-[11px] font-bold text-neutral-500 dark:text-slate-405">الصف الدراسي</label>
                    <div className="relative">
                      <select
                        id="join-grade"
                        value={grade}
                        onChange={(e) => setGrade(e.target.value)}
                        className="w-full h-10 pr-10 pl-3 rounded-xl bg-neutral-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-100 border border-neutral-200 dark:border-slate-800 focus:border-indigo-505 transition-all text-xs appearance-none cursor-pointer"
                      >
                        {availableGrades.map((gradeOption) => (
                          <option key={gradeOption} value={gradeOption} className="bg-white dark:bg-slate-900">{gradeOption}</option>
                        ))}
                      </select>
                      <BookOpen className="w-3.5 h-3.5 text-slate-550 absolute top-3.5 right-3.5 pointer-events-none" />
                    </div>
                  </div>

                  {/* Academic Group */}
                  <div className="space-y-1 text-right">
                    <label htmlFor="join-academic-group" className="text-[11px] font-bold text-neutral-500 dark:text-slate-405">المجموعة التعليمية</label>
                    <div className="relative">
                      <select
                        id="join-academic-group"
                        value={academicGroup}
                        onChange={(e) => setAcademicGroup(e.target.value)}
                        disabled={groupsLoading}
                        className="w-full h-10 pr-10 pl-3 rounded-xl bg-neutral-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-100 border border-neutral-200 dark:border-slate-800 focus:border-indigo-505 transition-all text-xs appearance-none cursor-pointer disabled:opacity-60"
                      >
                        <option value="" className="bg-white dark:bg-slate-900">
                          {groupsLoading
                            ? 'جارٍ تحميل المجموعات...'
                            : filteredGroups.length === 0
                              ? 'لا توجد مجموعات متاحة — سيحددها السنتر'
                              : 'اختر المجموعة المناسبة'}
                        </option>
                        {filteredGroups.map((group) => (
                          <option key={group.id} value={group.name} className="bg-white dark:bg-slate-900">{group.name}</option>
                        ))}
                      </select>
                      <Users className="w-3.5 h-3.5 text-slate-550 absolute top-3.5 right-3.5 pointer-events-none" />
                    </div>
                  </div>

                  {/* Gender selection */}
                  <div className="space-y-1 text-right">
                    <label htmlFor="join-gender" className="text-[11px] font-bold text-neutral-500 dark:text-slate-450">الجنس</label>
                    <div className="relative">
                      <select
                        id="join-gender"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full h-10 pr-10 pl-3 rounded-xl bg-neutral-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-100 border border-neutral-200 dark:border-slate-800 focus:border-indigo-505 transition-all text-xs appearance-none cursor-pointer"
                      >
                        <option value="ذكر" className="bg-white dark:bg-slate-900">ذكر (طالب)</option>
                        <option value="أنثى" className="bg-white dark:bg-slate-900">أنثى (طالبة)</option>
                      </select>
                      <User className="w-3.5 h-3.5 text-slate-550 absolute top-3.5 right-3.5 pointer-events-none" />
                    </div>
                  </div>

                </div>

                <button
                  type="submit"
                  disabled={isSubmittingJoin}
                  className="w-full h-11 rounded-xl bg-indigo-650 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer mt-3"
                  aria-busy={isSubmittingJoin}
                >
                  {isSubmittingJoin ? (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>أرسل طلب الانضمام إلى الإدارة</span>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
