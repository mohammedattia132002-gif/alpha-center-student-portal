/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Bell, CheckCircle2, AlertTriangle, Calendar, Award } from 'lucide-react';
import { StudentProfile } from '../types';

interface HeaderProps {
  profile: StudentProfile;
  activeTab: string;
}

export default function Header({ profile, activeTab }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      text: "تم إدراج علامات اختبار الفصل النهائي لمادة الرياضيات البحتة.",
      type: "success",
      time: "قبل ساعتين"
    },
    {
      id: 2,
      text: "لديك رسوم مستحقة بقيمة 1200 يرجى سدادها قبل نهاية الأسبوع.",
      type: "warning",
      time: "قبل يوم"
    },
    {
      id: 3,
      text: "تسجيل حضورك لمحاضرة الجبر والهندسة الفراغية بنجاح اليوم.",
      type: "info",
      time: "اليوم 12:45م"
    }
  ]);

  const removeNotification = (id: number) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const getTabTitleInArabic = (tab: string) => {
    switch (tab) {
      case 'dashboard': return 'لوحة التحكم الأكاديمية';
      case 'attendance': return 'سجل الحضور والغياب الموحد';
      case 'payments': return 'سجل المدفوعات والرسوم الدراسية';
      case 'grades': return 'كشف التقديرات والدرجات للامتحانات';
      case 'exams': return 'منصة الامتحانات والتقييمات الرقمية';
      default: return 'بوابة الطالب الذكية';
    }
  };

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between w-full h-20 px-6 border-b border-border-card bg-bg-card backdrop-blur-md transition-all duration-300">
      {/* Logo + Tab Title */}
      <div className="flex items-center gap-3">
        <img src="/header-logo.png" alt="سنتر الألفا" className="hidden sm:block h-10 w-auto" />
        <div className="flex flex-col items-start gap-0.5 text-right">
          <h1 className="text-base md:text-lg font-black tracking-tight text-text-primary font-sans">
            {getTabTitleInArabic(activeTab)}
          </h1>
          <p className="text-[10px] text-text-muted font-sans">
            نظام المتابعة الأكاديمي المباشر • الفصل الأكاديمي الحالي 2026
          </p>
        </div>
      </div>

      {/* Right Actions Block */}
      <div className="flex items-center gap-4">
        
        {/* Date Display */}
        <div className="items-center hidden gap-2 px-3 py-1.5 text-[11px] text-text-secondary rounded-xl bg-gray-50 dark:bg-slate-900/50 md:flex font-mono border border-border-card">
          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
          <span>2026-05-25</span>
        </div>

        {/* Notifications Menu */}
        <div className="relative">
          <button
            id="notifications-toggle-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2.5 text-text-secondary transition-all rounded-xl hover:bg-gray-100/80 dark:hover:bg-slate-900/50 hover:text-text-primary border border-border-card cursor-pointer"
            title="الإشعارات الأكاديمية"
          >
            <Bell className="w-4.5 h-4.5" />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 flex w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div 
              id="notifications-dropdown-menu"
              className="absolute left-0 mt-3 w-80 overflow-hidden text-right border border-border-card rounded-2xl bg-bg-card shadow-2xl ring-1 ring-black/5 z-50 animate-in fade-in duration-200"
            >
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-950/70 border-b border-border-card">
                <span className="text-[10px] text-indigo-650 dark:text-indigo-400 font-bold hover:underline cursor-pointer" onClick={() => setNotifications([])}>تحديد كمقروء</span>
                <span className="text-xs font-bold text-text-primary">الإشعارات الأكاديمية ({notifications.length})</span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-border-card">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-text-muted font-sans">لا توجد إشعارات جديدة</div>
                ) : (
                  notifications.map((notif) => (
                    <div key={notif.id} className="p-4 transition-all hover:bg-gray-55/20 relative group">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[9px] text-text-muted font-mono mt-0.5">{notif.time}</span>
                        <div className="flex items-start gap-2 flex-1 justify-end text-right">
                          <p className="text-xs font-normal text-text-secondary leading-relaxed pr-1 font-sans">
                            {notif.text}
                          </p>
                          {notif.type === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          ) : notif.type === 'warning' ? (
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          ) : (
                            <Award className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeNotification(notif.id)}
                        className="absolute bottom-1 left-2 text-[9px] text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer font-sans"
                      >
                        حذف
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Card with custom decoration */}
        <div className="flex items-center gap-3 pr-2 border-r border-border-card">
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-text-primary leading-none font-sans">{profile.name}</span>
            <span className="text-[10px] text-indigo-650 dark:text-indigo-400 mt-1 font-mono tracking-tight font-black">{profile.studentCode || profile.id}</span>
          </div>
          <div className="relative">
            <img
              src={profile.avatar}
              alt={profile.name}
              className="w-10 h-10 rounded-xl object-cover ring-2 ring-indigo-500/20"
              referrerPolicy="no-referrer"
            />
            <span className="absolute bottom-0 right-0 block w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-950" />
          </div>
        </div>

      </div>
    </header>
  );
}
