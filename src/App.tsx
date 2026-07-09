﻿/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { 
  initialStudentProfile, 
  initialAttendanceRecords, 
  initialPaymentRecords, 
  initialGradeRecords, 
} from './data';
import { 
  StudentProfile, 
  AttendanceRecord, 
  PaymentRecord, 
  GradeRecord, 
  NotificationItem,
  CenterConfig,
  Exam
} from './types';
import {
  fetchAttendance as apiFetchAttendance,
  fetchPayments as apiFetchPayments,
  fetchGrades as apiFetchGrades,
  fetchExams as apiFetchExams,
  fetchCenterBySubdomain,
  saveToCache,
  clearAuthData,
} from './lib/workersApi';
import { playPortalHaptic as playMobileHapticTap } from './lib/audioFeedback';
import {
  clearLegacyStudentData,
  clearPortalStorage,
  getStoredStudent,
  persistStudentSession,
  readStudentData,
  writeStudentData,
} from './lib/portalStorage';
import {
  formatFreshnessTimestamp,
  getPortalDataFreshness,
  PortalDataFreshness,
  PortalDataSource,
} from './lib/portalDataState';
import { getPortalDataReadMeta, PortalDataReadKey } from './supabaseClient';
import AuthScreens from './components/AuthScreens';
import { 
  LayoutDashboard, CalendarCheck, CreditCard, 
  GraduationCap,
  LogOut,
  Wifi, Bell, Sparkles, Info,
  Trash2, FileText
} from 'lucide-react';

import { ToastProvider } from './components/Toast';
import { motion, AnimatePresence } from 'motion/react';

const Dashboard = lazy(() => import('./components/Dashboard'));
const Attendance = lazy(() => import('./components/Attendance'));
const Payments = lazy(() => import('./components/Payments'));
const Grades = lazy(() => import('./components/Grades'));
const ExamTaker = lazy(() => import('./components/ExamTaker'));

function TabLoadingState() {
  return (
    <div className="min-h-[360px] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-text-muted">
        <span className="inline-block w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-bold">جاري تجهيز بيانات البوابة...</span>
      </div>
    </div>
  );
}

const DEFAULT_CENTER_CONFIG: CenterConfig = {
  centerName: "الألفا",
  teacherName: "الأستاذ/ محمد أحمد عطية",
  subjectName: "الرياضيات",
  phoneNumber: "01126473389",
  slogan: "بناء قمة الصدارة والتميز مع عائلة المبدع الأكاديمي"
};

function normalizeCenterConfig(config: CenterConfig): CenterConfig {
  return {
    ...config,
    subjectName: String(config.subjectName || "الرياضيات")
      .replace(/\s*البحتة\s*و\s*التطبيقية\s*/g, "")
      .replace(/\s+/g, " ")
      .trim() || "الرياضيات",
  };
}

const PORTAL_DATA_READ_KEYS: PortalDataReadKey[] = ['attendance', 'payments', 'grades', 'exams'];

function dominantPortalDataSource(sources: PortalDataSource[]): PortalDataSource {
  if (sources.includes('snapshot')) return 'snapshot';
  if (sources.includes('cache')) return 'cache';
  if (sources.includes('local')) return 'local';
  return 'live';
}

function buildPortalDataFreshness(studentId: string): PortalDataFreshness {
  const readMetas = PORTAL_DATA_READ_KEYS
    .map((key) => getPortalDataReadMeta(key))
    .filter((meta): meta is NonNullable<typeof meta> => Boolean(meta));
  const source = readMetas.length > 0
    ? dominantPortalDataSource(readMetas.map((meta) => meta.source))
    : 'cache';
  const cacheFreshnessEntries = PORTAL_DATA_READ_KEYS
    .map((key) => getPortalDataFreshness(`${key}_${studentId}`, source))
    .filter((entry): entry is PortalDataFreshness => Boolean(entry));
  const timestamps = [
    ...cacheFreshnessEntries.map((entry) => entry.updatedAt).filter((value): value is number => Boolean(value)),
    ...readMetas.map((meta) => meta.at),
  ];

  return {
    source,
    updatedAt: timestamps.length > 0 ? Math.max(...timestamps) : null,
    isStale: source !== 'live' || cacheFreshnessEntries.some((entry) => entry.isStale),
  };
}

