import React, { useState } from 'react';
import { studentAggregate } from '../db';
import { GraduationCap, ArrowRight, CheckCircle2, AlertCircle, Sparkles, Phone, User, BookOpen, Layers, Users } from 'lucide-react';
import type { StudentProfile } from '../types/domain';

interface AuthScreensProps {
  onLoginSuccess: (student: StudentProfile) => void;
}

export default function AuthScreens({ onLoginSuccess }: AuthScreensProps) {
  const [view, setView] = useState<'login' | 'join'>('login');

  const [studentCode, setStudentCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [studentName, setStudentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [academicStage, setAcademicStage] = useState('المرحلة الثانوية');
  const [grade, setGrade] = useState('الصف الثالث الثانوي');
  const [academicGroup, setAcademicGroup] = useState('المجموعة أ (الرئيسية)');

  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);
  const [joinSuccessMsg, setJoinSuccessMsg] = useState('');
  const [joinErrorMsg, setJoinErrorMsg] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const result = await studentAggregate.login(studentCode, phoneNumber);
      if (result.success && result.student) {
        onLoginSuccess(result.student);
      } else {
        setLoginError(result.error || 'فشل تسجيل الدخول. يرجى التحقق من المدخلات.');
      }
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
      const res = await studentAggregate.createJoinRequest({
        studentName: studentName.trim(),
        parentPhone: parentPhone.trim(),
        studentPhone: studentPhone.trim() || undefined,
        academicStage,
        grade,
        academicGroup,
      });
      if (res.success) {
        setJoinSuccessMsg(res.message);
        setStudentName('');
        setParentPhone('');
        setStudentPhone('');
      } else {
        setJoinErrorMsg(res.message || 'حدث خطأ أثناء إرسال طلب الانضمام.');
      }
    } catch (err: any) {
      setJoinErrorMsg(err.message || 'فشل في إرسال الطلب.');
    } finally {
      setIsSubmittingJoin(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-app text-text-primary flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden font-sans select-none" dir="rtl">
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-900/10 dark:bg-indigo-900/10 blur-[130px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-violet-900/10 dark:bg-violet-900/10 blur-[130px]" />

      <div className="w-full max-w-4xl grid md:grid-cols-12 gap-6 items-center z-10">
        <div className="md:col-span-5 flex flex-col justify-center space-y-6 text-right font-sans">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-500/30">
              <GraduationCap className="w-8 h-8" />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-text-primary">بوابة سنتر الألفا</h1>
              <p className="text-sm text-indigo-650 dark:text-indigo-400 font-bold">الأستاذ محمد عطية - أستاذ الرياضيات</p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-bold text-text-secondary">الربط الإلكتروني والمتابعة للطلاب</h2>
            <p className="text-xs text-text-muted leading-relaxed">
              بوابة إلكترونية ذكية تتيح لطلاب مجموعات الأستاذ محمد عطية (أستاذ الرياضيات) الاستعلام الفوري عن سجلات الحضور والغياب، المدفوعات والاشتراكات، والولوج للامتحانات والتقييمات الرقمية لحظياً. للتواصل والدعم الأكاديمي: 01126473389.
            </p>
            <div className="p-3 bg-indigo-500/5 dark:bg-slate-900/45 border border-indigo-500/10 dark:border-slate-800 rounded-2xl flex items-center justify-between text-right mt-2">
              <span className="text-[10px] text-indigo-650 dark:text-indigo-400 font-bold">الدعم الأكاديمي المباشر</span>
              <a href="tel:01126473389" className="text-xs font-black text-indigo-650 dark:text-indigo-400 font-mono flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                <span>01126473389</span>
              </a>
            </div>
          </div>
        </div>

        <div className="md:col-span-12 lg:col-span-7">
          <div className="p-6 md:p-8 rounded-3xl bg-bg-card backdrop-blur-xl border border-border-card shadow-lg dark:shadow-2xl space-y-6">
            <div className="flex p-1 bg-neutral-100 dark:bg-slate-950/45 rounded-2xl border border-neutral-200/60 dark:border-slate-900/55">
              <button
                onClick={() => { setView('login'); setLoginError(''); }}
                className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${
                  view === 'login'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/10 font-black'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                تسجيل الدخول للطالب
              </button>
              <button
                onClick={() => { setView('join'); setJoinErrorMsg(''); setJoinSuccessMsg(''); }}
                className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${
                  view === 'join'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/10 font-black'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                طلب انضمام جديد للسنتر
              </button>
            </div>

            {loginError && view === 'login' && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs text-right leading-relaxed animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            {joinErrorMsg && view === 'join' && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs text-right leading-relaxed animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{joinErrorMsg}</span>
              </div>
            )}

            {joinSuccessMsg && view === 'join' && (
              <div className="flex flex-col items-center text-center gap-2.5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-650 dark:text-emerald-400 text-xs animate-in zoom-in duration-200">
                <CheckCircle2 className="w-8 h-8" />
                <span className="font-bold text-sm">تم إرسال طلبك للمراجعة الأكاديمية!</span>
                <p className="text-slate-300 leading-relaxed text-[11px] font-sans">
                  {joinSuccessMsg}
                </p>
              </div>
            )}

            {view === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="text-right space-y-1">
                  <h3 className="text-base font-black text-text-primary">أهلاً بك في بوابة الطالب</h3>
                  <p className="text-xs text-text-muted">يرجى تسجيل الدخول بكود الطالب ورقم الهاتف المسجل.</p>
                </div>

                <div className="space-y-3.5">
                  <div className="relative">
                    <label className="text-[11px] font-bold text-text-secondary mb-1.5 block">كود الطالب الأكاديمي</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={studentCode}
                        onChange={(e) => setStudentCode(e.target.value)}
                        placeholder="مثال: 2026110904"
                        className="w-full h-11 pr-11 pl-4 rounded-xl bg-neutral-50 dark:bg-slate-950/60 text-text-primary border border-neutral-200 dark:border-slate-800/80 focus:border-indigo-505 focus:ring-1 focus:ring-indigo-505 transition-all font-mono text-sm placeholder:text-text-muted tracking-wide text-right"
                      />
                      <User className="w-4 h-4 text-slate-505 absolute top-3.5 right-4" />
                    </div>
                  </div>

                  <div className="relative">
                    <label className="text-[11px] font-bold text-text-secondary mb-1.5 block">رقم هاتف الطالب أو ولي الأمر</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="مثال: 01011223344"
                        className="w-full h-11 pr-11 pl-4 rounded-xl bg-neutral-50 dark:bg-slate-950/60 text-text-primary border border-neutral-200 dark:border-slate-800/80 focus:border-indigo-505 focus:ring-1 focus:ring-indigo-505 transition-all font-mono text-sm placeholder:text-text-muted text-right"
                      />
                      <Phone className="w-4 h-4 text-slate-505 absolute top-3.5 right-4" />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full h-12 rounded-xl bg-indigo-650 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/15 cursor-pointer mt-2"
                >
                  {isLoggingIn ? (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>تسجيل الدخول بالتحقق الذكي</span>
                      <ArrowRight className="w-4 h-4 rotate-180" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleJoinSubmit} className="space-y-4">
                <div className="text-right space-y-1">
                  <h3 className="text-base font-black text-text-primary">إرسال طلب التحاق جديد للسنتر</h3>
                  <p className="text-xs text-text-muted">املأ البيانات المطلوبة وسيتم إرسال طلب انضمام رسمي للأستاذ ومراجعته.</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1 text-right">
                    <label className="text-[11px] font-bold text-text-secondary">اسم الطالب رباعي <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="مثال: يوسف حسام السيد"
                        className="w-full h-10 pr-10 pl-3 rounded-xl bg-neutral-50 dark:bg-slate-950/60 text-text-primary border border-neutral-200 dark:border-slate-800 focus:border-indigo-505 transition-all text-xs"
                      />
                      <User className="w-3.5 h-3.5 text-slate-505 absolute top-3.5 right-3.5" />
                    </div>
                  </div>

                  <div className="space-y-1 text-right">
                    <label className="text-[11px] font-bold text-text-secondary">رقم ولي الأمر (إلزامي) <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={parentPhone}
                        onChange={(e) => setParentPhone(e.target.value)}
                        placeholder="مثال: 01114521458"
                        className="w-full h-10 pr-10 pl-3 rounded-xl bg-neutral-50 dark:bg-slate-950/60 text-text-primary border border-neutral-200 dark:border-slate-800 focus:border-indigo-505 transition-all text-xs font-mono"
                      />
                      <Phone className="w-3.5 h-3.5 text-slate-550 absolute top-3.5 right-3.5" />
                    </div>
                  </div>

                  <div className="space-y-1 text-right">
                    <label className="text-[11px] font-bold text-text-secondary">رقم الطالب (اختياري)</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={studentPhone}
                        onChange={(e) => setStudentPhone(e.target.value)}
                        placeholder="مثال: 01548775412"
                        className="w-full h-10 pr-10 pl-3 rounded-xl bg-neutral-50 dark:bg-slate-950/60 text-text-primary border border-neutral-200 dark:border-slate-800/80 focus:border-indigo-505 transition-all text-xs font-mono"
                      />
                      <Phone className="w-3.5 h-3.5 text-slate-550 absolute top-3.5 right-3.5" />
                    </div>
                  </div>

                  <div className="space-y-1 text-right">
                    <label className="text-[11px] font-bold text-text-secondary font-sans">المرحلة الدراسية</label>
                    <div className="relative">
                      <select
                        value={academicStage}
                        onChange={(e) => setAcademicStage(e.target.value)}
                        className="w-full h-10 pr-10 pl-3 rounded-xl bg-neutral-50 dark:bg-slate-950/60 text-text-primary border border-neutral-200 dark:border-slate-800/80 focus:border-indigo-505 transition-all text-xs appearance-none cursor-pointer"
                      >
                        <option value="المرحلة الابتدائية">المرحلة الابتدائية</option>
                        <option value="المرحلة الإعدادية">المرحلة الإعدادية</option>
                        <option value="المرحلة الثانوية">المرحلة الثانوية</option>
                      </select>
                      <Layers className="w-3.5 h-3.5 text-slate-550 absolute top-3.5 right-3.5 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1 text-right">
                    <label className="text-[11px] font-bold text-neutral-500 dark:text-slate-405">الصف الدراسي</label>
                    <div className="relative">
                      <select
                        value={grade}
                        onChange={(e) => setGrade(e.target.value)}
                        className="w-full h-10 pr-10 pl-3 rounded-xl bg-neutral-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-100 border border-neutral-200 dark:border-slate-800 focus:border-indigo-505 transition-all text-xs appearance-none cursor-pointer"
                      >
                        <option value="الصف الأول">الصف الأول</option>
                        <option value="الصف الثاني">الصف الثاني</option>
                        <option value="الصف الثالث الثانوي">الصف الثالث الثانوي</option>
                      </select>
                      <BookOpen className="w-3.5 h-3.5 text-slate-550 absolute top-3.5 right-3.5 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1 text-right">
                    <label className="text-[11px] font-bold text-neutral-500 dark:text-slate-405">المجموعة التعليمية</label>
                    <div className="relative">
                      <select
                        value={academicGroup}
                        onChange={(e) => setAcademicGroup(e.target.value)}
                        className="w-full h-10 pr-10 pl-3 rounded-xl bg-neutral-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-100 border border-neutral-200 dark:border-slate-800 focus:border-indigo-505 transition-all text-xs appearance-none cursor-pointer"
                      >
                        <option value="المجموعة أ (الرئيسية)">المجموعة أ (الرئيسية)</option>
                        <option value="المجموعة ب (المتقدمة)">المجموعة ب (المتقدمة)</option>
                        <option value="المجموعة ج (عطلة نهاية الأسبوع)">المجموعة ج (عطلة نهاية الأسبوع)</option>
                      </select>
                      <Users className="w-3.5 h-3.5 text-slate-550 absolute top-3.5 right-3.5 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingJoin}
                  className="w-full h-11 rounded-xl bg-indigo-650 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer mt-3"
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
    </div>
  );
}
