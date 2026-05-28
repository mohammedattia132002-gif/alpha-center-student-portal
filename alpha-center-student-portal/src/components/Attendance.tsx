/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { AttendanceRecord, AttendanceStatus } from '../types/domain';
import { 
  Calendar, CheckCircle, AlertCircle, Clock, FileWarning, 
  Search, Filter, Plus, FileText, Upload, Trash2, CheckCircle2,
  SlidersHorizontal, LayoutGrid, Milestone, RotateCcw, Sparkles,
  ArrowUpDown, User, ChevronRight, Share2, Info, RefreshCw, X, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AttendanceProps {
  records: AttendanceRecord[];
  onAddExcuse: (subject: string, date: string, remarks: string) => void;
}

export default function Attendance({ records, onAddExcuse }: AttendanceProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>('all');
  const [showExcuseForm, setShowExcuseForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Submit Excuse state
  const [excuseSubject, setExcuseSubject] = useState('');
  const [excuseDate, setExcuseDate] = useState('');
  const [excuseReason, setExcuseReason] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Selected Day log info for modal detail trigger
  const [selectedDayLog, setSelectedDayLog] = useState<AttendanceRecord | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trigger skeleton loader simulation on search / status filters
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 380);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter]);

  // Handle excuse form submission
  const submitExcuse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!excuseSubject || !excuseDate || !excuseReason) return;
    
    // Call parent handler
    onAddExcuse(
      excuseSubject, 
      excuseDate, 
      `${excuseReason}${selectedFile ? ` (مرفق رسمي معتمد: ${selectedFile.name})` : ''}`
    );

    setFormSubmitted(true);
    setTimeout(() => {
      setExcuseSubject('');
      setExcuseDate('');
      setExcuseReason('');
      setSelectedFile(null);
      setFormSubmitted(false);
      setShowExcuseForm(false);
    }, 1800);
  };

  const getStatusDetails = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return { 
          text: 'حاضر', 
          color: 'text-emerald-505 bg-emerald-500/10 border-emerald-500/15', 
          badge: 'border-emerald-500/15 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5',
          bulletColor: 'bg-emerald-500 shadow-emerald-500/30'
        };
      case 'late':
        return { 
          text: 'متأخر', 
          color: 'text-amber-505 bg-amber-500/10 border-amber-500/15', 
          badge: 'border-amber-500/15 text-amber-600 dark:text-amber-400 bg-amber-500/5',
          bulletColor: 'bg-amber-500 shadow-amber-500/30'
        };
      case 'excused':
        return { 
          text: 'معذور', 
          color: 'text-indigo-505 bg-indigo-500/10 border-indigo-500/15', 
          badge: 'border-indigo-505/15 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5',
          bulletColor: 'bg-indigo-500 shadow-indigo-500/30'
        };
      case 'absent':
        return { 
          text: 'غياب', 
          color: 'text-rose-505 bg-rose-500/10 border-rose-500/15', 
          badge: 'border-rose-505/15 text-rose-600 dark:text-rose-450 bg-rose-500/5',
          bulletColor: 'bg-rose-500 shadow-rose-500/30'
        };
    }
  };

  // Filter records
  const filteredRecords = records.filter(rec => {
    const matchesSearch = (rec.subject || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (rec.lecturer || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || rec.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const total = records.length;
  const presentCount = records.filter(r => r.status === 'present').length;
  const lateCount = records.filter(r => r.status === 'late').length;
  const absentCount = records.filter(r => r.status === 'absent').length;
  const excusedCount = records.filter(r => r.status === 'excused').length;
  const attendanceRate = total > 0 ? (((presentCount + excusedCount + (lateCount * 0.72)) / total) * 100).toFixed(1) : "100";

  // Simulate Drag Drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      simulateFileUpload(e.dataTransfer.files[0]);
    }
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      simulateFileUpload(e.target.files[0]);
    }
  };
  const simulateFileUpload = (file: File) => {
    setSelectedFile(file);
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 20;
      });
    }, 120);
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    setUploadProgress(0);
  };

  // Generate 28 blocks for Attendance Heatmap matrix represents recent days
  const heatmapDays = Array.from({ length: 28 }, (_, i) => {
    const rec = records[i % records.length];
    return {
      id: rec?.id || `heat-idx-${i}`,
      status: rec?.status || 'present',
      date: rec?.date || '2026-05-18',
      subject: rec?.subject || 'محاضرة مكملة'
    };
  }).reverse();

  // Sound play Tap
  const playHapticTap = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch(e){}
  };

  return (
    <div className="space-y-6 text-right md:px-2 animate-in fade-in duration-550" id="mobile-attendance-hub">
      
      {/* 1. COMPACT DISCIPLINE HEADER CARD WITH GLOW ACCENT */}
      <div className="bg-white/80 backdrop-blur-md dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 p-5 rounded-3xl shadow-[0_4px_18px_rgba(15,23,42,0.02)] space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/5 to-transparent rounded-full blur-xl" />
        
        <div className="flex justify-between items-center pb-2 border-b border-gray-100/60 dark:border-slate-850/50 select-none">
          <h3 className="text-xs font-black text-slate-800 dark:text-zinc-150 flex items-center gap-1.5 font-sans">
            <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
            <span>معدل الالتزام والتحضير الفعلي</span>
          </h3>
          <span className="text-[10px] font-black text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded-full select-none">محدث لحظياً</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="text-right">
            <span className="text-2xl md:text-3xl font-black font-mono text-slate-800 dark:text-white block">{attendanceRate}%</span>
            <span className="text-[10px] text-neutral-500 dark:text-zinc-400 block font-sans">إجمالي الجلسات المرصودة: {total}</span>
          </div>
          
          <div className="flex gap-2 font-mono">
            <div className="px-3 py-1 bg-emerald-500/5 rounded-2xl text-center border border-emerald-500/10 dark:border-emerald-500/5 hover:bg-emerald-500/10 transition-colors">
              <span className="block text-[8px] text-neutral-400 dark:text-slate-500">حضور</span>
              <span className="block text-xs font-black text-emerald-600 dark:text-emerald-400">{presentCount}</span>
            </div>
            <div className="px-3 py-1 bg-amber-500/5 rounded-2xl text-center border border-amber-500/10 dark:border-amber-500/5 hover:bg-amber-500/10 transition-colors">
              <span className="block text-[8px] text-neutral-400 dark:text-slate-500">تأخر</span>
              <span className="block text-xs font-black text-amber-500">{lateCount}</span>
            </div>
            <div className="px-3 py-1 bg-rose-500/5 rounded-2xl text-center border border-rose-500/10 dark:border-rose-500/5 hover:bg-rose-500/10 transition-colors">
              <span className="block text-[8px] text-neutral-400 dark:text-slate-500">غياب</span>
              <span className="block text-xs font-black text-rose-500">{absentCount}</span>
            </div>
          </div>
        </div>

        {/* Trigger Excuse bottom-sheet button */}
        <button 
          onClick={() => { setShowExcuseForm(true); playHapticTap(); }}
          className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/10 hover-glow active:scale-98 transition-all cursor-pointer"
        >
          <span>تقديم طلب التماس / عذر مرضي غياب</span>
          <Plus className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* 2. DUOLINGO STYLE CALENDAR HEATMAP WITH GLOW EFFECTS */}
      <div className="bg-white/80 backdrop-blur-md dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 p-5 rounded-3xl shadow-[0_4px_18px_rgba(15,23,42,0.02)] space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-full blur-xl" />
        
        <div className="flex justify-between items-center pb-2 border-b border-gray-100/60 dark:border-slate-850/50 select-none">
          <span className="text-[10px] text-neutral-450 dark:text-slate-500">اضغط على المربع لعرض تفاصيل اليوم الأكاديمي</span>
          <h3 className="text-xs font-black text-slate-800 dark:text-zinc-150">الخريطة الحرارية الموحدة (28 يوماً)</h3>
        </div>

        {/* Heat Map interactive mesh */}
        <div className="grid grid-cols-7 gap-2.5 py-1 justify-items-center" dir="rtl">
          {heatmapDays.map((day, ix) => {
            const colors = {
              present: 'bg-emerald-500 shadow-emerald-500/15 border-emerald-500/25',
              late: 'bg-amber-500 shadow-amber-500/15 border-amber-500/25',
              absent: 'bg-rose-500 shadow-rose-500/15 border-rose-500/25',
              excused: 'bg-indigo-500 shadow-indigo-500/15 border-indigo-500/25',
            };
            return (
              <motion.button
                key={ix}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  const associatedRec = records[ix % records.length];
                  if (associatedRec) {
                    setSelectedDayLog(associatedRec);
                  }
                  playHapticTap();
                }}
                className={`w-9 h-9 rounded-xl ${colors[day.status]} border transition-all cursor-pointer shadow-xs`}
                title="اضغط للتفاصيل"
              />
            );
          })}
        </div>

        {/* Colors key index */}
        <div className="flex items-center gap-3.5 text-[10px] text-neutral-500 dark:text-slate-400 justify-center flex-wrap select-none pt-2 border-t border-gray-100/50 dark:border-slate-850/50 font-sans">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500 shadow-sm" /> حضور ({presentCount})</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500 shadow-sm" /> متأخر ({lateCount})</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-indigo-500 shadow-sm" /> معذور ({excusedCount})</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-rose-500 shadow-sm" /> غياب ({absentCount})</span>
        </div>
      </div>

      {/* 3. SEARCH & STATUS FILTER CHIPS - LINEAR DASHBOARD LOOK */}
      <div className="bg-white/80 backdrop-blur-md dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 p-4.5 rounded-3xl space-y-3.5 shadow-[0_4px_18px_rgba(15,23,42,0.02)]">
        <div className="relative">
          <input 
            type="text"
            placeholder="البحث باسم المحاضرة أو الدكتور..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs p-3 pr-10 text-right bg-neutral-50 dark:bg-slate-950 border border-neutral-200/50 dark:border-slate-850 rounded-2xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 transition-all font-sans"
          />
          <Search className="w-4 h-4 text-neutral-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Filter Chips list */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none justify-start select-none">
          {[
            { tag: 'all', title: 'الكل' },
            { tag: 'present', title: 'حاضر فقط' },
            { tag: 'late', title: 'متأخر' },
            { tag: 'excused', title: 'معذور' },
            { tag: 'absent', title: 'غياب' }
          ].map((item) => (
            <button
              key={item.tag}
              onClick={() => { setStatusFilter(item.tag as any); playHapticTap(); }}
              className={`px-3.5 py-1.5 rounded-xl font-bold font-sans text-[10px] shrink-0 cursor-pointer transition-all ${
                statusFilter === item.tag 
                  ? 'bg-indigo-600 text-white font-extrabold shadow-sm shadow-indigo-500/20' 
                  : 'bg-neutral-50 dark:bg-slate-950 text-neutral-450 dark:text-zinc-400 hover:bg-neutral-200 dark:hover:bg-slate-850/60'
              }`}
            >
              {item.title}
            </button>
          ))}
        </div>
      </div>

      {/* 4. EXPLANATORY CARDS TIMELINE */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-gray-400 dark:text-slate-500 font-sans tracking-wide pr-1">أرشيف المحاضرات المكتملة وتفاصيل الغياب</h3>
        
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            /* skeleton loader cards with pulse animation */
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 bg-white/80 backdrop-blur-sm dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850 rounded-2xl animate-pulse flex justify-between">
                <div className="w-14 h-5.5 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                <div className="space-y-2 flex-1 text-right flex flex-col pr-4">
                  <div className="w-1/3 h-4 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                  <div className="w-1/4 h-3 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                </div>
              </div>
            ))
          ) : filteredRecords.length === 0 ? (
            <div className="p-8 text-center rounded-2.5xl bg-white/80 backdrop-blur-sm dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850 select-none font-sans text-xs text-neutral-450 dark:text-slate-500">
              لا توجد أية محاضرات أو التماسات مسجلة مطابقة للصيغة الحالية. 📋
            </div>
          ) : (
            filteredRecords.map((log) => {
              const details = getStatusDetails(log.status);
              return (
                <motion.div
                  key={log.id}
                  onClick={() => { setSelectedDayLog(log); playHapticTap(); }}
                  layoutId={`detail-log-${log.id}`}
                  whileHover={{ scale: 1.01, borderRightWidth: '5px' }}
                  whileTap={{ scale: 0.99 }}
                  className="p-4 bg-white/80 backdrop-blur-sm dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 rounded-2xl overflow-hidden shadow-[0_2px_10px_rgba(15,23,42,0.015)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.03)] hover:border-indigo-400 dark:hover:border-indigo-505/30 transition-all flex items-center justify-between text-right relative cursor-pointer group"
                >
                  <div className={`absolute right-0 top-0 bottom-0 w-1 ${details.bulletColor} group-hover:w-1.5 transition-all`} />

                  <div className="flex items-center gap-3.5 text-right">
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${details.color} border transition-all duration-300 group-hover:scale-105`}>
                      {log.status === 'present' ? '✓' : log.status === 'late' ? '⏰' : log.status === 'excused' ? '📋' : '☒'}
                    </span>

                    <div className="text-right">
                      <h4 className="text-xs font-black text-slate-800 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{log.subject}</h4>
                      <p className="text-[10px] text-neutral-450 dark:text-slate-500 font-mono mt-0.5">{log.date} • {log.time}</p>
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

      {/* 5. INTERACTIVE DAY LOG DETAILED BOTTOM SHEET */}
      <AnimatePresence>
        {selectedDayLog && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop blur */}
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setSelectedDayLog(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs" 
            />

            {/* Slide up sheet pane */}
            <motion.div 
              initial={{ y: '100%' }} 
              animate={{ y: 0 }} 
              exit={{ y: '100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-white dark:bg-slate-900 rounded-t-[32px] border-t border-white/10 p-6 z-10 w-full space-y-4 max-h-[75%] overflow-y-auto select-none font-sans text-right"
              dir="rtl"
            >
              {/* Drag bar decorator */}
              <div className="w-12 h-1 bg-gray-300 dark:bg-neutral-800 rounded-full mx-auto mb-2" />

              <div className="flex items-center justify-between border-b border-gray-100/60 dark:border-slate-850/50 pb-3">
                <div className="text-right">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white">{selectedDayLog.subject}</h3>
                  <span className="text-[10px] text-neutral-500 dark:text-zinc-400 block mt-0.5 font-mono">الرمز الأكاديمي الرقمي الموثق</span>
                </div>
                <button 
                  onClick={() => setSelectedDayLog(null)}
                  className="p-1.5 hover:bg-neutral-100 dark:hover:bg-slate-800 rounded-full text-neutral-450 cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="space-y-3.5 pr-1 text-right">
                {/* Stat 1: Lecturer */}
                <div className="flex justify-between text-right gap-4 border-b border-gray-100/50 dark:border-slate-850/50 pb-2">
                  <span className="text-xs text-neutral-500 dark:text-zinc-400">مدرس المادة الحالي:</span>
                  <span className="text-xs font-black text-gray-800 dark:text-zinc-200">{selectedDayLog.lecturer}</span>
                </div>

                {/* Stat 2: Time slotted */}
                <div className="flex justify-between text-right gap-4 border-b border-gray-100/50 dark:border-slate-850/50 pb-2">
                  <span className="text-xs text-neutral-500 dark:text-zinc-400">الفترة الزمنية للمحاضرة:</span>
                  <span className="text-xs font-bold text-gray-800 dark:text-zinc-200 font-mono">{selectedDayLog.time}</span>
                </div>

                {/* Stat 3: Status */}
                <div className="flex justify-between text-right gap-4 border-b border-gray-100/50 dark:border-slate-850/50 pb-2">
                  <span className="text-xs text-neutral-500 dark:text-zinc-400">حالة المسجل لليوم البوابة:</span>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-black ${
                    selectedDayLog.status === 'present' ? 'text-emerald-500' :
                    selectedDayLog.status === 'late' ? 'text-amber-500' :
                    selectedDayLog.status === 'excused' ? 'text-indigo-500' : 'text-rose-500'
                  }`}>
                    {getStatusDetails(selectedDayLog.status).text}
                  </span>
                </div>

                {/* Stat 4: Date */}
                <div className="flex justify-between text-right gap-4 border-b border-gray-100/50 dark:border-slate-850/50 pb-2">
                  <span className="text-xs text-neutral-500 dark:text-zinc-400">تاريخ التسجيل:</span>
                  <span className="text-xs font-bold text-gray-800 dark:text-zinc-200 font-mono">{selectedDayLog.date}</span>
                </div>

                {/* Stat 5: Remarks */}
                <div className="p-3.5 bg-neutral-50 dark:bg-slate-950 rounded-2xl border border-neutral-200/50 dark:border-slate-850 space-y-1">
                  <span className="block text-[10px] text-indigo-500 dark:text-indigo-400 font-bold">الملاحظات التوجيهية للجنة الطبية أو الدكتور:</span>
                  <p className="text-xs text-gray-600 dark:text-zinc-350 leading-relaxed">
                    {selectedDayLog.notes || "لا تتوفر أية تعليقات أو مخالفات محررة لهذا اليوم. سجل الطالب خالٍ من العقوبات."}
                  </p>
                </div>
              </div>

              {/* Close button */}
              <button 
                onClick={() => setSelectedDayLog(null)}
                className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-slate-850 text-neutral-700 dark:text-neutral-300 font-black rounded-2xl text-xs transition-colors cursor-pointer"
              >
                رجوع وإغلاق النافذة
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. IOS-STYLE EXCUSE ENTRY BOTTOM SHEET */}
      <AnimatePresence>
        {showExcuseForm && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowExcuseForm(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs" 
            />

            <motion.div 
              initial={{ y: '100%' }} 
              animate={{ y: 0 }} 
              exit={{ y: '100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-white dark:bg-slate-900 rounded-t-[32px] border-t border-white/10 p-5 z-10 w-full space-y-4 max-h-[85%] overflow-y-auto font-sans text-right select-none"
              dir="rtl"
            >
              <div className="w-12 h-1 bg-gray-300 dark:bg-neutral-800 rounded-full mx-auto" />

              <div className="flex items-center justify-between border-b border-gray-100/60 dark:border-slate-850/50 pb-3">
                <div className="text-right">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white font-sans">تقديم مستند التماس غياب رسمي</h3>
                  <p className="text-[10px] text-neutral-450 block mt-0.5">يرفع الطلب للمجلس الطبي وشؤون الطلاب الأكاديمية</p>
                </div>
                <button 
                  onClick={() => setShowExcuseForm(false)}
                  className="p-1.5 hover:bg-neutral-100 dark:hover:bg-slate-800 rounded-full text-neutral-450 cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {formSubmitted ? (
                <div className="py-8 text-center space-y-4 font-sans">
                  <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white">تم تقديم الالتماس بنجاح!</h3>
                  <p className="text-xs text-neutral-500 dark:text-slate-400">ستقوم شؤون الطلاب والمجلس الطبي الأكاديمي بدراسة التماسك واعتماده قريباً.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setFormSubmitted(false);
                      setShowExcuseForm(false);
                    }}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    إغلاق البوابة
                  </button>
                </div>
              ) : (
                <form onSubmit={submitExcuse} className="space-y-4 text-right">
                  
                  {/* Select Subject */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 dark:text-zinc-300 block">حدد مقرر المحاضرة المطلوب تقديم التماس له:</label>
                    <select 
                       required
                       value={excuseSubject}
                       onChange={(e) => setExcuseSubject(e.target.value)}
                       className="w-full text-xs p-3 text-right bg-neutral-50 dark:bg-slate-950 border border-neutral-200/50 dark:border-slate-850 rounded-2xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans text-slate-800 dark:text-slate-100"
                    >
                      <option value="">-- اضغط للاختيار من المقررات المسجلة --</option>
                      <option value="الرياضيات البحتة">الرياضيات البحتة (تفاضل وتكامل)</option>
                      <option value="الجبر والهندسة الفراغية">الجبر والهندسة الفراغية</option>
                      <option value="الرياضيات التطبيقية (الاستاتيكا)">الرياضيات التطبيقية (الاستاتيكا)</option>
                      <option value="الرياضيات التطبيقية (الديناميكا)">الرياضيات التطبيقية (الديناميكا)</option>
                    </select>
                  </div>

                  {/* Input Date */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 dark:text-zinc-300 block">تاريخ الغياب المرصوف للمراجعة:</label>
                    <input 
                      type="date"
                      required
                      value={excuseDate}
                      onChange={(e) => setExcuseDate(e.target.value)}
                      className="w-full text-xs p-3 text-right bg-neutral-50 dark:bg-slate-950 border border-neutral-200/50 dark:border-slate-850 rounded-2xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans font-mono text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  {/* Input Reason */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 dark:text-zinc-300 block">تفصيل الأسباب الموجبة للغياب بالتفصيل:</label>
                    <textarea 
                      required
                      placeholder="يرجى توضيح الظروف الطبية أو الشخصية بشكل وافٍ..."
                      rows={3}
                      value={excuseReason}
                      onChange={(e) => setExcuseReason(e.target.value)}
                      className="w-full text-xs p-3 text-right bg-neutral-50 dark:bg-slate-950 border border-neutral-200/50 dark:border-slate-850 rounded-2xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans leading-relaxed text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  {/* DRAG AND DROP FILE UPLOAD AREA */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 dark:text-zinc-300 block">ارفع الشهادة الطبية أو مستند الإثبات ملموساً:</label>
                    
                    <div 
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={'p-5 border-2 border-dashed rounded-3xl text-center flex flex-col items-center justify-center cursor-pointer transition-all ' + (
                        isDragging 
                          ? 'border-indigo-500 bg-indigo-500/5' 
                          : 'border-neutral-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-slate-700 bg-neutral-50/50 dark:bg-slate-950/40'
                      )}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileSelect}
                        accept="image/*,application/pdf"
                      />

                      <Upload className="w-7 h-7 text-neutral-400 animate-bounce mb-2" />
                      
                      {selectedFile ? (
                        <div className="space-y-1 w-full px-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-between text-right gap-2">
                            <span className="block text-xs font-black text-indigo-600 dark:text-indigo-400 truncate flex-1">{selectedFile.name}</span>
                            <button type="button" onClick={clearFile} className="p-1 hover:bg-rose-500/10 rounded-full text-rose-600 shrink-0 cursor-pointer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <span className="block text-[10px] text-neutral-400 text-right">الحجم الكلي: {(selectedFile.size / 1024).toFixed(1)} KB</span>
                          
                          <div className="w-full h-1 bg-neutral-200 dark:bg-slate-850 rounded-full overflow-hidden mt-2">
                            <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-0.5 select-none">
                          <span className="block text-[11px] font-black text-indigo-600 dark:text-indigo-400">اسحب الملف وألقه هنا أو اضغط للاستعراض</span>
                          <span className="block text-[9px] text-neutral-400 leading-normal">يدعم الصيغ المعتمدة PDF, JPG, PNG بحجم أقصى 5 ميجابايت</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action buttons list */}
                  <div className="flex gap-3 pt-2">
                    <button 
                      type="submit"
                      className="flex-1 py-3 bg-indigo-650 hover:bg-indigo-700 text-white font-black rounded-2xl text-xs transition-all shadow-xs active:scale-98 cursor-pointer"
                    >
                      إرسال وتأكيد الطلب
                    </button>
                    <button 
                      type="button"
                      onClick={() => setShowExcuseForm(false)}
                      className="px-4 py-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-slate-850 text-neutral-700 dark:text-neutral-300 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>

                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}