function portalDataSourceLabel(source: PortalDataSource): string {
  if (source === 'snapshot') return 'نسخة احتياطية';
  if (source === 'cache') return 'الكاش المحلي';
  if (source === 'local') return 'التخزين المحلي';
  return 'Supabase مباشر';
}

function StudentPortalApp() {
  useEffect(() => {
    clearLegacyStudentData();
  }, []);
  
  // Center White-label Configuration (Commercial Mode) — محمل من localStorage أو من الخادم
  const [centerConfig, setCenterConfig] = useState<CenterConfig>(() => {
    const saved = localStorage.getItem('portal_center_config');
    if (saved) {
      try {
        return normalizeCenterConfig(JSON.parse(saved));
      } catch (e) {}
    }
    return DEFAULT_CENTER_CONFIG;
  });

  useEffect(() => {
    let cancelled = false;

    async function initializeCenter() {
      const hostname = window.location.hostname;
      const queryCenter = new URLSearchParams(window.location.search).get('center');
      const hostnameSubdomain = hostname.includes('.')
        ? hostname.split('.')[0]
        : '';
      const subdomain = queryCenter || (
        hostnameSubdomain && hostnameSubdomain !== 'localhost'
          ? hostnameSubdomain
          : 'test'
      );

      const center = await fetchCenterBySubdomain(subdomain);
      if (!center || cancelled) return;

      // Only adopt non-empty values from the desktop-synced settings so a missing
      // field doesn't blank out the sensible default (name/teacher/subject).
      const centerName = String(center.name || '').trim();
      const teacherName = String(center.teacher_name || '').trim();
      const subjectName = String(center.subject_name || '').trim();

      sessionStorage.setItem('center_id', center.id);
      if (centerName) sessionStorage.setItem('center_name', centerName);
      if (teacherName) sessionStorage.setItem('teacher_name', teacherName);
      if (subjectName) sessionStorage.setItem('subject_name', subjectName);
      sessionStorage.setItem('portal_subdomain', subdomain);
      saveToCache('portal_center', center);

      const nextConfig: CenterConfig = {
        centerName: centerName || centerConfig.centerName,
        teacherName: teacherName || centerConfig.teacherName,
        subjectName: subjectName || centerConfig.subjectName,
        phoneNumber: centerConfig.phoneNumber,
        slogan: centerConfig.slogan,
      };
      const normalizedConfig = normalizeCenterConfig(nextConfig);
      localStorage.setItem('portal_center_config', JSON.stringify(normalizedConfig));
      setCenterConfig(normalizedConfig);
    }

    initializeCenter().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Online / Offline state
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

  // Global loading & error states for initial data fetch
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dataFreshness, setDataFreshness] = useState<PortalDataFreshness | null>(null);

  // Authentication State
  const [currentStudent, setCurrentStudent] = useState<StudentProfile | null>(() => getStoredStudent());

  // Core Persistent States representing current session databases
  const [profile, setProfile] = useState<StudentProfile>(() => initialStudentProfile);

  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => initialAttendanceRecords);

  const [payments, setPayments] = useState<PaymentRecord[]>(() => initialPaymentRecords);

  const [grades, setGrades] = useState<GradeRecord[]>(() => initialGradeRecords);

  const [exams, setExams] = useState<Exam[]>(() => []);

  // Notifications systems states
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showNotifications) return
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [showNotifications])
  const [notificationsFilter, setNotificationsFilter] = useState<'all' | 'attendance' | 'payments'>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    readStudentData(currentStudent, 'notifications', []),
  );

  useEffect(() => {
    writeStudentData(currentStudent, 'notifications', notifications);
  }, [currentStudent, notifications]);

  // Dynamic Island Notch Morphing state
  const [islandText, setIslandText] = useState<string | null>(null);
  const [islandIcon, setIslandIcon] = useState<'status' | 'success' | 'warning' | 'grade'>('status');
  const [islandActive, setIslandActive] = useState(false);

  const triggerDynamicIsland = (text: string, iconType: 'status' | 'success' | 'warning' | 'grade' = 'status') => {
    setIslandText(text);
    setIslandIcon(iconType);
    setIslandActive(true);
    playMobileHapticTap('pop');
    // Automatical morph closure
    setTimeout(() => {
      setIslandActive(false);
    }, 3800);
  };

  // Clock state for beautiful native status bars (12-hour format only)
  const [currentTime, setCurrentTime] = useState('10:42 ص');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hrsNum = now.getHours();
      const ampm = hrsNum >= 12 ? 'م' : 'ص';
      hrsNum = hrsNum % 12;
      hrsNum = hrsNum ? hrsNum : 12; // convert 0 to 12
      let hrs = hrsNum.toString().padStart(2, '0');
      let mins = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hrs}:${mins} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Keep global synchronized profile values matching currentStudent dynamically after log in
  useEffect(() => {
    if (currentStudent) {
      setProfile(prev => ({
        ...prev,
        name: currentStudent.name,
        studentCode: currentStudent.studentCode,
        id: currentStudent.id,
        department: currentStudent.department,
        academicYear: currentStudent.academicYear,
        gpa: currentStudent.gpa !== undefined ? currentStudent.gpa : prev.gpa,
        unpaidFees: currentStudent.unpaidFees !== undefined ? currentStudent.unpaidFees : prev.unpaidFees,
        attendanceRate: currentStudent.attendanceRate !== undefined ? currentStudent.attendanceRate : prev.attendanceRate,
      }));

      // الأولوية لـ Workers API (D1) — مع cache fallback داخلي (لا تضيع البيانات).
      const loadFromWorkersApi = async () => {
        setIsLoading(true);
        setFetchError(null);
        try {
          const sid = currentStudent.id;
          const [liveAttendance, livePayments, liveGrades, liveExams] = await Promise.all([
            apiFetchAttendance(sid),
            apiFetchPayments(sid),
            apiFetchGrades(sid),
            apiFetchExams(currentStudent),
          ]);
          if (liveAttendance) setAttendance(liveAttendance);
          if (livePayments) {
            setPayments(livePayments);
            const actualUnpaidSum = livePayments
              .filter((p) => p.status === 'pending')
              .reduce((acc, p) => acc + p.amount, 0);
            setProfile(prev => ({ ...prev, unpaidFees: actualUnpaidSum }));
          }
          if (liveGrades) setGrades(liveGrades);
          if (liveExams) setExams(liveExams);
        } catch (e: any) {
          const msg = e?.message || 'فشل جلب البيانات من الخادم';
          setFetchError(msg);
          console.warn('فشل سحب البيانات من Workers API:', msg);
        } finally {
          setDataFreshness(buildPortalDataFreshness(currentStudent.id));
          setIsLoading(false);
        }
      };

      loadFromWorkersApi();
    }
  }, [currentStudent]);

  const handleAddGrade = (newGrade: GradeRecord) => {
    setGrades((prev) => {
      const withoutDuplicate = prev.filter((grade) => grade.id !== newGrade.id);
      return [newGrade, ...withoutDuplicate];
    });

    if (newGrade.sourceExamId) {
      setExams((prev) =>
        prev.map((exam) =>
          exam.id === newGrade.sourceExamId
            ? { ...exam, status: 'completed' as const }
            : exam,
        ),
      );
    }
  };

  const handleLogout = () => {
    clearPortalStorage();
    clearAuthData().catch(() => {});
    setCurrentStudent(null);
    window.location.reload();
  };

  // Navigating tabs with custom sound feedback animation triggers
  const changeTabWithHaptic = (tab: string) => {
    setActiveTab(tab);
    playMobileHapticTap('light');
  };

  // Touch Gesture Swiping helper to let students swipe horizontally left/right between views like Telegram / Instagram
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    
    const diffX = touchStartXRef.current - e.changedTouches[0].clientX;
    const diffY = touchStartYRef.current - e.changedTouches[0].clientY;
    
    // Ensure gesture is horizontal and satisfies threshold
    if (Math.abs(diffX) > 85 && Math.abs(diffY) < 60) {
      const order = ['dashboard', 'attendance', 'payments', 'grades', 'exams'];
      const currentIndex = order.indexOf(activeTab);
      
      if (diffX > 0 && currentIndex < order.length - 1) {
        // Swipe to Left (Advance Next)
        changeTabWithHaptic(order[currentIndex + 1]);
      } else if (diffX < 0 && currentIndex > 0) {
        // Swipe to Right (Go Back)
        changeTabWithHaptic(order[currentIndex - 1]);
      }
    }
    
    // Clear references
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  if (!currentStudent) {
    return (
      <>
        <AuthScreens 
          onLoginSuccess={(student) => {
            setCurrentStudent(student);
            persistStudentSession(student);
            clearLegacyStudentData();
            const savedConfig = localStorage.getItem('portal_center_config');
            if (savedConfig) {
              try { setCenterConfig(JSON.parse(savedConfig)); } catch (e) {}
            }
          }} 
          centerConfig={centerConfig}
        />
      </>
    );
  }

  // Define screen layout rendering
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard 
            profile={profile} 
            attendance={attendance} 
            payments={payments} 
            grades={grades} 
            onNavigate={(tab) => changeTabWithHaptic(tab)}
            centerConfig={centerConfig}
            isLoading={isLoading}
            fetchError={fetchError}
          />
        );
      case 'attendance':
        return (
          <Attendance 
            records={attendance} 
          />
        );
      case 'payments':
        return (
          <Payments 
            records={payments} 
            centerConfig={centerConfig}
            isOnline={isOnline}
          />
        );
      case 'grades':
        return (
          <Grades 
            records={grades} 
          />
        );
      case 'exams':
        return (
          <ExamTaker
            exams={exams}
            currentStudent={currentStudent}
            onAddGrade={handleAddGrade}
          />
        );
      default:
        return null;
    }
  };

  // Nav labels mapper
  const navItems = [
    { key: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
    { key: 'attendance', label: 'الحضور', icon: CalendarCheck },
    { key: 'payments', label: 'المدفوعات', icon: CreditCard },
    { key: 'grades', label: 'الدرجات', icon: GraduationCap },
    { key: 'exams', label: 'الامتحانات', icon: FileText },
  ];

  // Notifications helpers
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen font-sans dark bg-bg-app text-text-primary transition-colors duration-300 relative select-none" dir="rtl">
      
      {/* 1. Subtle, ultra premium atmospheric lighting background glows */}
      <div className="absolute top-0 right-0 w-[55vw] h-[55vh] rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[50vw] h-[50vh] rounded-full bg-emerald-500/5 dark:bg-emerald-500/5 blur-[130px] pointer-events-none" />

      {/* 2. Main High-Performance Workspace Container */}
      <div id="portal-main-wrapper" className="w-full max-w-lg md:max-w-4xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1440px] mx-auto flex flex-col min-h-screen relative overflow-hidden px-4 md:px-6 lg:px-8 xl:px-10">
        
        {/* TOP FLOATING PROFILE & APP BRAND */}
        <div className="pt-6 pb-2 flex items-center justify-between" id="mobile-top-bar">
          <div className="flex items-center gap-3">
            <div className="relative group">
              <img 
                src={'/portal-logo.png'} 
                alt="شعار سنتر الألفا" 
                width="44"
                height="44"
                decoding="async"
                className="w-11 h-11 object-contain"

              />
              <span className="absolute -bottom-1 -right-0.5 block w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-950" />
            </div>
            <div className="text-right">
              <span className="text-[10px] text-text-muted block font-mono">مرحباً بك،</span>
              <span className="text-xs font-black text-text-primary flex items-center gap-1">
                {profile.name.split(" ")[0]} {profile.name.split(" ")[1]}
                <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              </span>
            </div>
          </div>

          {/* Quick interactive utility badge */}
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => { setShowNotifications(!showNotifications); playMobileHapticTap('light'); }}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-slate-900 rounded-xl transition-all relative border border-neutral-200/40 dark:border-slate-800 text-indigo-650 dark:text-indigo-400 cursor-pointer"
              title="مركز الإشعارات الأكاديمية"
            >
              <Bell className="w-4.5 h-4.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center text-[8px] text-white font-black animate-pulse shadow-sm">
                  {unreadCount}
                </span>
              )}
            </button>
            
            <button 
              onClick={handleLogout}
              className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-450 rounded-xl text-xs font-bold font-sans transition-colors cursor-pointer"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Offline warning banner */}
        {!isOnline && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs text-right mb-2 animate-pulse">
            <Wifi className="w-4 h-4 shrink-0" />
            <span>لا يوجد اتصال بالإنترنت. بعض البيانات قد لا تكون محدّثة.</span>
          </div>
        )}

        {dataFreshness?.isStale && (
          <div
            className="flex items-center gap-2 p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300 text-xs text-right mb-2"
            role="status"
            aria-live="polite"
          >
            <Info className="w-4 h-4 shrink-0" />
            <span>
              مصدر البيانات: {portalDataSourceLabel(dataFreshness.source)}. آخر تحديث: {formatFreshnessTimestamp(dataFreshness.updatedAt)}.
            </span>
          </div>
        )}

        {/* TOP FLOATING NOTIFICATION HUB (DRAWER / OVERLAY) */}
        <AnimatePresence>
          {showNotifications && (
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute top-22 inset-x-4 md:inset-x-auto md:left-6 md:w-[460px] lg:left-8 xl:left-10 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border border-indigo-100/40 dark:border-slate-850 p-5 rounded-[28px] shadow-[0_20px_50px_rgba(15,23,42,0.15)] space-y-4 text-right select-none"
              ref={notifRef}
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-850/50 pb-3">
                <div className="text-right">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-1.5 font-sans justify-end">
                    <span>مركز الإشعارات الأكاديمية</span>
                    <Bell className="w-4 h-4 text-indigo-500 animate-bounce" />
                  </h3>
                  <p className="text-[10px] text-neutral-450 dark:text-slate-300 mt-0.5 font-sans">تنبيهات سجلات الحضور، المطالبات المالية، وعلامات البوابة الامتحانية الفورية</p>
                </div>
                <button 
                  onClick={() => { setShowNotifications(false); playMobileHapticTap('pop'); }}
                  className="p-1 px-2.5 bg-neutral-100 dark:bg-slate-900 text-neutral-500 dark:text-slate-300 hover:text-rose-505 rounded-xl text-[10px] font-sans transition-all cursor-pointer font-bold"
                >
                  إغلاق المركز
                </button>
              </div>

              {/* Utility Panel */}
              <div className="flex flex-col sm:flex-row gap-2.5 justify-between items-stretch sm:items-center bg-gray-50/50 dark:bg-slate-900/30 p-2.5 rounded-2xl border border-neutral-150/10">
                <span className="text-[10px] font-bold font-sans text-neutral-400 block pr-1">إجراءات سريعة:</span>

                <div className="flex gap-2 items-center justify-end font-sans">
                  <button 
                    onClick={() => {
                      setNotifications(notifications.map(n => ({ ...n, read: true })));
                      playMobileHapticTap('light');
                    }}
                    className="text-[10px] text-indigo-650 dark:text-indigo-400 hover:underline cursor-pointer"
                    disabled={notifications.length === 0}
                  >
                    تحديد الكل كمقروء
                  </button>
                  <span className="text-neutral-300 dark:text-slate-800">|</span>
                  <button 
                    onClick={() => {
                      setNotifications([]);
                      playMobileHapticTap('warning');
                    }}
                    className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                    disabled={notifications.length === 0}
                  >
                    تفريغ السجل
                  </button>
                </div>
              </div>

              {/* Filtering indicators row */}
              <div className="flex gap-1.5 pb-1 select-none overflow-x-auto scrollbar-none justify-end">
                {[
                  { key: 'all', label: 'الكل' },
                  { key: 'attendance', label: 'حضور وغياب' },
                  { key: 'payments', label: 'مدفوعات ورسوم' },
                ].map((chip) => {
                  const isActive = notificationsFilter === chip.key;
                  return (
                    <button
                      key={chip.key}
                      onClick={() => { setNotificationsFilter(chip.key as any); playMobileHapticTap('light'); }}
                      className={`text-[10px] px-3 py-1 rounded-full transition-all shrink-0 font-sans font-bold cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-neutral-100 dark:bg-slate-900 text-neutral-550 dark:text-zinc-300 hover:bg-neutral-200 dark:hover:bg-slate-850'
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>

              {/* List space */}
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-150/10 dark:divide-slate-850/50 space-y-1.5 pr-0.5">
                {notifications.filter(n => notificationsFilter === 'all' || n.category === notificationsFilter).length === 0 ? (
                  <div className="py-8 text-center flex flex-col items-center justify-center space-y-1.5">
                    <Bell className="w-8 h-8 text-neutral-300 dark:text-slate-800 animate-bounce" />
                    <p className="text-xs text-text-muted font-sans font-bold">لا توجد تنبيهات مدرجة</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-300 font-sans">ستظهر الإشعارات والقرارات الصادرة هنا فور نشرها.</p>
                  </div>
                ) : (
                  notifications
                    .filter(n => notificationsFilter === 'all' || n.category === notificationsFilter)
                    .map((item) => {
                      const CategoryIcon = item.category === 'attendance'
                        ? CalendarCheck
                        : item.category === 'payments'
                        ? CreditCard
                        : Sparkles;

                      const categoryColor = item.category === 'attendance'
                        ? 'text-emerald-500 bg-emerald-500/10'
                        : item.category === 'payments'
                        ? 'text-amber-500 bg-amber-500/10'
                        : 'text-violet-500 bg-violet-500/10';

                      return (
                        <div 
                          key={item.id} 
                          onClick={() => {
                            setNotifications(notifications.map(n => n.id === item.id ? { ...n, read: true } : n));
                            playMobileHapticTap('light');
                          }}
                          className={`p-3 rounded-2xl transition-all relative flex gap-3 select-none items-center text-right group cursor-pointer ${
                            item.read 
                              ? 'bg-transparent hover:bg-neutral-50 dark:hover:bg-slate-900/10 opacity-70' 
                              : 'bg-indigo-50/25 dark:bg-indigo-500/5 hover:bg-indigo-50/40 dark:hover:bg-indigo-550/10'
                          }`}
                        >
                          {/* Close / Delete Icon */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setNotifications(notifications.filter(n => n.id !== item.id));
                              playMobileHapticTap('pop');
                            }}
                            className="absolute left-2.5 p-1 text-neutral-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg cursor-pointer"
                            title="حذف الإشعار"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Content text */}
                          <div className="flex-1 flex flex-col items-end pr-1 text-right">
                            <div className="flex items-center gap-1.5">
                              {!item.read && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 block animate-pulse" />}
                              <span className="text-xs font-bold text-slate-800 dark:text-zinc-150 font-sans">{item.title}</span>
                            </div>
                            <p className="text-[10px] text-neutral-450 dark:text-slate-300 font-sans leading-normal mt-0.5 max-w-[90%] font-medium">
                              {item.message}
                            </p>
                            <span className="text-[8px] text-slate-400 dark:text-slate-300 block font-mono mt-0.5">{item.timestamp}</span>
                          </div>

                          {/* Icon category */}
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${categoryColor}`}>
                            <CategoryIcon className="w-4.5 h-4.5" />
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MAIN MODULE CONTENT VIEWPORT SCREEN */}
        <div 
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="flex-1 pb-32 pt-4 md:pt-6 lg:pt-8" 
          id="mobile-tab-screen"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="space-y-6 lg:space-y-8"
            >
              <Suspense fallback={<TabLoadingState />}>
                {renderTabContent()}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* FLOATING BOTTOM GLASSMORPHISM APP NAVIGATION BAR */}
        <div className="fixed bottom-6 inset-x-4 md:max-w-2xl lg:max-w-3xl xl:max-w-4xl md:mx-auto z-40 bg-white/80 dark:bg-slate-950/70 backdrop-blur-xl border border-slate-200/50 dark:border-slate-850/60 rounded-[28px] p-2 flex items-center justify-around shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.key;
            
            return (
              <button
                key={item.key}
                onClick={() => changeTabWithHaptic(item.key)}
                className="relative py-2.5 px-3 rounded-2xl flex flex-col items-center justify-center gap-1 cursor-pointer group select-none flex-1"
              >
                {/* Animated glowing active background pill */}
                {isActive && (
                  <motion.span 
                    layoutId="active-mobile-dot"
                    className="absolute inset-0 bg-indigo-600/10 dark:bg-indigo-500/15 rounded-2xl border border-indigo-500/10"
                    transition={{ type: 'spring', stiffness: 180, damping: 15 }}
                  />
                )}
                
                {/* Floating active icon */}
                <IconComponent className={`w-4.5 h-4.5 transition-transform duration-200 group-hover:scale-110 shrink-0 ${
                  isActive 
                    ? 'text-indigo-650 dark:text-indigo-400 scale-105 font-bold' 
                    : 'text-neutral-400 dark:text-zinc-300 group-hover:text-neutral-550'
                }`} />
                
                <span className={`text-[10px] font-black transition-colors font-sans truncate ${
                  isActive 
                    ? 'text-indigo-650 dark:text-indigo-400 font-extrabold' 
                    : 'text-neutral-450 dark:text-zinc-300'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

      </div>

    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <StudentPortalApp />
    </ToastProvider>
  );
}
