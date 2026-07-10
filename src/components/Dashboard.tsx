/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import type {
  StudentProfile,
  AttendanceRecord,
  PaymentRecord,
  GradeRecord,
  CenterConfig,
  GroupTimeSlot
} from '../types';
import {
  AlertCircle,
  Activity,
  Clock,
  MapPin,
  GraduationCap,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getGreeting, GreetingResult } from '../lib/getGreeting';
import { playPortalTap } from '../lib/audioFeedback';
import { useStudentStats } from '../hooks/useStudentStats';
import EmptyState from './EmptyState';

interface DashboardProps {
  profile: StudentProfile;
  attendance: AttendanceRecord[];
  payments: PaymentRecord[];
  grades: GradeRecord[];
  groupTimes: GroupTimeSlot[];
  onNavigate: (tab: string) => void;
  centerConfig: CenterConfig;
  isLoading?: boolean;
  fetchError?: string | null;
}

const daysOfWeekLabels = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

export default function Dashboard({ profile, attendance, grades, groupTimes, onNavigate, isLoading, fetchError }: DashboardProps) {
  const lastAttendance = attendance.slice(0, 3)

  const stats = useStudentStats(attendance, grades)

  const [greeting, setGreeting] = useState<GreetingResult>(() => getGreeting())

  useEffect(() => {
    const timer = setInterval(() => {
      setGreeting(getGreeting())
    }, 14000)
    return () => clearInterval(timer)
  }, [])

  const playHapticTip = () => playPortalTap(800);

  if (isLoading) {
    return (
      <div className="space-y-6 text-right md:px-2 animate-in fade-in duration-500" id="mobile-home-dashboard">
        <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 dark:from-indigo-950 dark:via-slate-900 dark:to-slate-955 rounded-3xl p-6 text-white relative overflow-hidden border border-white/5 dark:border-white/5 shadow-xl shadow-indigo-950/10 animate-pulse">
          <div className="h-6 w-1/3 bg-white/10 rounded-lg mb-4" />
          <div className="h-4 w-1/2 bg-white/10 rounded-lg mb-2" />
          <div className="h-8 w-3/4 bg-white/10 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-indigo-920 via-indigo-950 to-slate-900/95 border border-indigo-500/20 p-5 rounded-3xl h-48 animate-pulse" />
          <div className="bg-gradient-to-br from-indigo-920 via-indigo-950 to-slate-900/95 border border-indigo-500/20 p-5 rounded-3xl h-48 animate-pulse" />
        </div>
        <div className="bg-bg-card backdrop-blur-md border border-border-card p-5 rounded-3xl space-y-4 shadow-[0_4px_18px_rgba(15,23,42,0.02)] h-48 animate-pulse" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="space-y-6 text-right md:px-2 animate-in fade-in duration-500" id="mobile-home-dashboard">
        <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-3xl text-rose-600 dark:text-rose-400 text-center">
          <AlertCircle className="w-10 h-10 mx-auto mb-3" />
          <h3 className="text-sm font-black mb-1">تعذر تحميل البيانات</h3>
          <p className="text-xs leading-relaxed">{fetchError}</p>
          <p className="text-[10px] mt-2 text-rose-400/70">جرب إعادة تحميل الصفحة أو تحقق من اتصال الإنترنت.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8 text-right md:px-2 animate-in fade-in duration-500" id="mobile-home-dashboard">
      
{/* 1. EMOTIONAL WELCOME */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 dark:from-indigo-950 dark:via-slate-900 dark:to-slate-955 rounded-3xl p-6 text-white relative overflow-hidden border border-white/5 dark:border-white/5 shadow-xl shadow-indigo-950/10">
        {/* Glow orbs background decoration */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-indigo-400/20 dark:bg-indigo-505/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-purple-400/15 dark:bg-purple-505/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
              <span className="text-[10px] text-indigo-100 font-bold font-sans">البوابة التعليمية</span>
            </div>

          </div>

          <div className="space-y-1">
            <h2 className="text-xl md:text-2xl font-black text-white">{greeting.greetingTitle}</h2>
            <h3 className="text-sm font-semibold text-indigo-100 mt-1">{profile.name}</h3>
            <div className="mt-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-[10px] text-indigo-100 font-sans mb-2">
                <span>{greeting.icon}</span>
                <span>{greeting.categoryLabel}</span>
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={greeting.message}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35 }}
                  className="text-xs text-indigo-50 leading-relaxed font-sans"
                >
                  {greeting.message}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

        </div>
      </div>

      {/* 2. GROUP SCHEDULE CARD */}
      <div className="bg-bg-card backdrop-blur-md border border-border-card p-5 rounded-3xl shadow-[0_4px_18px_rgba(15,23,42,0.02)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-24 h-24 bg-gradient-to-br from-indigo-500/5 to-transparent rounded-full blur-xl" />
        <div className="flex items-center gap-2 border-b border-gray-100/60 dark:border-slate-850/50 pb-3 mb-4">
          <Calendar className="w-5 h-5 text-indigo-500" />
          <div className="text-right flex-1">
            <h3 className="text-xs font-black text-text-primary">مواعيد المجموعة</h3>
            <span className="text-[10px] text-text-muted block font-sans">{profile.department}</span>
          </div>
        </div>

        {groupTimes.length === 0 ? (
          <div className="py-4 text-center">
            <Clock className="w-8 h-8 text-neutral-300 dark:text-slate-700 mx-auto mb-2" />
            <p className="text-xs text-text-muted font-sans">لم يتم تحديد مواعيد للمجموعة بعد</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {groupTimes.map((slot) => (
              <div key={slot.id} className="p-3.5 bg-neutral-50/60 dark:bg-slate-950/40 rounded-2xl border border-border-card hover:bg-neutral-100/50 dark:hover:bg-slate-900/55 transition-all duration-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span className="text-xs font-black text-text-primary">{daysOfWeekLabels[slot.weekday] || 'غير محدد'}</span>
                </div>
                <div className="space-y-1.5 pr-3.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-text-muted font-sans">
                    <Clock className="w-3 h-3" />
                    <span>{slot.startTime} - {slot.endTime}</span>
                  </div>
                  {slot.room && (
                    <div className="flex items-center gap-1.5 text-[10px] text-text-muted font-sans">
                      <MapPin className="w-3 h-3" />
                      <span>{slot.room}</span>
                    </div>
                  )}
                  {slot.teacherName && (
                    <div className="flex items-center gap-1.5 text-[10px] text-text-muted font-sans">
                      <GraduationCap className="w-3 h-3 text-indigo-400" />
                      <span>{slot.teacherName}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Right Column (7-span) */}
        <div className="md:col-span-7 xl:col-span-8 space-y-6">
          {/* 2. DUAL PROGRESS RINGS BLOCK WITH PREMIUM GLASSMOPHISM & GLOW */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Latest Grade Progress Card */}
            <div className="group bg-gradient-to-br from-indigo-920 via-indigo-950 to-slate-900/95 border border-indigo-500/20 p-5 rounded-3xl flex flex-col justify-between items-center text-center space-y-4 shadow-[0_4px_18px_rgba(15,23,42,0.15)] transition-all duration-300 relative overflow-hidden text-white">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-xl" />
              
              <div className="space-y-1 text-center">
                <span className="text-xs font-black text-white block">أحدث علامة امتحان</span>
                <span className="text-[10px] text-white block font-sans">{stats.latestGrade ? stats.latestGrade.subjectName : ''}</span>
              </div>

              <div className="relative flex items-center justify-center min-h-[6rem] w-full">
                {stats.latestGrade ? (
                  <>
                    <svg className="w-24 h-24 transform -rotate-90">
                      <circle cx="48" cy="48" r="38" strokeWidth="6" stroke="rgba(255, 255, 255, 0.06)" fill="transparent" />
                      <circle 
                        cx="48" cy="48" r="38" strokeWidth="6" stroke="url(#indigoGrad)" 
                        strokeDasharray={2 * Math.PI * 38}
                        strokeDashoffset={2 * Math.PI * 38 * (1 - stats.latestGradePercent / 100)}
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
                      <span className="text-lg font-black text-white font-mono">{stats.latestGradePercent}%</span>
                      <span className="text-[9px] text-indigo-200 font-bold">{stats.latestGradeDisplay}</span>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    icon="📝"
                    title="لا توجد درجات بعد"
                    description="ستظهر أحدث نتيجة بعد أول امتحان."
                  />
                )}
              </div>

              <div className="w-full">
                <button 
                  onClick={() => { onNavigate('grades'); playHapticTip(); }}
                  className="w-full py-2 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-[10px] font-black transition-all border border-white/10 cursor-pointer active:scale-95"
                >
                  عرض كشف الدرجات 📊
                </button>
              </div>
            </div>

            {/* Attendance Ring Card */}
            <div className="group bg-gradient-to-br from-indigo-920 via-indigo-950 to-slate-900/95 border border-indigo-500/20 p-5 rounded-3xl flex flex-col justify-between items-center text-center space-y-4 shadow-[0_4px_18px_rgba(15,23,42,0.15)] transition-all duration-300 relative overflow-hidden text-white">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-xl" />
              
              <div className="space-y-1 text-center">
                <span className="text-xs font-black text-white block">نسبة الالتزام</span>
                <span className="text-[10px] text-white block font-sans">{stats.hasData ? `${attendance.length} محاضرة` : ''}</span>
              </div>

              <div className="relative flex items-center justify-center min-h-[6rem] w-full">
                {stats.hasData ? (
                  <>
                    <svg className="w-24 h-24 transform -rotate-90">
                      <circle cx="48" cy="48" r="38" strokeWidth="6" stroke="rgba(255, 255, 255, 0.06)" fill="transparent" />
                      <circle 
                        cx="48" cy="48" r="38" strokeWidth="6" stroke="url(#emeraldGrad)" 
                        strokeDasharray={2 * Math.PI * 38}
                        strokeDashoffset={2 * Math.PI * 38 * (1 - stats.attendanceRate / 100)}
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
                      <span className="text-lg font-black text-white font-mono">{stats.attendanceRateDisplay}</span>
                      <span className="text-[9px] text-emerald-300 font-bold">{stats.commitmentStatus.emoji} {stats.commitmentStatus.label}</span>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    icon="📊"
                    title="لم يتم تسجيل أي حضور"
                    description="ستظهر نسبة الالتزام بعد تسجيل أول محاضرة."
                  />
                )}
              </div>

              <div className="w-full">
                <button 
                  onClick={() => { onNavigate('attendance'); playHapticTip(); }}
                  className="w-full py-2 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-[10px] font-black transition-all border border-white/10 cursor-pointer active:scale-95"
                >
                  عرض السجل التفصيلي
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Left Column (5-span) */}
        <div className="md:col-span-5 xl:col-span-4 space-y-6">
          {/* 4. ATTENDANCE & GRADES SUMMARY TIMELINE - NOTION STYLED PANEL */}
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
                      <span className="block text-xs font-black text-text-primary">فصل/محاضرة يوم {log.date}</span>
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
