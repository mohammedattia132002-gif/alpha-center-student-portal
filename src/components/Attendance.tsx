/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { AttendanceRecord, AttendanceStatus } from '../types';
import { Search, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { calculateAttendanceRate } from '../hooks/useStudentStats';
import { useAccessibleDialog } from '../hooks/useAccessibleDialog';
import { playPortalTap } from '../lib/audioFeedback';
import { formatArabicDate, formatArabicDateShort, formatArabicTime, getArabicDayName, toArabicNumerals } from '../utils/arabicFormat';

interface AttendanceProps {
  records: AttendanceRecord[];
}

function getAttendanceRecordTime(record: AttendanceRecord): number {
  const rawStartTime = record.time.split('-')[0]?.trim() ?? '';
  const normalizedStartTime = rawStartTime
    .replace(/\s+/g, ' ')
    .replace('ص', 'AM')
    .replace('م', 'PM');

  const parsedDateTime = Date.parse(`${record.date} ${normalizedStartTime}`.trim());
  if (!Number.isNaN(parsedDateTime)) {
    return parsedDateTime;
  }

  const parsedDate = Date.parse(record.date);
  return Number.isNaN(parsedDate) ? 0 : parsedDate;
}

export default function Attendance({ records }: AttendanceProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDayLog, setSelectedDayLog] = useState<AttendanceRecord | null>(null);
  const closeDayLog = () => setSelectedDayLog(null);
  const dayLogDialogRef = useAccessibleDialog<HTMLDivElement>(Boolean(selectedDayLog), closeDayLog);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 380);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter]);

  const sortedRecords = [...records].sort((a, b) => {
    const timeDiff = getAttendanceRecordTime(b) - getAttendanceRecordTime(a);
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return b.id.localeCompare(a.id);
  });

  const filteredRecords = sortedRecords.filter((record) => {
    const matchesSearch =
      record.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.lecturer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusDetails = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return {
          text: 'حاضر',
          color: 'text-emerald-505 bg-emerald-500/10 border-emerald-500/15',
          badge: 'border-emerald-500/15 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5',
          bulletColor: 'bg-emerald-500 shadow-emerald-500/30',
        };
      case 'late':
        return {
          text: 'متأخر',
          color: 'text-amber-505 bg-amber-500/10 border-amber-500/15',
          badge: 'border-amber-500/15 text-amber-600 dark:text-amber-400 bg-amber-500/5',
          bulletColor: 'bg-amber-500 shadow-amber-500/30',
        };
      case 'excused':
        return {
          text: 'معذور',
          color: 'text-indigo-505 bg-indigo-500/10 border-indigo-500/15',
          badge: 'border-indigo-505/15 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5',
          bulletColor: 'bg-indigo-500 shadow-indigo-500/30',
        };
      case 'absent':
        return {
          text: 'غياب',
          color: 'text-rose-505 bg-rose-500/10 border-rose-500/15',
          badge: 'border-rose-505/15 text-rose-600 dark:text-rose-450 bg-rose-500/5',
          bulletColor: 'bg-rose-500 shadow-rose-500/30',
        };
    }
  };

  const total = records.length;
  const presentCount = records.filter((record) => record.status === 'present').length;
  const lateCount = records.filter((record) => record.status === 'late').length;
  const absentCount = records.filter((record) => record.status === 'absent').length;
  const excusedCount = records.filter((record) => record.status === 'excused').length;
  const attendanceRate = calculateAttendanceRate(records).toFixed(1);

  const recentHeatmapRecords = sortedRecords.slice(0, 28);
  const heatmapDays = [
    ...Array.from({ length: Math.max(0, 28 - recentHeatmapRecords.length) }, (_, index) => ({
      id: `heat-empty-${index}`,
      status: 'empty' as const,
      date: '',
      subject: '',
      record: null,
    })),
    ...recentHeatmapRecords.map((record) => ({
      id: `heat-${record.id}`,
      status: record.status,
      date: record.date,
      subject: record.subject,
      record,
    })),
  ];

  const playHapticTap = () => playPortalTap(650);

  return (
    <div className="space-y-6 lg:space-y-8 text-right md:px-2 animate-in fade-in duration-550" id="mobile-attendance-hub">
      <div className="bg-gradient-to-br from-indigo-920 via-indigo-950 to-slate-900/95 border border-indigo-500/20 p-5 rounded-3xl shadow-[0_4px_18px_rgba(15,23,42,0.15)] space-y-4 relative overflow-hidden text-white">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-xl" />

        <div className="flex justify-between items-center pb-2 border-b border-indigo-500/20 select-none">
          <h3 className="text-xs font-black text-white flex items-center gap-1.5 font-sans">
            <Sparkles className="w-4 h-4 text-indigo-300 animate-pulse" />
            <span>معدل الالتزام والحضور الفعلي</span>
          </h3>
          <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full select-none">محدث لحظياً</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="text-right">
            <span className="text-2xl md:text-3xl font-black font-mono text-white block">{attendanceRate}%</span>
            <span className="text-[10px] text-white block font-sans">إجمالي الحصص المرصودة: {total}</span>
          </div>

          <div className="flex gap-2 font-mono">
            <div className="px-3 py-1 bg-white/10 rounded-2xl text-center border border-white/10 hover:bg-white/15 transition-colors">
              <span className="block text-[8px] text-indigo-200">حضور</span>
              <span className="block text-xs font-black text-emerald-300">{presentCount}</span>
            </div>
            <div className="px-3 py-1 bg-white/10 rounded-2xl text-center border border-white/10 hover:bg-white/15 transition-colors">
              <span className="block text-[8px] text-indigo-200">تأخر</span>
              <span className="block text-xs font-black text-amber-300">{lateCount}</span>
            </div>
            <div className="px-3 py-1 bg-white/10 rounded-2xl text-center border border-white/10 hover:bg-white/15 transition-colors">
              <span className="block text-[8px] text-indigo-200">غياب</span>
              <span className="block text-xs font-black text-rose-300">{absentCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 p-5 rounded-3xl shadow-[0_4px_18px_rgba(15,23,42,0.02)] space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-full blur-xl" />

        <div className="pb-2 border-b border-gray-100/60 dark:border-slate-850/50 select-none space-y-1">
          <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400">الخريطة الحرارية الموحدة (آخر 28 سجل)</h3>
          <span className="text-[10px] text-neutral-450 dark:text-slate-300 block">اضغط على المربع لعرض تفاصيل اليوم الأكاديمي</span>
        </div>

        <div className="grid grid-cols-7 gap-2.5 py-1 justify-items-center" dir="rtl">
          {heatmapDays.map((day, index) => {
            const colors = {
              present: 'bg-emerald-500 shadow-emerald-500/15 border-emerald-500/25',
              late: 'bg-amber-500 shadow-amber-500/15 border-amber-500/25',
              absent: 'bg-rose-500 shadow-rose-500/15 border-rose-500/25',
              excused: 'bg-indigo-500 shadow-indigo-500/15 border-indigo-500/25',
              empty: 'bg-slate-100 dark:bg-slate-800/30 border-slate-200/20 dark:border-slate-800/10 opacity-30 cursor-default shadow-none pointer-events-none',
            };
            const isEmpty = day.status === 'empty';

            return (
              <motion.button
                key={day.id || index}
                whileHover={isEmpty ? undefined : { scale: 1.15 }}
                whileTap={isEmpty ? undefined : { scale: 0.9 }}
                onClick={() => {
                  if (!isEmpty && day.record) {
                    setSelectedDayLog(day.record);
                    playHapticTap();
                  }
                }}
                className={`w-9 h-9 rounded-xl ${colors[day.status as keyof typeof colors] || 'bg-slate-200 dark:bg-slate-800'} border border-transparent transition-all shadow-xs ${isEmpty ? '' : 'cursor-pointer'}`}
                title={isEmpty ? 'لا توجد حصة مسجلة في هذا اليوم' : 'اضغط للتفاصيل'}
              />
            );
          })}
        </div>

        <div className="flex items-center gap-3.5 text-[10px] text-neutral-500 dark:text-slate-300 justify-center flex-wrap select-none pt-2 border-t border-gray-100/50 dark:border-slate-850/50 font-sans">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500 shadow-sm" /> حضور ({presentCount})</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500 shadow-sm" /> متأخر ({lateCount})</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-rose-500 shadow-sm" /> غياب ({absentCount})</span>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 p-4.5 rounded-3xl space-y-3.5 shadow-[0_4px_18px_rgba(15,23,42,0.02)]">
        <div className="relative">
          <label htmlFor="attendance-search" className="sr-only">البحث في سجلات الحضور</label>
          <input
            id="attendance-search"
            type="text"
            placeholder="البحث باسم المحاضرة أو المدرس..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full text-xs p-3 pr-10 text-right bg-neutral-50 dark:bg-slate-950 border border-neutral-200/50 dark:border-slate-850 rounded-2xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 transition-all font-sans"
          />
          <Search className="w-4 h-4 text-neutral-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none justify-start select-none">
          {[
            { tag: 'all', title: 'الكل' },
            { tag: 'present', title: 'حاضر فقط' },
            { tag: 'late', title: 'متأخر' },
            { tag: 'absent', title: 'غياب' },
          ].map((item) => (
            <button
              key={item.tag}
              onClick={() => {
                setStatusFilter(item.tag as 'all' | AttendanceStatus);
                playHapticTap();
              }}
              aria-pressed={statusFilter === item.tag}
              className={`px-3.5 py-1.5 rounded-xl font-bold font-sans text-[10px] shrink-0 cursor-pointer transition-all ${
                statusFilter === item.tag
                  ? 'bg-indigo-600 text-white font-extrabold shadow-sm shadow-indigo-500/20'
                  : 'bg-neutral-50 dark:bg-slate-950 text-neutral-450 dark:text-zinc-300 hover:bg-neutral-200 dark:hover:bg-slate-850/60'
              }`}
            >
              {item.title}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-black text-gray-400 dark:text-slate-300 font-sans tracking-wide pr-1">أرشيف المحاضرات المكتملة وتفاصيل الغياب</h3>

        <AnimatePresence mode="popLayout">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="p-4 bg-white/80 backdrop-blur-sm dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850 rounded-2xl animate-pulse flex justify-between">
                <div className="w-14 h-5.5 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                <div className="space-y-2 flex-1 text-right flex flex-col pr-4">
                  <div className="w-1/3 h-4 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                  <div className="w-1/4 h-3 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                </div>
              </div>
            ))
          ) : filteredRecords.length === 0 ? (
            <div className="p-8 text-center rounded-2.5xl bg-white/80 backdrop-blur-sm dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850 select-none font-sans text-xs text-neutral-450 dark:text-slate-300">
              لا توجد أي محاضرات أو التماسات مسجلة مطابقة لخيارات التصفية الحالية.
            </div>
          ) : (
            filteredRecords.map((log) => {
              const details = getStatusDetails(log.status);
              return (
                <motion.div
                  key={log.id}
                  onClick={() => {
                    setSelectedDayLog(log);
                    playHapticTap();
                  }}
                  layoutId={`detail-log-${log.id}`}
                  whileHover={{ scale: 1.01, borderRightWidth: '5px' }}
                  whileTap={{ scale: 0.99 }}
                  className="p-4 bg-white/80 backdrop-blur-sm dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 rounded-2xl overflow-hidden shadow-[0_2px_10px_rgba(15,23,42,0.015)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.03)] hover:border-indigo-400 dark:hover:border-indigo-505/30 transition-all flex items-center justify-between text-right relative cursor-pointer group"
                >
                  <div className={`absolute right-0 top-0 bottom-0 w-1 ${details.bulletColor} group-hover:w-1.5 transition-all`} />

                  <div className="flex items-center gap-3.5 text-right">
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${details.color} border transition-all duration-300 group-hover:scale-105`}>
                      {log.status === 'present' ? '✓' : log.status === 'late' ? '◰' : log.status === 'excused' ? '📝' : '✕'}
                    </span>

                    <div className="text-right">
                      <h4 className="text-xs font-black text-slate-800 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">حصة يوم {formatArabicDate(log.date)}</h4>
                      <p className="text-[10px] text-neutral-450 dark:text-slate-300 font-mono mt-0.5">{log.subject} • {formatArabicTime(log.time)}</p>
                    </div>
                  </div>

                  <span className={`text-[9px] font-black px-2.5 pb-0.5 pt-1 rounded-xl ${details.badge} border shrink-0`}>
                    {details.text}
                  </span>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedDayLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDayLog}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
              aria-hidden="true"
            />

            <motion.div
              ref={dayLogDialogRef}
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="bg-white dark:bg-slate-900 rounded-[28px] border border-white/10 p-6 z-10 w-full max-w-lg space-y-4 max-h-[85vh] overflow-y-auto select-none font-sans text-right"
              dir="rtl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="attendance-daylog-title"
              aria-describedby="attendance-daylog-description"
              tabIndex={-1}
            >
              <div className="flex items-center justify-between border-b border-gray-100/60 dark:border-slate-850/50 pb-3">
                <div className="text-right">
                  <h3 id="attendance-daylog-title" className="text-sm font-black text-slate-800 dark:text-white">حصة يوم {getArabicDayName(selectedDayLog.date)}</h3>
                  <span id="attendance-daylog-description" className="text-[10px] text-neutral-500 dark:text-zinc-300 block mt-0.5 font-mono">{formatArabicDate(selectedDayLog.date)}</span>
                </div>
                <button
                  type="button"
                  onClick={closeDayLog}
                  className="p-1.5 hover:bg-neutral-100 dark:hover:bg-slate-800 rounded-full text-neutral-450 cursor-pointer"
                  aria-label="إغلاق تفاصيل سجل الحضور"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="space-y-3.5 pr-1 text-right">
                <div className="flex justify-between text-right gap-4 border-b border-gray-100/50 dark:border-slate-850/50 pb-2">
                  <span className="text-xs text-neutral-500 dark:text-zinc-300">وقت الحضور:</span>
                  <span className="text-xs font-bold text-gray-800 dark:text-zinc-200 font-sans">{formatArabicTime(selectedDayLog.time)}</span>
                </div>

                <div className="flex justify-between text-right gap-4 border-b border-gray-100/50 dark:border-slate-850/50 pb-2">
                  <span className="text-xs text-neutral-500 dark:text-zinc-300">الحالة:</span>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-black ${
                      selectedDayLog.status === 'present'
                        ? 'text-emerald-500'
                        : selectedDayLog.status === 'late'
                          ? 'text-amber-500'
                          : selectedDayLog.status === 'excused'
                            ? 'text-indigo-500'
                            : 'text-rose-500'
                    }`}
                  >
                    <span className={selectedDayLog.status === 'present' ? 'text-emerald-500' : selectedDayLog.status === 'late' ? 'text-amber-500' : selectedDayLog.status === 'excused' ? 'text-indigo-500' : 'text-rose-500'}>
                      {selectedDayLog.status === 'present' ? '🟢' : selectedDayLog.status === 'late' ? '🟡' : selectedDayLog.status === 'excused' ? '🔵' : '🔴'}
                    </span>
                    {selectedDayLog.status === 'present' ? '✔️' : selectedDayLog.status === 'late' ? '⏰' : selectedDayLog.status === 'excused' ? '📋' : '✕'} {getStatusDetails(selectedDayLog.status).text}
                  </span>
                </div>

                <div className="flex justify-between text-right gap-4 border-b border-gray-100/50 dark:border-slate-850/50 pb-2">
                  <span className="text-xs text-neutral-500 dark:text-zinc-300">تاريخ التسجيل:</span>
                  <span className="text-xs font-bold text-gray-800 dark:text-zinc-200 font-sans">{formatArabicDateShort(selectedDayLog.date)}</span>
                </div>

                <div className="p-3.5 bg-neutral-50 dark:bg-slate-950 rounded-2xl border border-neutral-200/50 dark:border-slate-850 space-y-1">
                  <span className="block text-[10px] text-indigo-500 dark:text-indigo-400 font-bold">الملاحظات:</span>
                  <p className="text-xs text-gray-600 dark:text-zinc-350 leading-relaxed">
                    {selectedDayLog.remarks || 'لا توجد ملاحظات إضافية على هذا السجل.'}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
